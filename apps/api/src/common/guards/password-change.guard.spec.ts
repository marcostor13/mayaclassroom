import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PASSWORD_CHANGE_REQUIRED } from '@maya/shared';
import { PasswordChangeGuard } from './password-change.guard';
import { ALLOW_PASSWORD_PENDING_KEY } from '../decorators/password-change.decorator';

function contextFor(user: { mustChangePassword: boolean } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

/** `Reflector` que responde lo mismo para cualquier manejador. */
function reflectorWith(allowed: boolean): Reflector {
  return {
    getAllAndOverride: (key: string) => (key === ALLOW_PASSWORD_PENDING_KEY ? allowed : undefined),
  } as unknown as Reflector;
}

describe('PasswordChangeGuard · contraseña temporal pendiente', () => {
  it('deja pasar a quien ya tiene contraseña propia', () => {
    const guard = new PasswordChangeGuard(reflectorWith(false));
    expect(guard.canActivate(contextFor({ mustChangePassword: false }))).toBe(true);
  });

  it('deja pasar las peticiones sin sesión (rutas públicas)', () => {
    const guard = new PasswordChangeGuard(reflectorWith(false));
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('bloquea el resto de la API mientras la contraseña sea temporal', () => {
    const guard = new PasswordChangeGuard(reflectorWith(false));
    expect(() => guard.canActivate(contextFor({ mustChangePassword: true }))).toThrow(
      ForbiddenException,
    );
  });

  it('identifica el bloqueo con un código propio, no como un permiso cualquiera', () => {
    const guard = new PasswordChangeGuard(reflectorWith(false));
    try {
      guard.canActivate(contextFor({ mustChangePassword: true }));
      throw new Error('debería haber lanzado');
    } catch (error) {
      const body = (error as ForbiddenException).getResponse() as { error?: string };
      expect(body.error).toBe(PASSWORD_CHANGE_REQUIRED);
    }
  });

  it('permite los endpoints marcados para completar el cambio', () => {
    const guard = new PasswordChangeGuard(reflectorWith(true));
    expect(guard.canActivate(contextFor({ mustChangePassword: true }))).toBe(true);
  });
});
