import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { createHash, randomUUID } from 'node:crypto';
import {
  BadgeCriteriaType,
  BadgeDto,
  BadgeStatus,
  BadgeType,
  CompletionState,
  IssuedBadgeDto,
} from '@maya/shared';
import { Badge, BadgeDocument, IssuedBadge, IssuedBadgeDocument } from './schemas/badge.schema';
import { CompletionService } from '../completion/completion.service';
import { GradesService } from '../grades/grades.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toObjectId } from '../../common/utils';
import type { UpdateBadgeDto } from './dto/badge.dto';

@Injectable()
export class BadgesService {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    @InjectModel(Badge.name) private readonly model: Model<BadgeDocument>,
    @InjectModel(IssuedBadge.name) private readonly issuedModel: Model<IssuedBadgeDocument>,
    private readonly completion: CompletionService,
    private readonly grades: GradesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(
    tenantId: string | Types.ObjectId,
    courseId?: string,
  ): Promise<BadgeDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (courseId) filter.course = toObjectId(courseId);
    const badges = await this.model.find(filter).sort({ name: 1 }).exec();
    return Promise.all(badges.map((b) => this.toDto(b)));
  }

  async findById(id: string | Types.ObjectId): Promise<BadgeDocument> {
    const badge = await this.model.findById(toObjectId(id)).exec();
    if (!badge) throw new NotFoundException('Insignia no encontrada.');
    return badge;
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: {
      name: string;
      description: string;
      imageUrl?: string;
      type?: BadgeType;
      courseId?: string;
      issuerName: string;
      issuerEmail: string;
      expiryDate?: string;
      criteria?: unknown[];
      criteriaAggregation?: 'all' | 'any';
    },
  ): Promise<BadgeDto> {
    const badge = await this.model.create({
      tenant: toObjectId(tenantId),
      course: dto.courseId ? toObjectId(dto.courseId) : null,
      name: dto.name,
      description: dto.description,
      imageUrl: dto.imageUrl ?? null,
      type: dto.type ?? (dto.courseId ? BadgeType.Course : BadgeType.Site),
      issuerName: dto.issuerName,
      issuerEmail: dto.issuerEmail,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      criteria: dto.criteria ?? [],
      criteriaAggregation: dto.criteriaAggregation ?? 'all',
    });
    return this.toDto(badge);
  }

  async update(id: string | Types.ObjectId, dto: UpdateBadgeDto): Promise<BadgeDto> {
    const badge = await this.findById(id);
    const { expiryDate, courseId, ...rest } = dto;
    Object.assign(badge, rest);
    if (expiryDate !== undefined) badge.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (courseId !== undefined) badge.course = courseId ? toObjectId(courseId) : null;
    await badge.save();
    return this.toDto(badge);
  }

  async setStatus(id: string | Types.ObjectId, status: BadgeStatus): Promise<BadgeDto> {
    const badge = await this.findById(id);
    badge.status = status;
    await badge.save();
    return this.toDto(badge);
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.issuedModel.deleteMany({ badge: toObjectId(id) }).exec();
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /* ------------------------------ Concesión ------------------------------ */

  async award(
    badgeId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<IssuedBadgeDto> {
    const badge = await this.findById(badgeId);
    const existing = await this.issuedModel
      .findOne({ badge: badge._id, user: toObjectId(userId) })
      .exec();
    if (existing) return this.issuedToDto(existing, badge);

    const uniqueHash = createHash('sha256')
      .update(`${badge.id}:${String(userId)}:${randomUUID()}`)
      .digest('hex')
      .slice(0, 32);

    const issued = await this.issuedModel.create({
      tenant: badge.tenant,
      badge: badge._id,
      user: toObjectId(userId),
      uniqueHash,
      expiresAt: badge.expiryDate,
    });

    await this.notifications.notify({
      tenantId: badge.tenant,
      userIds: [toObjectId(userId)],
      component: 'badges',
      eventName: 'badge_awarded',
      subject: `Ha obtenido la insignia «${badge.name}»`,
      body: badge.description,
      contextUrl: '/badges',
    });

    return this.issuedToDto(issued, badge);
  }

  async revoke(badgeId: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<void> {
    await this.issuedModel
      .deleteOne({ badge: toObjectId(badgeId), user: toObjectId(userId) })
      .exec();
  }

  async userBadges(userId: string | Types.ObjectId): Promise<IssuedBadgeDto[]> {
    const issued = await this.issuedModel
      .find({ user: toObjectId(userId) })
      .populate('badge')
      .sort({ issuedAt: -1 })
      .exec();

    return Promise.all(
      issued.map(async (item) => {
        const badge = item.badge as unknown as BadgeDocument;
        return this.issuedToDto(item, badge);
      }),
    );
  }

  /** Verificación pública de una insignia por su hash. */
  async verify(uniqueHash: string) {
    const issued = await this.issuedModel
      .findOne({ uniqueHash })
      .populate('badge')
      .populate('user', 'firstName lastName')
      .exec();
    if (!issued) throw new NotFoundException('La insignia no existe o ha sido revocada.');

    const badge = issued.badge as unknown as BadgeDocument;
    const user = issued.user as unknown as { firstName: string; lastName: string };
    return {
      valid: !issued.expiresAt || issued.expiresAt > new Date(),
      badgeName: badge.name,
      badgeDescription: badge.description,
      imageUrl: badge.imageUrl,
      issuerName: badge.issuerName,
      recipient: `${user.firstName} ${user.lastName}`,
      issuedAt: issued.issuedAt.toISOString(),
      expiresAt: issued.expiresAt?.toISOString() ?? null,
    };
  }

  /* ------------------------- Evaluación automática ----------------------- */

  /** Al completar un curso se revisan las insignias con criterios cumplidos. */
  @OnEvent('course.completed')
  async onCourseCompleted(payload: { courseId: string; userId: string }): Promise<void> {
    try {
      const badges = await this.model
        .find({ status: BadgeStatus.Active, course: toObjectId(payload.courseId) })
        .exec();
      for (const badge of badges) {
        if (await this.criteriaMet(badge, payload.userId)) {
          await this.award(badge._id, payload.userId);
        }
      }
    } catch (error) {
      this.logger.warn(`No se pudieron evaluar las insignias: ${String(error)}`);
    }
  }

  async criteriaMet(badge: BadgeDocument, userId: string | Types.ObjectId): Promise<boolean> {
    if (!badge.criteria.length) return false;
    const results: boolean[] = [];

    for (const criterion of badge.criteria) {
      switch (criterion.type) {
        case BadgeCriteriaType.ActivityCompletion: {
          const states = await Promise.all(
            criterion.modules.map((m) => this.completion.stateFor(m, userId)),
          );
          results.push(
            states.length > 0 &&
              states.every(
                (s) => s === CompletionState.Complete || s === CompletionState.CompletePass,
              ),
          );
          break;
        }
        case BadgeCriteriaType.CourseCompletion: {
          const progresses = await Promise.all(
            criterion.courses.map((c) => this.completion.courseProgress(c, userId)),
          );
          results.push(progresses.length > 0 && progresses.every((p) => p.progress >= 100));
          break;
        }
        case BadgeCriteriaType.Grade: {
          if (!badge.course || criterion.minGrade === null) {
            results.push(false);
            break;
          }
          const total = await this.grades.courseTotalItem(badge.course);
          const grade = await this.grades.userGradeForItem(total._id, userId);
          results.push((grade?.finalGrade ?? 0) >= criterion.minGrade);
          break;
        }
        case BadgeCriteriaType.Manual:
          results.push(false);
          break;
        default:
          results.push(false);
      }
    }

    return badge.criteriaAggregation === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  /* ------------------------------ Mapeadores ----------------------------- */

  private async toDto(badge: BadgeDocument): Promise<BadgeDto> {
    const awardedCount = await this.issuedModel.countDocuments({ badge: badge._id }).exec();
    return {
      id: badge.id,
      tenantId: String(badge.tenant),
      courseId: badge.course ? String(badge.course) : null,
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl,
      type: badge.type,
      status: badge.status,
      issuerName: badge.issuerName,
      issuerEmail: badge.issuerEmail,
      expiryDate: badge.expiryDate?.toISOString() ?? null,
      criteria: badge.criteria.map((c) => ({
        id: String(c['_id' as never]),
        type: c.type,
        description: c.description,
        moduleIds: c.modules.map(String),
        courseIds: c.courses.map(String),
        competencyIds: c.competencies.map(String),
        minGrade: c.minGrade,
      })),
      criteriaAggregation: badge.criteriaAggregation,
      awardedCount,
    };
  }

  private async issuedToDto(
    issued: IssuedBadgeDocument,
    badge: BadgeDocument,
  ): Promise<IssuedBadgeDto> {
    return {
      id: issued.id,
      badgeId: String(badge._id),
      badge: await this.toDto(badge),
      userId: String(issued.user),
      uniqueHash: issued.uniqueHash,
      issuedAt: issued.issuedAt.toISOString(),
      expiresAt: issued.expiresAt?.toISOString() ?? null,
      verifyUrl: `/badges/verify/${issued.uniqueHash}`,
    };
  }
}
