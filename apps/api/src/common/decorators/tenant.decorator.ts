import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { MayaRequest } from '../types/request-context';

/** Inyecta el identificador de la empresa (tenant) activa. */
export const CurrentTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<MayaRequest>();
  return request.user?.tenantId ?? request.tenantId;
});
