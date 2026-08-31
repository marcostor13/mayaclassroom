import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CAPABILITY_CATALOG,
  ContextLevel,
  PermissionValue,
  ROLE_PRESETS,
  RoleArchetype,
  presetPermissionMap,
} from '@maya/shared';
import { Role, RoleDocument } from './schemas/role.schema';
import { RoleCapability, RoleCapabilityDocument } from './schemas/role-capability.schema';
import { RoleAssignment, RoleAssignmentDocument } from './schemas/role-assignment.schema';
import { ContextsService } from '../contexts/contexts.service';
import { toObjectId } from '../../common/utils';
import {
  AssignRoleDto,
  BulkAssignRoleDto,
  CreateRoleDto,
  SetCapabilityDto,
  UpdateRoleDto,
} from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(RoleCapability.name)
    private readonly capabilityModel: Model<RoleCapabilityDocument>,
    @InjectModel(RoleAssignment.name)
    private readonly assignmentModel: Model<RoleAssignmentDocument>,
    private readonly contexts: ContextsService,
  ) {}

  /* ------------------------------ Roles ---------------------------------- */

  async list(tenantId: string | Types.ObjectId | null): Promise<RoleDocument[]> {
    const filter = tenantId
      ? { $or: [{ tenant: toObjectId(tenantId) }, { tenant: null }] }
      : { tenant: null };
    return this.roleModel.find(filter).sort({ sortOrder: 1, name: 1 }).exec();
  }

  async findById(id: string | Types.ObjectId): Promise<RoleDocument> {
    const role = await this.roleModel.findById(toObjectId(id)).exec();
    if (!role) throw new NotFoundException('Rol no encontrado.');
    return role;
  }

  async findByShortName(
    shortName: string,
    tenantId?: string | Types.ObjectId | null,
  ): Promise<RoleDocument | null> {
    return this.roleModel
      .findOne({
        shortName,
        $or: [{ tenant: tenantId ? toObjectId(tenantId) : null }, { tenant: null }],
      })
      .sort({ tenant: -1 })
      .exec();
  }

  async requireByShortName(
    shortName: string,
    tenantId?: string | Types.ObjectId | null,
  ): Promise<RoleDocument> {
    const role = await this.findByShortName(shortName, tenantId);
    if (!role) throw new NotFoundException(`El rol «${shortName}» no existe.`);
    return role;
  }

  async create(tenantId: string | Types.ObjectId, dto: CreateRoleDto): Promise<RoleDocument> {
    const existing = await this.roleModel
      .findOne({ tenant: toObjectId(tenantId), shortName: dto.shortName })
      .exec();
    if (existing) throw new ConflictException(`Ya existe un rol con el nombre corto «${dto.shortName}».`);

    const role = await this.roleModel.create({
      tenant: toObjectId(tenantId),
      shortName: dto.shortName,
      name: dto.name,
      description: dto.description ?? '',
      assignableAt: dto.assignableAt,
      sortOrder: dto.sortOrder ?? 100,
      isSystem: false,
      archetype: null,
    });

    if (dto.copyFromRoleId) {
      const source = await this.capabilityModel
        .find({ role: toObjectId(dto.copyFromRoleId), context: null })
        .lean()
        .exec();
      if (source.length) {
        await this.capabilityModel.insertMany(
          source.map((c) => ({
            role: role._id,
            capability: c.capability,
            permission: c.permission,
            context: null,
          })),
        );
      }
    }

    return role;
  }

  async update(id: string | Types.ObjectId, dto: UpdateRoleDto): Promise<RoleDocument> {
    const role = await this.findById(id);
    if (role.isSystem && dto.shortName && dto.shortName !== role.shortName) {
      throw new BadRequestException('No se puede renombrar un rol del sistema.');
    }
    Object.assign(role, dto);
    await role.save();
    return role;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const role = await this.findById(id);
    if (role.isSystem) throw new BadRequestException('No se puede eliminar un rol del sistema.');
    const assignments = await this.assignmentModel.countDocuments({ role: role._id }).exec();
    if (assignments > 0) {
      throw new ConflictException(
        `El rol tiene ${assignments} asignaciones activas. Elimínelas antes de borrarlo.`,
      );
    }
    await this.capabilityModel.deleteMany({ role: role._id }).exec();
    await role.deleteOne();
  }

  /* --------------------------- Capacidades ------------------------------- */

  /** Matriz de capacidades de un rol (base + overrides de un contexto). */
  async capabilitiesOf(
    roleId: string | Types.ObjectId,
    contextId?: string | Types.ObjectId,
  ): Promise<Record<string, PermissionValue>> {
    const base = await this.capabilityModel
      .find({ role: toObjectId(roleId), context: null })
      .lean()
      .exec();
    const map: Record<string, PermissionValue> = {};
    for (const definition of CAPABILITY_CATALOG) map[definition.name] = PermissionValue.NotSet;
    for (const item of base) map[item.capability] = item.permission;

    if (contextId) {
      const overrides = await this.capabilityModel
        .find({ role: toObjectId(roleId), context: toObjectId(contextId) })
        .lean()
        .exec();
      for (const item of overrides) map[item.capability] = item.permission;
    }
    return map;
  }

  async setCapability(roleId: string | Types.ObjectId, dto: SetCapabilityDto): Promise<void> {
    const role = await this.findById(roleId);
    const known = CAPABILITY_CATALOG.some((c) => c.name === dto.capability);
    if (!known) throw new BadRequestException(`La capacidad «${dto.capability}» no existe.`);

    const context = dto.contextId ? toObjectId(dto.contextId) : null;

    if (dto.permission === PermissionValue.NotSet) {
      await this.capabilityModel
        .deleteOne({ role: role._id, capability: dto.capability, context })
        .exec();
      return;
    }

    await this.capabilityModel
      .findOneAndUpdate(
        { role: role._id, capability: dto.capability, context },
        { $set: { permission: dto.permission } },
        { upsert: true, new: true },
      )
      .exec();
  }

  async setCapabilities(
    roleId: string | Types.ObjectId,
    items: SetCapabilityDto[],
    contextId?: string,
  ): Promise<void> {
    for (const item of items) {
      await this.setCapability(roleId, { ...item, contextId: item.contextId ?? contextId });
    }
  }

  /* --------------------------- Asignaciones ------------------------------ */

  async assign(dto: AssignRoleDto): Promise<RoleAssignmentDocument> {
    const [role, context] = await Promise.all([
      this.findById(dto.roleId),
      this.contexts.findById(dto.contextId),
    ]);

    if (!role.assignableAt.includes(context.level)) {
      throw new BadRequestException(
        `El rol «${role.name}» no puede asignarse en un contexto de tipo «${context.level}».`,
      );
    }

    const existing = await this.assignmentModel
      .findOne({ user: toObjectId(dto.userId), role: role._id, context: context._id })
      .exec();
    if (existing) return existing;

    return this.assignmentModel.create({
      user: toObjectId(dto.userId),
      role: role._id,
      context: context._id,
      contextPath: context.path,
      tenant: context.tenant,
      component: dto.component ?? 'manual',
    });
  }

  async assignMany(dto: BulkAssignRoleDto): Promise<number> {
    let created = 0;
    for (const userId of dto.userIds) {
      await this.assign({ userId, roleId: dto.roleId, contextId: dto.contextId });
      created += 1;
    }
    return created;
  }

  /** Asignación interna por nombre corto de rol (usada por matriculación y seed). */
  async assignByShortName(params: {
    userId: string | Types.ObjectId;
    shortName: string;
    contextId: string | Types.ObjectId;
    tenantId?: string | Types.ObjectId | null;
    component?: string;
  }): Promise<RoleAssignmentDocument> {
    const role = await this.requireByShortName(params.shortName, params.tenantId);
    const context = await this.contexts.findById(params.contextId);
    const existing = await this.assignmentModel
      .findOne({ user: toObjectId(params.userId), role: role._id, context: context._id })
      .exec();
    if (existing) return existing;
    return this.assignmentModel.create({
      user: toObjectId(params.userId),
      role: role._id,
      context: context._id,
      contextPath: context.path,
      tenant: context.tenant,
      component: params.component ?? 'manual',
    });
  }

  async unassign(params: {
    userId: string | Types.ObjectId;
    roleId: string | Types.ObjectId;
    contextId: string | Types.ObjectId;
  }): Promise<void> {
    await this.assignmentModel
      .deleteOne({
        user: toObjectId(params.userId),
        role: toObjectId(params.roleId),
        context: toObjectId(params.contextId),
      })
      .exec();
  }

  async unassignAllInContext(
    userId: string | Types.ObjectId,
    contextId: string | Types.ObjectId,
  ): Promise<void> {
    await this.assignmentModel
      .deleteMany({ user: toObjectId(userId), context: toObjectId(contextId) })
      .exec();
  }

  async assignmentsInContext(contextId: string | Types.ObjectId): Promise<RoleAssignmentDocument[]> {
    return this.assignmentModel
      .find({ context: toObjectId(contextId) })
      .populate('role')
      .populate('user', 'firstName lastName email avatarUrl')
      .exec();
  }

  async rolesOfUserInContext(
    userId: string | Types.ObjectId,
    contextId: string | Types.ObjectId,
  ): Promise<RoleDocument[]> {
    const assignments = await this.assignmentModel
      .find({ user: toObjectId(userId), context: toObjectId(contextId) })
      .populate<{ role: RoleDocument }>('role')
      .exec();
    return assignments.map((a) => a.role);
  }

  /* ------------------------ Provisión de roles --------------------------- */

  /**
   * Crea (o actualiza) los roles arquetípicos para una empresa. Se ejecuta al
   * crear el tenant y desde el `seed`.
   */
  async provisionPresetRoles(tenantId: string | Types.ObjectId | null): Promise<RoleDocument[]> {
    const tenant = tenantId ? toObjectId(tenantId) : null;
    const roles: RoleDocument[] = [];

    for (const preset of ROLE_PRESETS) {
      // El administrador de plataforma solo existe a nivel global.
      if (preset.archetype === RoleArchetype.PlatformAdmin && tenant) continue;

      let role = await this.roleModel.findOne({ tenant, shortName: preset.shortName }).exec();
      if (!role) {
        role = await this.roleModel.create({
          tenant,
          shortName: preset.shortName,
          name: preset.name,
          description: preset.description,
          archetype: preset.archetype,
          assignableAt: [...preset.assignableAt] as ContextLevel[],
          sortOrder: preset.sortOrder,
          isSystem: true,
        });
      }

      const permissions = presetPermissionMap(preset);
      const operations = Object.entries(permissions).map(([capability, permission]) => ({
        updateOne: {
          filter: { role: role!._id, capability, context: null },
          update: { $set: { permission } },
          upsert: true,
        },
      }));
      if (operations.length) await this.capabilityModel.bulkWrite(operations);
      roles.push(role);
    }

    return roles;
  }
}
