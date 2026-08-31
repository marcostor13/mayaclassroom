import type { ExecutionContext} from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { MayaRequest, RequestUser } from '../types/request-context';

/** Inyecta el usuario autenticado (o una de sus propiedades). */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<MayaRequest>();
    const user = request.user;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
