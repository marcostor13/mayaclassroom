import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import { Grouping, GroupingDocument } from './schemas/grouping.schema';
import { toObjectId } from '../../common/utils';
import {
  AutoCreateGroupsDto,
  CreateGroupDto,
  CreateGroupingDto,
  UpdateGroupDto,
  UpdateGroupingDto,
} from './dto/group.dto';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Grouping.name) private readonly groupingModel: Model<GroupingDocument>,
  ) {}

  /* -------------------------------- Grupos ------------------------------- */

  async list(courseId: string | Types.ObjectId): Promise<GroupDocument[]> {
    return this.groupModel.find({ course: toObjectId(courseId) }).sort({ name: 1 }).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<GroupDocument> {
    const group = await this.groupModel.findById(toObjectId(id)).exec();
    if (!group) throw new NotFoundException('Grupo no encontrado.');
    return group;
  }

  async create(courseId: string | Types.ObjectId, dto: CreateGroupDto): Promise<GroupDocument> {
    const clash = await this.groupModel
      .findOne({ course: toObjectId(courseId), name: dto.name })
      .exec();
    if (clash) throw new ConflictException(`Ya existe un grupo llamado «${dto.name}».`);
    return this.groupModel.create({ ...dto, course: toObjectId(courseId), members: [] });
  }

  async update(id: string | Types.ObjectId, dto: UpdateGroupDto): Promise<GroupDocument> {
    const group = await this.findById(id);
    Object.assign(group, dto);
    await group.save();
    return group;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const group = await this.findById(id);
    await this.groupingModel
      .updateMany({ groups: group._id }, { $pull: { groups: group._id } })
      .exec();
    await group.deleteOne();
  }

  async addMembers(
    id: string | Types.ObjectId,
    userIds: (string | Types.ObjectId)[],
  ): Promise<GroupDocument> {
    const group = await this.findById(id);
    await this.groupModel
      .updateOne({ _id: group._id }, { $addToSet: { members: { $each: userIds.map(toObjectId) } } })
      .exec();
    return this.findById(id);
  }

  async removeMembers(
    id: string | Types.ObjectId,
    userIds: (string | Types.ObjectId)[],
  ): Promise<GroupDocument> {
    const group = await this.findById(id);
    await this.groupModel
      .updateOne({ _id: group._id }, { $pull: { members: { $in: userIds.map(toObjectId) } } })
      .exec();
    return this.findById(id);
  }

  /** Grupos de un usuario dentro de un curso. */
  async groupsOfUser(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<GroupDocument[]> {
    return this.groupModel
      .find({ course: toObjectId(courseId), members: toObjectId(userId) })
      .exec();
  }

  async areInSameGroup(
    courseId: string | Types.ObjectId,
    userA: string | Types.ObjectId,
    userB: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.groupModel
      .countDocuments({
        course: toObjectId(courseId),
        members: { $all: [toObjectId(userA), toObjectId(userB)] },
      })
      .exec();
    return count > 0;
  }

  async removeUserFromAllGroups(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    await this.groupModel
      .updateMany({ course: toObjectId(courseId) }, { $pull: { members: toObjectId(userId) } })
      .exec();
  }

  /** Creación automática de grupos a partir de la lista de matriculados. */
  async autoCreate(
    courseId: string | Types.ObjectId,
    memberIds: Types.ObjectId[],
    dto: AutoCreateGroupsDto,
  ): Promise<GroupDocument[]> {
    if (!memberIds.length) throw new BadRequestException('No hay participantes que repartir.');

    const members = [...memberIds];
    if ((dto.allocation ?? 'random') === 'random') {
      for (let i = members.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [members[i], members[j]] = [members[j], members[i]];
      }
    }

    const groupCount =
      dto.mode === 'numberOfGroups' ? dto.value : Math.ceil(members.length / dto.value);
    const scheme = dto.namingScheme ?? 'Grupo @';
    const created: GroupDocument[] = [];

    for (let index = 0; index < groupCount; index += 1) {
      const name = scheme.includes('@')
        ? scheme.replace('@', String.fromCharCode(65 + (index % 26)) + (index >= 26 ? Math.floor(index / 26) : ''))
        : `${scheme} ${index + 1}`;
      const slice = members.filter((_, position) => position % groupCount === index);
      const group = await this.groupModel.create({
        course: toObjectId(courseId),
        name,
        members: slice,
      });
      created.push(group);
    }

    if (dto.groupingId) {
      await this.groupingModel
        .updateOne(
          { _id: toObjectId(dto.groupingId) },
          { $addToSet: { groups: { $each: created.map((g) => g._id) } } },
        )
        .exec();
    }
    return created;
  }

  /* ----------------------------- Agrupamientos --------------------------- */

  async listGroupings(courseId: string | Types.ObjectId): Promise<GroupingDocument[]> {
    return this.groupingModel
      .find({ course: toObjectId(courseId) })
      .populate('groups', 'name')
      .sort({ name: 1 })
      .exec();
  }

  async findGrouping(id: string | Types.ObjectId): Promise<GroupingDocument> {
    const grouping = await this.groupingModel.findById(toObjectId(id)).exec();
    if (!grouping) throw new NotFoundException('Agrupamiento no encontrado.');
    return grouping;
  }

  async createGrouping(
    courseId: string | Types.ObjectId,
    dto: CreateGroupingDto,
  ): Promise<GroupingDocument> {
    return this.groupingModel.create({
      course: toObjectId(courseId),
      name: dto.name,
      description: dto.description ?? null,
      idNumber: dto.idNumber ?? null,
      groups: (dto.groupIds ?? []).map(toObjectId),
    });
  }

  async updateGrouping(
    id: string | Types.ObjectId,
    dto: UpdateGroupingDto,
  ): Promise<GroupingDocument> {
    const grouping = await this.findGrouping(id);
    const { groupIds, ...rest } = dto;
    Object.assign(grouping, rest);
    if (groupIds) grouping.groups = groupIds.map(toObjectId);
    await grouping.save();
    return grouping;
  }

  async removeGrouping(id: string | Types.ObjectId): Promise<void> {
    const grouping = await this.findGrouping(id);
    await grouping.deleteOne();
  }

  /** Usuarios que pertenecen a algún grupo del agrupamiento. */
  async membersOfGrouping(id: string | Types.ObjectId): Promise<Types.ObjectId[]> {
    const grouping = await this.findGrouping(id);
    const groups = await this.groupModel.find({ _id: { $in: grouping.groups } }).exec();
    const set = new Set<string>();
    for (const group of groups) for (const member of group.members) set.add(String(member));
    return Array.from(set).map((id) => new Types.ObjectId(id));
  }
}
