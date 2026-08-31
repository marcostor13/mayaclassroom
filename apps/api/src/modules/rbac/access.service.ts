import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContextLevel, PermissionValue } from '@maya/shared';
import { Context, ContextDocument } from '../contexts/schemas/context.schema';
import { ContextsService } from '../contexts/contexts.service';
import { Role, RoleDocument } from './schemas/role.schema';
import { RoleCapability, RoleCapabilityDocument } from './schemas/role-capability.schema';
import { RoleAssignment, RoleAssignmentDocument } from './schemas/role-assignment.schema';
import { toObjectId } from '../../common/utils';

interface ResolutionInput {
  userId: string | Types.ObjectId;
  isPlatformAdmin?: boolean;
}

/**
 * Resolución de permisos, réplica fiel del algoritmo de Moodle.
 *
 * Para una capacidad y un contexto:
 *  1. Se recogen las asignaciones de rol del usuario en cualquier contexto que
 *     sea ancestro del contexto pedido (o él mismo).
 *  2. Para cada asignación se busca el valor de la capacidad: primero el
 *     override definido en el contexto más cercano, y si no, el valor base del rol.
 *  3. Gana el valor definido en el contexto más profundo. `PROHIBIT` es absoluto
 *     y no puede revertirse en ningún nivel.
 */
@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(RoleCapability.name)
    private readonly capabilityModel: Model<RoleCapabilityDocument>,
    @InjectModel(RoleAssignment.name)
    private readonly assignmentModel: Model<RoleAssignmentDocument>,
    @InjectModel(Context.name) private readonly contextModel: Model<ContextDocument>,
    private readonly contexts: ContextsService,
  ) {}

  /** ¿Tiene el usuario la capacidad en el contexto indicado? */
  async hasCapability(
    user: ResolutionInput,
    capability: string,
    context: ContextDocument | string | Types.ObjectId,
  ): Promise<boolean> {
    if (user.isPlatformAdmin) return true;
    const ctx = await this.resolveContext(context);
    const permission = await this.resolvePermission(user.userId, capability, ctx);
    return permission === PermissionValue.Allow;
  }

  /** Igual que `hasCapability` pero lanza 403 si no se cumple. */
  async requireCapability(
    user: ResolutionInput,
    capability: string,
    context: ContextDocument | string | Types.ObjectId,
    message?: string,
  ): Promise<void> {
    const allowed = await this.hasCapability(user, capability, context);
    if (!allowed) {
      throw new ForbiddenException(
        message ?? `No tiene el permiso «${capability}» en este contexto.`,
      );
    }
  }

  /** Comprueba varias capacidades a la vez. */
  async hasAny(
    user: ResolutionInput,
    capabilities: string[],
    context: ContextDocument | string | Types.ObjectId,
  ): Promise<boolean> {
    if (user.isPlatformAdmin) return true;
    const ctx = await this.resolveContext(context);
    for (const capability of capabilities) {
      if ((await this.resolvePermission(user.userId, capability, ctx)) === PermissionValue.Allow) {
        return true;
      }
    }
    return false;
  }

  async hasAll(
    user: ResolutionInput,
    capabilities: string[],
    context: ContextDocument | string | Types.ObjectId,
  ): Promise<boolean> {
    if (user.isPlatformAdmin) return true;
    const ctx = await this.resolveContext(context);
    for (const capability of capabilities) {
      if ((await this.resolvePermission(user.userId, capability, ctx)) !== PermissionValue.Allow) {
        return false;
      }
    }
    return true;
  }

  /**
   * Devuelve todas las capacidades efectivas del usuario en un contexto.
   * Se usa para precargar los permisos en el cliente y ocultar acciones.
   */
  async effectiveCapabilities(
    user: ResolutionInput,
    context: ContextDocument | string | Types.ObjectId,
  ): Promise<string[]> {
    const ctx = await this.resolveContext(context);
    const assignments = await this.assignmentsFor(user.userId, ctx);
    if (!assignments.length) return [];

    const roleIds = assignments.map((a) => a.role);
    const contextIds = this.contexts.parentIdsFromPath(ctx.path);

    const definitions = await this.capabilityModel
      .find({
        role: { $in: roleIds },
        $or: [{ context: null }, { context: { $in: contextIds } }],
      })
      .lean()
      .exec();

    const depthByContext = await this.depthMap(contextIds);
    const assignmentDepth = new Map<string, number>();
    for (const assignment of assignments) {
      const depth = this.pathDepth(assignment.contextPath);
      const current = assignmentDepth.get(assignment.role.toString()) ?? -1;
      if (depth > current) assignmentDepth.set(assignment.role.toString(), depth);
    }

    const best = new Map<string, { depth: number; permission: PermissionValue }>();
    const prohibited = new Set<string>();

    for (const def of definitions) {
      const roleId = def.role.toString();
      if (!assignmentDepth.has(roleId)) continue;
      if (def.permission === PermissionValue.Prohibit) {
        prohibited.add(def.capability);
        continue;
      }
      const depth = def.context
        ? (depthByContext.get(def.context.toString()) ?? 0) + 1000
        : assignmentDepth.get(roleId)!;
      const current = best.get(def.capability);
      if (!current || depth >= current.depth) {
        best.set(def.capability, { depth, permission: def.permission });
      }
    }

    const result: string[] = [];
    for (const [capability, value] of best) {
      if (prohibited.has(capability)) continue;
      if (value.permission === PermissionValue.Allow) result.push(capability);
    }
    return result.sort();
  }

  /** Roles asignados al usuario, con su contexto, en una rama concreta. */
  async assignmentsFor(
    userId: string | Types.ObjectId,
    ctx: ContextDocument,
  ): Promise<RoleAssignmentDocument[]> {
    const contextIds = this.contexts.parentIdsFromPath(ctx.path);
    const now = new Date();
    return this.assignmentModel
      .find({
        user: toObjectId(userId),
        context: { $in: contextIds },
        $and: [
          { $or: [{ timeStart: null }, { timeStart: { $lte: now } }] },
          { $or: [{ timeEnd: null }, { timeEnd: { $gte: now } }] },
        ],
      })
      .exec();
  }

  /** Roles del usuario en toda la plataforma (para la sesión). */
  async allAssignments(userId: string | Types.ObjectId): Promise<RoleAssignmentDocument[]> {
    return this.assignmentModel
      .find({ user: toObjectId(userId) })
      .populate('role')
      .populate('context')
      .exec();
  }

  /** Usuarios que tienen un rol concreto en un contexto (o sus descendientes). */
  async usersWithRoleInContext(
    ctx: ContextDocument,
    roleShortNames?: string[],
  ): Promise<Types.ObjectId[]> {
    const roleFilter: Record<string, unknown> = {};
    if (roleShortNames?.length) {
      const roles = await this.roleModel.find({ shortName: { $in: roleShortNames } }).lean().exec();
      roleFilter.role = { $in: roles.map((r) => r._id) };
    }
    const assignments = await this.assignmentModel
      .find({ context: ctx._id, ...roleFilter })
      .lean()
      .exec();
    return assignments.map((a) => a.user);
  }

  /** Usuarios que tendrían una capacidad en un contexto (para notificaciones). */
  async usersWithCapability(ctx: ContextDocument, capability: string): Promise<Types.ObjectId[]> {
    const contextIds = this.contexts.parentIdsFromPath(ctx.path);
    const grants = await this.capabilityModel
      .find({ capability, permission: PermissionValue.Allow })
      .lean()
      .exec();
    const roleIds = grants.map((g) => g.role);
    if (!roleIds.length) return [];
    const assignments = await this.assignmentModel
      .find({ role: { $in: roleIds }, context: { $in: contextIds } })
      .lean()
      .exec();
    return Array.from(new Set(assignments.map((a) => a.user.toString()))).map(
      (id) => new Types.ObjectId(id),
    );
  }

  /* --------------------------- Interno ---------------------------------- */

  private async resolvePermission(
    userId: string | Types.ObjectId,
    capability: string,
    ctx: ContextDocument,
  ): Promise<PermissionValue> {
    const assignments = await this.assignmentsFor(userId, ctx);
    if (!assignments.length) return PermissionValue.NotSet;

    const contextIds = this.contexts.parentIdsFromPath(ctx.path);
    const roleIds = Array.from(new Set(assignments.map((a) => a.role.toString()))).map(
      (id) => new Types.ObjectId(id),
    );

    const definitions = await this.capabilityModel
      .find({
        capability,
        role: { $in: roleIds },
        $or: [{ context: null }, { context: { $in: contextIds } }],
      })
      .lean()
      .exec();

    if (!definitions.length) return PermissionValue.NotSet;

    // PROHIBIT es absoluto.
    if (definitions.some((d) => d.permission === PermissionValue.Prohibit)) {
      return PermissionValue.Prohibit;
    }

    const depthByContext = await this.depthMap(contextIds);
    const assignmentDepth = new Map<string, number>();
    for (const assignment of assignments) {
      const depth = this.pathDepth(assignment.contextPath);
      const current = assignmentDepth.get(assignment.role.toString()) ?? -1;
      if (depth > current) assignmentDepth.set(assignment.role.toString(), depth);
    }

    let bestDepth = -1;
    let permission = PermissionValue.NotSet;

    for (const def of definitions) {
      const roleId = def.role.toString();
      if (!assignmentDepth.has(roleId)) continue;
      // Los overrides ganan a la definición base del rol.
      const depth = def.context
        ? (depthByContext.get(def.context.toString()) ?? 0) + 1000
        : assignmentDepth.get(roleId)!;
      if (depth > bestDepth || (depth === bestDepth && def.permission === PermissionValue.Allow)) {
        bestDepth = depth;
        permission = def.permission;
      }
    }

    return permission;
  }

  private async depthMap(contextIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const docs = await this.contextModel
      .find({ _id: { $in: contextIds } })
      .select('_id depth')
      .lean()
      .exec();
    return new Map(docs.map((d) => [d._id.toString(), d.depth]));
  }

  private pathDepth(path: string): number {
    return path.split('/').filter(Boolean).length;
  }

  private async resolveContext(
    context: ContextDocument | string | Types.ObjectId,
  ): Promise<ContextDocument> {
    if (typeof context === 'string' || context instanceof Types.ObjectId) {
      return this.contexts.findById(context);
    }
    return context;
  }

  /** Atajo: contexto de curso a partir de su identificador. */
  async courseContext(courseId: string | Types.ObjectId): Promise<ContextDocument> {
    return this.contexts.requireByInstance(ContextLevel.Course, courseId);
  }

  /** Atajo: contexto de empresa a partir de su identificador. */
  async tenantContext(tenantId: string | Types.ObjectId): Promise<ContextDocument> {
    return this.contexts.requireByInstance(ContextLevel.Tenant, tenantId);
  }
}
