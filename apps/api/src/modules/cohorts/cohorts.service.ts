import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CohortDto, ContextLevel, EnrolmentMethod } from '@maya/shared';
import { Cohort, CohortDocument } from './schemas/cohort.schema';
import { ContextsService } from '../contexts/contexts.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto';
import { searchRegex, toObjectId } from '../../common/utils';

@Injectable()
export class CohortsService {
  constructor(
    @InjectModel(Cohort.name) private readonly model: Model<CohortDocument>,
    private readonly contexts: ContextsService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  async paginate(
    tenantId: string | Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CohortDto>> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (query.search) filter.name = searchRegex(query.search);

    const [rows, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(rows.map((c) => this.toDto(c)), total, query.page, query.limit);
  }

  async findById(id: string | Types.ObjectId): Promise<CohortDocument> {
    const cohort = await this.model.findById(toObjectId(id)).exec();
    if (!cohort) throw new NotFoundException('Cohorte no encontrada.');
    return cohort;
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: { name: string; idNumber?: string; description?: string; visible?: boolean },
  ): Promise<CohortDto> {
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, tenantId);
    const cohort = await this.model.create({
      tenant: toObjectId(tenantId),
      context: context._id,
      name: dto.name,
      idNumber: dto.idNumber ?? null,
      description: dto.description ?? null,
      visible: dto.visible ?? true,
      members: [],
    });
    return this.toDto(cohort);
  }

  async update(
    id: string | Types.ObjectId,
    dto: { name?: string; idNumber?: string; description?: string; visible?: boolean },
  ): Promise<CohortDto> {
    const cohort = await this.findById(id);
    Object.assign(cohort, dto);
    await cohort.save();
    return this.toDto(cohort);
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }

  async members(id: string | Types.ObjectId) {
    const cohort = await this.model
      .findById(toObjectId(id))
      .populate('members', 'firstName lastName email avatarUrl status')
      .exec();
    if (!cohort) throw new NotFoundException('Cohorte no encontrada.');
    return cohort.members;
  }

  async addMembers(
    id: string | Types.ObjectId,
    userIds: string[],
  ): Promise<CohortDto> {
    await this.model
      .updateOne(
        { _id: toObjectId(id) },
        { $addToSet: { members: { $each: userIds.map(toObjectId) } } },
      )
      .exec();
    return this.toDto(await this.findById(id));
  }

  async removeMembers(id: string | Types.ObjectId, userIds: string[]): Promise<CohortDto> {
    await this.model
      .updateOne(
        { _id: toObjectId(id) },
        { $pull: { members: { $in: userIds.map(toObjectId) } } },
      )
      .exec();
    return this.toDto(await this.findById(id));
  }

  /** Matricula a todos los miembros de la cohorte en un curso. */
  async syncToCourse(
    cohortId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
    roleShortName = 'student',
  ): Promise<{ enrolled: number }> {
    const cohort = await this.findById(cohortId);
    for (const userId of cohort.members) {
      await this.enrolments.enrol({
        courseId,
        tenantId: cohort.tenant,
        userId,
        roleShortName,
        method: EnrolmentMethod.Cohort,
        cohortId: cohort._id,
      });
    }
    return { enrolled: cohort.members.length };
  }

  async cohortsOfUser(userId: string | Types.ObjectId): Promise<CohortDocument[]> {
    return this.model.find({ members: toObjectId(userId) }).exec();
  }

  private toDto(cohort: CohortDocument): CohortDto {
    return {
      id: cohort.id,
      tenantId: String(cohort.tenant),
      contextId: String(cohort.context),
      name: cohort.name,
      idNumber: cohort.idNumber,
      description: cohort.description,
      visible: cohort.visible,
      memberCount: cohort.members.length,
    };
  }
}
