import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { DemoGuard } from './demo.guard';
import { ALLOW_IN_DEMO_KEY } from '../decorators/demo.decorator';

/** Contexto de ejecución de mentira con lo justo que mira el guard. */
function contexto(options: {
  method: string;
  isDemo?: boolean;
  permitido?: boolean;
  tipo?: string;
}): ExecutionContext {
  const handler = () => undefined;
  const clase = class {};
  return {
    getType: () => options.tipo ?? 'http',
    getHandler: () => handler,
    getClass: () => clase,
    switchToHttp: () => ({
      getRequest: () => ({
        method: options.method,
        user: options.isDemo === undefined ? undefined : { isDemo: options.isDemo },
      }),
    }),
  } as unknown as ExecutionContext;
}

function guard(permitido: boolean): DemoGuard {
  const reflector = {
    getAllAndOverride: (clave: string) => (clave === ALLOW_IN_DEMO_KEY ? permitido : undefined),
  } as unknown as Reflector;
  return new DemoGuard(reflector);
}

describe('DemoGuard · qué puede escribir una visita', () => {
  it('deja leer todo, que es a lo que la visita ha venido', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard(false).canActivate(contexto({ method, isDemo: true }))).toBe(true);
    }
  });

  it('deniega por omisión cualquier escritura de una sesión de demostración', () => {
    // Es la regla que importa: un endpoint nuevo nace cerrado para la
    // demostración, sin que nadie tenga que acordarse de prohibirlo.
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(() => guard(false).canActivate(contexto({ method, isDemo: true }))).toThrow(
        /solo lectura/i,
      );
    }
  });

  it('deja pasar lo marcado como contenido docente', () => {
    expect(guard(true).canActivate(contexto({ method: 'POST', isDemo: true }))).toBe(true);
  });

  it('no estorba a una sesión de verdad', () => {
    // La misma cuenta de gestión que enseña la demostración puede usarla una
    // persona con su contraseña, y esa sesión no está limitada.
    expect(guard(false).canActivate(contexto({ method: 'DELETE', isDemo: false }))).toBe(true);
  });

  it('no estorba a una petición sin sesión', () => {
    expect(guard(false).canActivate(contexto({ method: 'POST' }))).toBe(true);
  });

  it('se aparta de lo que no es HTTP', () => {
    // La señalización de las aulas en vivo va por socket y la controla
    // `LiveGateway`, no esto.
    expect(guard(false).canActivate(contexto({ method: 'POST', isDemo: true, tipo: 'ws' }))).toBe(
      true,
    );
  });
});
