import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CompetencyDto,
  CompetencyFrameworkDto,
  CompetencyProficiency,
  LearningPlanDto,
  LearningPlanStatus,
  UserCompetencyDto,
} from '@maya/shared';
import {
  Competency,
  CompetencyDocument,
  CompetencyFramework,
  CompetencyFrameworkDocument,
  CompetencyLink,
  CompetencyLinkDocument,
  LearningPlan,
  LearningPlanDocument,
  UserCompetency,
  UserCompetencyDocument,
} from './schemas/competency.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { toObjectId } from '../../common/utils';

@Injectable()
export class CompetenciesService {
  constructor(
    @InjectModel(CompetencyFramework.name)
    private readonly frameworkModel: Model<CompetencyFrameworkDocument>,
    @InjectModel(Competency.name) private readonly model: Model<CompetencyDocument>,
    @InjectModel(CompetencyLink.name)
    private readonly linkModel: Model<CompetencyLinkDocument>,
    @InjectModel(UserCompetency.name)
    private readonly userModel: Model<UserCompetencyDocument>,
    @InjectModel(LearningPlan.name)
    private readonly planModel: Model<LearningPlanDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------- Marcos -------------------------------- */

  async frameworks(tenantId: string | Types.ObjectId): Promise<CompetencyFrameworkDto[]> {
    const frameworks = await this.frameworkModel
      .find({ tenant: toObjectId(tenantId) })
      .sort({ name: 1 })
      .exec();

    return Promise.all(
      frameworks.map(async (framework) => ({
        id: framework.id,
        shortName: framework.shortName,
        name: framework.name,
        description: framework.description,
        idNumber: framework.idNumber,
        scaleId: framework.scale ? String(framework.scale) : null,
        visible: framework.visible,
        competencyCount: await this.model.countDocuments({ framework: framework._id }).exec(),
      })),
    );
  }

  async createFramework(
    tenantId: string | Types.ObjectId,
    dto: { shortName: string; name: string; description?: string; idNumber?: string },
  ): Promise<CompetencyFrameworkDocument> {
    return this.frameworkModel.create({ ...dto, tenant: toObjectId(tenantId) });
  }

  async removeFramework(id: string | Types.ObjectId): Promise<void> {
    const competencies = await this.model.find({ framework: toObjectId(id) }).select('_id').lean().exec();
    await this.userModel.deleteMany({ competency: { $in: competencies.map((c) => c._id) } }).exec();
    await this.model.deleteMany({ framework: toObjectId(id) }).exec();
    await this.frameworkModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /* ---------------------------- Competencias ----------------------------- */

  /** Árbol de competencias de un marco. */
  async tree(frameworkId: string | Types.ObjectId): Promise<CompetencyDto[]> {
    const competencies = await this.model
      .find({ framework: toObjectId(frameworkId) })
      .sort({ depth: 1, sortOrder: 1 })
      .exec();

    const nodes = new Map<string, CompetencyDto>();
    for (const item of competencies) {
      nodes.set(item.id, {
        id: item.id,
        frameworkId: String(item.framework),
        parentId: item.parent ? String(item.parent) : null,
        shortName: item.shortName,
        description: item.description,
        idNumber: item.idNumber,
        path: item.path,
        depth: item.depth,
        sortOrder: item.sortOrder,
        ruleType: item.ruleType,
        children: [],
      });
    }

    const roots: CompetencyDto[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async createCompetency(
    tenantId: string | Types.ObjectId,
    dto: {
      frameworkId: string;
      parentId?: string;
      shortName: string;
      description?: string;
      idNumber?: string;
      ruleType?: string;
    },
  ): Promise<CompetencyDocument> {
    const parent = dto.parentId ? await this.findById(dto.parentId) : null;
    const competency = await this.model.create({
      tenant: toObjectId(tenantId),
      framework: toObjectId(dto.frameworkId),
      parent: parent?._id ?? null,
      shortName: dto.shortName,
      description: dto.description ?? null,
      idNumber: dto.idNumber ?? null,
      depth: parent ? parent.depth + 1 : 0,
      path: parent ? parent.path : '/',
      ruleType: dto.ruleType ?? null,
    });
    competency.path = `${parent ? parent.path : '/'}${competency._id.toString()}/`;
    await competency.save();
    return competency;
  }

  async findById(id: string | Types.ObjectId): Promise<CompetencyDocument> {
    const competency = await this.model.findById(toObjectId(id)).exec();
    if (!competency) throw new NotFoundException('Competencia no encontrada.');
    return competency;
  }

  async removeCompetency(id: string | Types.ObjectId): Promise<void> {
    const competency = await this.findById(id);
    const descendants = await this.model
      .find({ path: { $regex: `^${competency.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } })
      .select('_id')
      .lean()
      .exec();
    const ids = descendants.map((d) => d._id);
    await this.userModel.deleteMany({ competency: { $in: ids } }).exec();
    await this.linkModel.deleteMany({ competency: { $in: ids } }).exec();
    await this.model.deleteMany({ _id: { $in: ids } }).exec();
  }

  /* ------------------------ Vínculos con cursos -------------------------- */

  async linkToCourse(
    tenantId: string | Types.ObjectId,
    competencyId: string,
    courseId: string,
    courseModuleId?: string,
    ruleOutcome = 'attach',
  ): Promise<CompetencyLinkDocument> {
    return this.linkModel.findOneAndUpdate(
      {
        competency: toObjectId(competencyId),
        course: toObjectId(courseId),
        courseModule: courseModuleId ? toObjectId(courseModuleId) : null,
      },
      { $set: { tenant: toObjectId(tenantId), ruleOutcome } },
      { upsert: true, new: true },
    ).exec();
  }

  async courseCompetencies(courseId: string | Types.ObjectId) {
    return this.linkModel
      .find({ course: toObjectId(courseId) })
      .populate('competency')
      .exec();
  }

  async unlink(linkId: string | Types.ObjectId): Promise<void> {
    await this.linkModel.deleteOne({ _id: toObjectId(linkId) }).exec();
  }

  /* -------------------------- Evaluación de usuario ---------------------- */

  async rate(params: {
    tenantId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    competencyId: string | Types.ObjectId;
    proficiency: CompetencyProficiency;
    grade?: number | null;
    reviewerId?: string | Types.ObjectId;
    note?: string;
    courseId?: string | Types.ObjectId;
  }): Promise<UserCompetencyDto> {
    const record = await this.userModel
      .findOneAndUpdate(
        { user: toObjectId(params.userId), competency: toObjectId(params.competencyId) },
        {
          $set: {
            tenant: toObjectId(params.tenantId),
            proficiency: params.proficiency,
            grade: params.grade ?? null,
            reviewer: params.reviewerId ? toObjectId(params.reviewerId) : null,
          },
          ...(params.note
            ? {
                $push: {
                  evidence: {
                    note: params.note,
                    courseId: params.courseId ? toObjectId(params.courseId) : undefined,
                    date: new Date(),
                  },
                },
              }
            : {}),
        },
        { upsert: true, new: true },
      )
      .exec();

    if (params.proficiency === CompetencyProficiency.Proficient) {
      await this.notifications.notify({
        tenantId: params.tenantId,
        userIds: [toObjectId(params.userId)],
        component: 'competency',
        eventName: 'competency_rated',
        subject: 'Ha alcanzado una competencia',
        body: 'Se ha registrado que domina una nueva competencia en su plan de aprendizaje.',
        contextUrl: '/competencies',
      });
    }

    return this.userCompetencyToDto(record);
  }

  async userCompetencies(userId: string | Types.ObjectId): Promise<UserCompetencyDto[]> {
    const records = await this.userModel
      .find({ user: toObjectId(userId) })
      .populate('competency')
      .exec();
    return records.map((r) => this.userCompetencyToDto(r));
  }

  /* --------------------------- Planes de aprendizaje --------------------- */

  async plans(userId: string | Types.ObjectId): Promise<LearningPlanDto[]> {
    const plans = await this.planModel.find({ user: toObjectId(userId) }).exec();
    return Promise.all(plans.map((p) => this.planToDto(p)));
  }

  async createPlan(
    tenantId: string | Types.ObjectId,
    dto: {
      userId: string;
      name: string;
      description?: string;
      dueDate?: string;
      competencyIds?: string[];
    },
  ): Promise<LearningPlanDto> {
    const plan = await this.planModel.create({
      tenant: toObjectId(tenantId),
      user: toObjectId(dto.userId),
      name: dto.name,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      competencies: (dto.competencyIds ?? []).map(toObjectId),
      status: LearningPlanStatus.Active,
    });
    return this.planToDto(plan);
  }

  async updatePlan(
    id: string | Types.ObjectId,
    dto: {
      name?: string;
      description?: string;
      status?: LearningPlanStatus;
      dueDate?: string;
      competencyIds?: string[];
    },
  ): Promise<LearningPlanDto> {
    const plan = await this.planModel.findById(toObjectId(id)).exec();
    if (!plan) throw new NotFoundException('Plan de aprendizaje no encontrado.');
    if (dto.name) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description ?? null;
    if (dto.status) plan.status = dto.status;
    if (dto.dueDate !== undefined) plan.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.competencyIds) plan.competencies = dto.competencyIds.map(toObjectId);
    await plan.save();
    return this.planToDto(plan);
  }

  async removePlan(id: string | Types.ObjectId): Promise<void> {
    await this.planModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  private async planToDto(plan: LearningPlanDocument): Promise<LearningPlanDto> {
    const records = await this.userModel
      .find({ user: plan.user, competency: { $in: plan.competencies } })
      .populate('competency')
      .exec();

    const proficient = records.filter(
      (r) => r.proficiency === CompetencyProficiency.Proficient,
    ).length;

    return {
      id: plan.id,
      userId: String(plan.user),
      templateId: null,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      dueDate: plan.dueDate?.toISOString() ?? null,
      competencies: records.map((r) => this.userCompetencyToDto(r)),
      progress: plan.competencies.length
        ? Math.round((proficient / plan.competencies.length) * 100)
        : 0,
    };
  }

  private userCompetencyToDto(record: UserCompetencyDocument): UserCompetencyDto {
    const competency = record.competency as unknown as CompetencyDocument | Types.ObjectId;
    const populated =
      competency && typeof competency === 'object' && 'shortName' in competency
        ? (competency as CompetencyDocument)
        : null;

    return {
      id: record.id,
      userId: String(record.user),
      competencyId: String(populated?._id ?? record.competency),
      competency: populated
        ? {
            id: populated.id,
            frameworkId: String(populated.framework),
            parentId: populated.parent ? String(populated.parent) : null,
            shortName: populated.shortName,
            description: populated.description,
            idNumber: populated.idNumber,
            path: populated.path,
            depth: populated.depth,
            sortOrder: populated.sortOrder,
            ruleType: populated.ruleType,
          }
        : undefined,
      proficiency: record.proficiency,
      grade: record.grade,
      reviewerId: record.reviewer ? String(record.reviewer) : null,
      evidenceCount: record.evidence.length,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
