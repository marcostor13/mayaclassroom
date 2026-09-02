import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
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
import type { ContextDocument } from '../contexts/schemas/context.schema';
import { toObjectId } from '../../common/utils';
import {
  AssignRoleDto,
  BulkAssignRoleDto,
  CreateRoleDto,
  SetCapabilityDto,
  UpdateRoleDto,
} from './dto/role.dto';

/**
 * Quién pregunta.
 *
 * Va como parámetro y no se deduce dentro del servicio porque el mismo método
 * lo usan el controlador —donde hay sesión y empresa— y la siembra y la
 * matriculación, que operan en nombre del sistema.
 */
export interface RoleScope {
  tenantId: string | Types.ObjectId;
  isPlatformAdmin?: boolean;
}

@Injectable()
export class RolesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(RoleCapability.name)
    private readonly capabilityModel: Model<RoleCapabilityDocument>,
    @InjectModel(RoleAssignment.name)
    private readonly assignmentModel: Model<RoleAssignmentDocument>,
    private readonly contexts: ContextsService,
  ) {}

  /**
   * Al arrancar se sincronizan las capacidades nuevas.
   *
   * Va aquí y no en una migración suelta porque el desfase se produce en cada
   * despliegue que añade una capacidad, y una migración que hay que acordarse
   * de lanzar es una migración que no se lanza. La operación no escribe nada
   * si no falta nada.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.syncPresetCapabilities();
    } catch (error) {
      // Un fallo aquí no debe impedir arrancar: la plataforma funciona igual,
      // solo que sin las capacidades nuevas hasta el siguiente intento.
      this.logger.error(`No se pudieron sincronizar las capacidades: ${String(error)}`);
    }
  }

  /* ------------------------------ Roles ---------------------------------- */

  /**
   * Los roles que una empresa ve y puede usar.
   *
   * Cada arquetipo existe dos veces en la base: la copia de la empresa, creada
   * al darla de alta, y la global de la que se clonó. Devolver las dos hacía
   * que la pantalla de roles enseñara «Gestor», «Profesor» y compañía
   * repetidos, y que se pudiera abrir por error la copia global —cuya edición
   * afecta a todas las empresas—.
   *
   * Se queda la de la empresa. La global solo sale cuando la empresa no tiene
   * la suya, que es lo que ocurre con un rol añadido a la plataforma después
   * de haberla dado de alta.
   */
  async list(
    tenantId: string | Types.ObjectId | null,
    options: { isPlatformAdmin?: boolean } = {},
  ): Promise<RoleDocument[]> {
    if (!tenantId) {
      return this.roleModel.find({ tenant: null }).sort({ sortOrder: 1, name: 1 }).exec();
    }

    const tenant = toObjectId(tenantId);
    const roles = await this.roleModel
      .find({ $or: [{ tenant }, { tenant: null }] })
      .sort({ sortOrder: 1, name: 1 })
      .exec();

    const porNombre = new Map<string, RoleDocument>();
    for (const role of roles) {
      const actual = porNombre.get(role.shortName);
      if (!actual || (actual.tenant === null && role.tenant !== null)) {
        porNombre.set(role.shortName, role);
      }
    }

    return [...porNombre.values()].filter(
      // Un rol global que solo se asigna en el sistema —el administrador de
      // plataforma— no pinta nada en la lista de una empresa: ni se puede
      // asignar ahí, ni debe poder editarse desde ahí. Para quien administra
      // la plataforma sí sale: es suyo.
      (role) =>
        options.isPlatformAdmin ||
        role.tenant !== null ||
        role.assignableAt.some((level) => level !== ContextLevel.System),
    );
  }

  /**
   * El rol sobre el que una empresa puede actuar, o un error.
   *
   * Sin esta comprobación bastaba con adivinar un identificador para editar el
   * rol de otra empresa —o, peor, el global, cuya edición se propaga a todas—.
   * Los roles globales quedan reservados a la administración de plataforma.
   */
  async findForTenant(
    id: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    options: { isPlatformAdmin?: boolean; forAssignment?: boolean } = {},
  ): Promise<RoleDocument> {
    const role = await this.findById(id);

    if (role.tenant === null) {
      // Asignar un rol global sí vale: es el que usa una empresa que todavía
      // no tiene copia propia. Editarlo, no.
      if (options.forAssignment || options.isPlatformAdmin) return role;
      throw new ForbiddenException(
        'Ese rol pertenece a la plataforma y no puede editarse desde una empresa.',
      );
    }

    if (String(role.tenant) !== String(toObjectId(tenantId))) {
      // Mismo mensaje que si no existiera: quien pregunta por el rol de otra
      // empresa no debe poder deducir que existe.
      throw new NotFoundException('Rol no encontrado.');
    }
    return role;
  }

  /**
   * Comprueba que un contexto pertenece a la empresa antes de tocar sus
   * asignaciones. El contexto es el otro extremo de la asignación, y sin esta
   * comprobación se podía asignar y retirar roles en cursos de otra empresa.
   */
  private async contextOfTenant(
    contextId: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
    isPlatformAdmin = false,
  ): Promise<ContextDocument> {
    const context = await this.contexts.findById(contextId);
    if (isPlatformAdmin) return context;
    if (context.tenant === null || String(context.tenant) !== String(toObjectId(tenantId))) {
      throw new NotFoundException('Contexto no encontrado.');
    }
    return context;
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

  async update(
    id: string | Types.ObjectId,
    dto: UpdateRoleDto,
    scope: RoleScope,
  ): Promise<RoleDocument> {
    const role = await this.findForTenant(id, scope.tenantId, scope);
    if (role.isSystem && dto.shortName && dto.shortName !== role.shortName) {
      throw new BadRequestException('No se puede renombrar un rol del sistema.');
    }
    Object.assign(role, dto);
    await role.save();
    return role;
  }

  async remove(id: string | Types.ObjectId, scope: RoleScope): Promise<void> {
    const role = await this.findForTenant(id, scope.tenantId, scope);
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
    scope: RoleScope,
    contextId?: string | Types.ObjectId,
  ): Promise<Record<string, PermissionValue>> {
    // Leer la matriz de un rol es leer cómo está configurada una empresa: se
    // comprueba la pertenencia igual que al escribirla.
    await this.findForTenant(roleId, scope.tenantId, { ...scope, forAssignment: true });

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

  async setCapability(
    roleId: string | Types.ObjectId,
    dto: SetCapabilityDto,
    scope: RoleScope,
  ): Promise<void> {
    const role = await this.findForTenant(roleId, scope.tenantId, scope);
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
    scope: RoleScope,
    contextId?: string,
  ): Promise<void> {
    for (const item of items) {
      await this.setCapability(roleId, { ...item, contextId: item.contextId ?? contextId }, scope);
    }
  }

  /* --------------------------- Asignaciones ------------------------------ */

  async assign(dto: AssignRoleDto, scope: RoleScope): Promise<RoleAssignmentDocument> {
    const [role, context] = await Promise.all([
      this.findForTenant(dto.roleId, scope.tenantId, { ...scope, forAssignment: true }),
      this.contextOfTenant(dto.contextId, scope.tenantId, scope.isPlatformAdmin),
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

  async assignMany(dto: BulkAssignRoleDto, scope: RoleScope): Promise<number> {
    let created = 0;
    for (const userId of dto.userIds) {
      await this.assign({ userId, roleId: dto.roleId, contextId: dto.contextId }, scope);
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
    scope?: RoleScope;
  }): Promise<void> {
    if (params.scope) {
      await this.contextOfTenant(
        params.contextId,
        params.scope.tenantId,
        params.scope.isPlatformAdmin,
      );
    }
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

  /**
   * Usuarios que tienen un rol concreto en un contexto, del más antiguo al más
   * reciente. Sirve para dar con quien administra una empresa sin recorrer
   * todas las asignaciones ni destapar el `populate` de `assignmentsInContext`.
   */
  async assigneesByShortName(
    shortName: string,
    contextId: string | Types.ObjectId,
    tenantId?: string | Types.ObjectId | null,
  ): Promise<Types.ObjectId[]> {
    const role = await this.findByShortName(shortName, tenantId);
    if (!role) return [];
    const assignments = await this.assignmentModel
      .find({ role: role._id, context: toObjectId(contextId) })
      .sort({ createdAt: 1 })
      .exec();
    return assignments.map((assignment) => assignment.user);
  }

  async assignmentsInContext(
    contextId: string | Types.ObjectId,
    scope?: RoleScope,
  ): Promise<RoleAssignmentDocument[]> {
    // El ámbito es opcional porque otros módulos llaman a esto ya habiendo
    // resuelto el contexto; desde el controlador siempre viaja.
    if (scope) await this.contextOfTenant(contextId, scope.tenantId, scope.isPlatformAdmin);

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
  /**
   * Borra los roles de una empresa y todo lo que cuelga de ellos. Solo se usa
   * al deshacer un alta fallida: la baja normal es lógica y conserva el rastro.
   */
  async purgeTenantRoles(tenantId: string | Types.ObjectId): Promise<void> {
    const tenant = toObjectId(tenantId);
    const roles = await this.roleModel.find({ tenant }).select('_id').exec();
    const roleIds = roles.map((role) => role._id);

    await this.assignmentModel.deleteMany({ tenant }).exec();
    if (roleIds.length) await this.capabilityModel.deleteMany({ role: { $in: roleIds } }).exec();
    await this.roleModel.deleteMany({ tenant }).exec();
  }

  /**
   * Lleva a las empresas ya existentes las capacidades que se añadieron a los
   * roles predefinidos después de darlas de alta.
   *
   * `provisionPresetRoles` solo se ejecuta al crear la empresa, así que una
   * capacidad nueva —y la pantalla que protege— quedaba invisible para todas
   * las anteriores y solo aparecía en las que se dieran de alta después. Es
   * exactamente lo que pasó con los cobros: el módulo estaba, el menú no.
   *
   * Solo **añade** lo que falta. Nunca reescribe un permiso que ya existe,
   * porque eso borraría los ajustes que una empresa haya hecho a mano sobre
   * sus roles, que es justo para lo que sirve poder editarlos.
   */
  async syncPresetCapabilities(): Promise<number> {
    const porNombreCorto = new Map(ROLE_PRESETS.map((preset) => [preset.shortName, preset]));

    const roles = await this.roleModel
      .find({ isSystem: true, shortName: { $in: [...porNombreCorto.keys()] } })
      .select('shortName')
      .exec();
    if (!roles.length) return 0;

    // Se leen solo los nombres de capacidad: son cadenas, y comparar conjuntos
    // es exacto donde contar sería una aproximación —un rol retocado puede
    // tener más capacidades que el preset y seguir sin la nueva—.
    const existentes = await this.capabilityModel
      .find({ role: { $in: roles.map((role) => role._id) }, context: null })
      .select('role capability')
      .lean()
      .exec();

    const porRol = new Map<string, Set<string>>();
    for (const fila of existentes) {
      const clave = String(fila.role);
      const conjunto = porRol.get(clave) ?? new Set<string>();
      conjunto.add(fila.capability);
      porRol.set(clave, conjunto);
    }

    const operaciones = [];
    for (const role of roles) {
      const preset = porNombreCorto.get(role.shortName);
      if (!preset) continue;
      const yaTiene = porRol.get(String(role._id)) ?? new Set<string>();

      for (const [capability, permission] of Object.entries(presetPermissionMap(preset))) {
        if (yaTiene.has(capability)) continue;
        operaciones.push({
          updateOne: {
            filter: { role: role._id, capability, context: null },
            // `$setOnInsert` y no `$set`: si el documento apareciera entre la
            // lectura y la escritura, se respeta lo que haya.
            update: { $setOnInsert: { permission } },
            upsert: true,
          },
        });
      }
    }

    if (!operaciones.length) return 0;
    await this.capabilityModel.bulkWrite(operaciones);
    this.logger.log(`Capacidades nuevas añadidas a roles existentes: ${operaciones.length}`);
    return operaciones.length;
  }

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
