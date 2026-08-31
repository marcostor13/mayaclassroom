import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TENANT_HEADER } from '@maya/shared';
import { MayaRequest } from '../types/request-context';

/**
 * Refuerza el aislamiento multiempresa: si la petición declara una empresa
 * (cabecera o subdominio) distinta a la del usuario autenticado, se rechaza,
 * salvo que se trate de un administrador de plataforma.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MayaRequest>();
    const declared = (request.headers[TENANT_HEADER] as string | undefined)?.toLowerCase();
    const user = request.user;

    if (!user) {
      request.tenantSlug = declared;
      return true;
    }

    if (declared && declared !== user.tenantSlug && !user.isPlatformAdmin) {
      throw new ForbiddenException('No tiene acceso a la empresa solicitada.');
    }

    request.tenantId = user.tenantId;
    request.tenantSlug = user.tenantSlug;
    return true;
  }
}
