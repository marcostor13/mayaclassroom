import type { ExecutionContext} from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { MayaRequest } from '../types/request-context';

/** Inyecta el identificador de la empresa (tenant) activa. */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<MayaRequest>();
  return request.user?.tenantId ?? request.tenantId;
});
