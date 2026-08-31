import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ContextLevel,
  EnrolmentMethod,
  EnrolmentStatus,
  LogAction,
  fullName,
} from '@maya/shared';
import { Enrolment, EnrolmentDocument } from './schemas/enrolment.schema';
import {
  EnrolmentMethodConfig,
  EnrolmentMethodDocument,
} from './schemas/enrolment-method.schema';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { GroupsService } from '../groups/groups.service';
import { LogsService } from '../logs/logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginatedResult } from '../../common/dto';
import { randomCode, toObjectId } from '../../common/utils';
import {
  CreateEnrolmentMethodDto,
  EnrolUsersDto,
  EnrolmentQueryDto,
  SelfEnrolDto,
  UpdateEnrolmentDto,
  UpdateEnrolmentMethodDto,
} from './dto/enrolment.dto';

@Injectable()
export class EnrolmentsService {
  private readonly logger = new Logger(EnrolmentsService.name);

  constructor(
    @InjectModel(Enrolment.name) private readonly model: Model<EnrolmentDocument>,
    @InjectModel(EnrolmentMethodConfig.name)
    private readonly methodModel: Model<EnrolmentMethodDocument>,
    private readonly contexts: ContextsService,
    private readonly roles: RolesService,
    private readonly groups: GroupsService,
    private readonly logs: LogsService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------ Consultas ------------------------------ */

  async isEnrolled(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.model
      .countDocuments({
        course: toObjectId(courseId),
        user: toObjectId(userId),
        status: EnrolmentStatus.Active,
      })
      .exec();
    return count > 0;
  }

  async findOne(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<EnrolmentDocument | null> {
    return this.model
      .findOne({ course: toObjectId(courseId), user: toObjectId(userId) })
      .exec();
  }

  async courseIdsOfUser(userId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const rows = await this.model
      .find({ user: toObjectId(userId), status: EnrolmentStatus.Active })
      .select('course')
      .lean()
      .exec();
    return rows.map((r) => r.course);
  }

  async activeUserIds(courseId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const rows = await this.model
      .find({ course: toObjectId(courseId), status: EnrolmentStatus.Active })
      .select('user')
      .lean()
      .exec();
    return rows.map((r) => r.user);
  }

  async countActive(courseId: string | Types.ObjectId): Promise<number> {
    return this.model
      .countDocuments({ course: toObjectId(courseId), status: EnrolmentStatus.Active })
      .exec();
  }

  /** Participantes del curso con sus roles y grupos. */
  async participants(
    courseId: string | Types.ObjectId,
    query: EnrolmentQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const filter: FilterQuery<EnrolmentDocument> = { course: toObjectId(courseId) };
    if (query.status) filter.status = query.status;

    if (query.groupId) {
      const group = await this.groups.findById(query.groupId);
      filter.user = { $in: group.members };
    }

    const [rows, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('user', 'firstName lastName email avatarUrl lastAccessAt status')
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    const assignments = await this.roles.assignmentsInContext(courseContext._id);
    const rolesByUser = new Map<string, { id: string; shortName: string; name: string }[]>();
    for (const assignment of assignments) {
      const role = assignment.role as unknown as {
        _id: Types.ObjectId;
        shortName: string;
        name: string;
      };
      const key = String(
        (assignment.user as unknown as { _id?: Types.ObjectId })?._id ?? assignment.user,
      );
      const list = rolesByUser.get(key) ?? [];
      list.push({ id: role._id.toString(), shortName: role.shortName, name: role.name });
      rolesByUser.set(key, list);
    }

    const allGroups = await this.groups.list(courseId);

    const items = rows
      .map((row) => {
        const user = row.user as unknown as {
          _id: Types.ObjectId;
          firstName: string;
          lastName: string;
          email: string;
          avatarUrl: string | null;
          lastAccessAt: Date | null;
        };
        const userId = String(user?._id ?? row.user);
        return {
          id: row.id,
          courseId: String(row.course),
          userId,
          user: user
            ? {
                id: userId,
                fullName: fullName(user.firstName, user.lastName),
                email: user.email,
                avatarUrl: user.avatarUrl,
                lastAccess: user.lastAccessAt,
              }
            : null,
          method: row.method,
          status: row.status,
          progress: row.progress,
          roles: rolesByUser.get(userId) ?? [],
          groups: allGroups
            .filter((g) => g.members.some((m) => String(m) === userId))
            .map((g) => ({ id: g.id, name: g.name })),
          timeStart: row.timeStart,
          timeEnd: row.timeEnd,
          lastAccess: row.lastAccess,
          createdAt: row.createdAt,
        };
      })
      .filter((row) =>
        query.roleShortName
          ? row.roles.some((r) => r.shortName === query.roleShortName)
          : true,
      );

    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  /* ---------------------------- Matriculación ---------------------------- */

  async enrol(params: {
    courseId: string | Types.ObjectId;
    tenantId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    roleShortName?: string;
    method?: EnrolmentMethod;
    timeStart?: Date | null;
    timeEnd?: Date | null;
    cohortId?: string | Types.ObjectId | null;
    actorId?: string | Types.ObjectId;
    notify?: boolean;
  }): Promise<EnrolmentDocument> {
    const courseContext = await this.contexts.requireByInstance(
      ContextLevel.Course,
      params.courseId,
    );

    let enrolment = await this.findOne(params.courseId, params.userId);
    if (enrolment) {
      enrolment.status = EnrolmentStatus.Active;
      if (params.timeStart !== undefined) enrolment.timeStart = params.timeStart;
      if (params.timeEnd !== undefined) enrolment.timeEnd = params.timeEnd;
      await enrolment.save();
    } else {
      enrolment = await this.model.create({
        course: toObjectId(params.courseId),
        user: toObjectId(params.userId),
        tenant: toObjectId(params.tenantId),
        method: params.method ?? EnrolmentMethod.Manual,
        status: EnrolmentStatus.Active,
        timeStart: params.timeStart ?? new Date(),
        timeEnd: params.timeEnd ?? null,
        cohort: params.cohortId ? toObjectId(params.cohortId) : null,
      });
    }

    await this.roles.assignByShortName({
      userId: params.userId,
      shortName: params.roleShortName ?? 'student',
      contextId: courseContext._id,
      tenantId: params.tenantId,
      component: `enrol/${params.method ?? EnrolmentMethod.Manual}`,
    });

    await this.logs.record({
      tenantId: params.tenantId,
      userId: params.actorId ?? params.userId,
      relatedUserId: params.userId,
      courseId: params.courseId,
      contextId: courseContext._id,
      component: `enrol/${params.method ?? EnrolmentMethod.Manual}`,
      target: 'enrolment',
      action: LogAction.Enrolled,
      objectId: enrolment._id,
    });

    if (params.notify) {
      await this.notifications.notify({
        tenantId: params.tenantId,
        userIds: [toObjectId(params.userId)],
        component: 'enrol',
        eventName: 'course_enrolled',
        subject: 'Se le ha matriculado en un curso nuevo',
        body: 'Ya puede acceder al curso desde su panel de Maya Classroom.',
        contextUrl: `/courses/${String(params.courseId)}`,
      });
    }

    return enrolment;
  }

  async enrolMany(
    courseId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    dto: EnrolUsersDto,
    actorId: string | Types.ObjectId,
  ): Promise<{ enrolled: number }> {
    for (const userId of dto.userIds) {
      await this.enrol({
        courseId,
        tenantId,
        userId,
        roleShortName: dto.roleShortName,
        method: EnrolmentMethod.Manual,
        timeStart: dto.timeStart ? new Date(dto.timeStart) : undefined,
        timeEnd: dto.timeEnd ? new Date(dto.timeEnd) : undefined,
        actorId,
        notify: dto.notify,
      });
      if (dto.groupId) await this.groups.addMembers(dto.groupId, [userId]);
    }
    return { enrolled: dto.userIds.length };
  }

  /** Automatriculación del propio usuario, validando la clave si procede. */
  async selfEnrol(
    courseId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SelfEnrolDto,
  ): Promise<EnrolmentDocument> {
    const method = await this.methodModel
      .findOne({ course: toObjectId(courseId), method: EnrolmentMethod.Self, enabled: true })
      .exec();
    if (!method) {
      throw new ForbiddenException('La automatriculación no está habilitada en este curso.');
    }

    const now = new Date();
    if (method.startDate && method.startDate > now) {
      throw new ForbiddenException('El período de matriculación aún no ha comenzado.');
    }
    if (method.endDate && method.endDate < now) {
      throw new ForbiddenException('El período de matriculación ha finalizado.');
    }
    if (method.enrolmentKey && method.enrolmentKey !== dto.enrolmentKey) {
      throw new ForbiddenException('La clave de matriculación no es correcta.');
    }
    if (method.maxEnrolled > 0) {
      const current = await this.countActive(courseId);
      if (current >= method.maxEnrolled) {
        throw new ForbiddenException('El curso ha alcanzado el número máximo de participantes.');
      }
    }

    const role = method.role
      ? (await this.roles.findById(method.role)).shortName
      : 'student';

    const timeEnd =
      method.enrolPeriodDays > 0
        ? new Date(Date.now() + method.enrolPeriodDays * 86_400_000)
        : null;

    return this.enrol({
      courseId,
      tenantId,
      userId,
      roleShortName: role,
      method: EnrolmentMethod.Self,
      timeEnd,
    });
  }

  async update(
    id: string | Types.ObjectId,
    dto: UpdateEnrolmentDto,
  ): Promise<EnrolmentDocument> {
    const enrolment = await this.model.findById(toObjectId(id)).exec();
    if (!enrolment) throw new NotFoundException('Matrícula no encontrada.');
    if (dto.status) enrolment.status = dto.status;
    if (dto.timeStart !== undefined) enrolment.timeStart = dto.timeStart ? new Date(dto.timeStart) : null;
    if (dto.timeEnd !== undefined) enrolment.timeEnd = dto.timeEnd ? new Date(dto.timeEnd) : null;
    await enrolment.save();
    return enrolment;
  }

  async unenrol(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    actorId?: string | Types.ObjectId,
  ): Promise<void> {
    const enrolment = await this.findOne(courseId, userId);
    if (!enrolment) throw new NotFoundException('El usuario no está matriculado en este curso.');

    const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    await this.roles.unassignAllInContext(userId, courseContext._id);
    await this.groups.removeUserFromAllGroups(courseId, userId);
    await enrolment.deleteOne();

    await this.logs.record({
      tenantId: enrolment.tenant,
      userId: actorId ?? userId,
      relatedUserId: userId,
      courseId,
      contextId: courseContext._id,
      component: 'enrol',
      target: 'enrolment',
      action: LogAction.Unenrolled,
    });
  }

  async touchAccess(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    await this.model
      .updateOne(
        { course: toObjectId(courseId), user: toObjectId(userId) },
        { $set: { lastAccess: new Date() } },
      )
      .exec();
  }

  async setProgress(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    progress: number,
    completed = false,
  ): Promise<void> {
    await this.model
      .updateOne(
        { course: toObjectId(courseId), user: toObjectId(userId) },
        {
          $set: {
            progress: Math.round(progress),
            ...(completed ? { completedAt: new Date() } : {}),
          },
        },
      )
      .exec();
  }

  /* --------------------- Métodos de matriculación ------------------------ */

  async listMethods(courseId: string | Types.ObjectId): Promise<EnrolmentMethodDocument[]> {
    return this.methodModel
      .find({ course: toObjectId(courseId) })
      .sort({ sortOrder: 1 })
      .exec();
  }

  async createMethod(
    courseId: string | Types.ObjectId,
    dto: CreateEnrolmentMethodDto,
  ): Promise<EnrolmentMethodDocument> {
    const existing = await this.methodModel
      .findOne({ course: toObjectId(courseId), method: dto.method })
      .exec();
    if (existing && dto.method !== EnrolmentMethod.Cohort) {
      throw new BadRequestException('Ese método de matriculación ya está configurado.');
    }
    return this.methodModel.create({
      course: toObjectId(courseId),
      method: dto.method,
      name: dto.name ?? '',
      enabled: dto.enabled ?? true,
      role: dto.roleId ? toObjectId(dto.roleId) : null,
      enrolmentKey:
        dto.enrolmentKey ?? (dto.method === EnrolmentMethod.Self ? randomCode(8) : null),
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      enrolPeriodDays: dto.enrolPeriodDays ?? 0,
      maxEnrolled: dto.maxEnrolled ?? 0,
      cohort: dto.cohortId ? toObjectId(dto.cohortId) : null,
      sendWelcomeMessage: dto.sendWelcomeMessage ?? false,
      welcomeMessage: dto.welcomeMessage ?? null,
    });
  }

  async updateMethod(
    id: string | Types.ObjectId,
    dto: UpdateEnrolmentMethodDto,
  ): Promise<EnrolmentMethodDocument> {
    const method = await this.methodModel.findById(toObjectId(id)).exec();
    if (!method) throw new NotFoundException('Método de matriculación no encontrado.');
    const { roleId, cohortId, startDate, endDate, ...rest } = dto;
    Object.assign(method, rest);
    if (roleId !== undefined) method.role = roleId ? toObjectId(roleId) : null;
    if (cohortId !== undefined) method.cohort = cohortId ? toObjectId(cohortId) : null;
    if (startDate !== undefined) method.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) method.endDate = endDate ? new Date(endDate) : null;
    await method.save();
    return method;
  }

  async removeMethod(id: string | Types.ObjectId): Promise<void> {
    await this.methodModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /** Crea el método manual por defecto al crear un curso. */
  async provisionDefaults(courseId: string | Types.ObjectId): Promise<void> {
    const existing = await this.methodModel.countDocuments({ course: toObjectId(courseId) }).exec();
    if (existing > 0) return;
    await this.methodModel.create({
      course: toObjectId(courseId),
      method: EnrolmentMethod.Manual,
      name: 'Matriculación manual',
      enabled: true,
      sortOrder: 0,
    });
  }
}
