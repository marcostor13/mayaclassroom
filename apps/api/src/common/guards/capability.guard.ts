import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ContextLevel } from '@maya/shared';
import { CAPABILITY_KEY, CapabilityRequirement } from '../decorators/capability.decorator';
import { PLATFORM_ADMIN_KEY } from '../decorators/platform-admin.decorator';
import type { MayaRequest } from '../types/request-context';
import { AccessService } from '../../modules/rbac/access.service';
import { ContextsService } from '../../modules/contexts/contexts.service';

/**
 * Guard de autorización basado en capacidades. Resuelve el contexto a partir
 * del nivel declarado y del parámetro de ruta/consulta/cuerpo indicado.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<MayaRequest>();

    const platformAdminOnly = this.reflector.getAllAndOverride<boolean>(PLATFORM_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (platformAdminOnly) {
      if (!request.user?.isPlatformAdmin) {
        throw new ForbiddenException('Solo disponible para administradores de plataforma.');
      }
      return true;
    }

    const requirement = this.reflector.getAllAndOverride<CapabilityRequirement>(CAPABILITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirement) return true;

    const user = request.user;
    if (!user) throw new ForbiddenException('Se requiere autenticación.');
    if (user.isPlatformAdmin) return true;

    const ctx = await this.resolveContext(requirement, request);
    const input = { userId: user.id, isPlatformAdmin: user.isPlatformAdmin };

    const granted =
      requirement.mode === 'all'
        ? await this.access.hasAll(input, requirement.capabilities, ctx)
        : await this.access.hasAny(input, requirement.capabilities, ctx);

    if (!granted) {
      throw new ForbiddenException(
        `Permiso insuficiente. Se requiere: ${requirement.capabilities.join(' o ')}.`,
      );
    }
    return true;
  }

  private async resolveContext(requirement: CapabilityRequirement, request: MayaRequest) {
    if (requirement.contextLevel === ContextLevel.System) {
      return this.contexts.getSystemContext();
    }

    if (requirement.contextLevel === ContextLevel.Tenant || !requirement.param) {
      const tenantId = request.user?.tenantId ?? request.tenantId;
      if (!tenantId) throw new ForbiddenException('No se ha podido determinar la empresa.');
      return this.contexts.requireByInstance(ContextLevel.Tenant, tenantId);
    }

    const params = request.params as Record<string, string>;
    const query = request.query as Record<string, string>;
    const body = (request.body ?? {}) as Record<string, string>;
    const instanceId = params?.[requirement.param] ?? query?.[requirement.param] ?? body?.[requirement.param];

    if (!instanceId) {
      throw new NotFoundException(`Falta el parámetro «${requirement.param}» para evaluar permisos.`);
    }
    return this.contexts.requireByInstance(requirement.contextLevel, instanceId);
  }
}
