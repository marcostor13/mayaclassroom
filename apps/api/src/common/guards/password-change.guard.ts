import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PASSWORD_CHANGE_REQUIRED } from '@maya/shared';
import { ALLOW_PASSWORD_PENDING_KEY } from '../decorators/password-change.decorator';
import type { MayaRequest } from '../types/request-context';

/**
 * Cierra la plataforma a quien todavía usa la contraseña temporal con la que
 * se dio de alta su cuenta. Es la mitad de servidor de la obligación de
 * cambiarla: el cliente redirige a la pantalla de cambio, pero sin este guard
 * bastaría con llamar a la API directamente para saltársela.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<MayaRequest>();
    if (!request.user?.mustChangePassword) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_PENDING_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    throw new ForbiddenException({
      message: 'Debe cambiar su contraseña temporal antes de continuar.',
      error: PASSWORD_CHANGE_REQUIRED,
    });
  }
}
