import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_IN_DEMO_KEY } from '../decorators/demo.decorator';
import type { MayaRequest } from '../types/request-context';

/** Métodos que no cambian nada y por tanto nunca hay que frenar. */
const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Lo que una sesión de demostración no puede tocar.
 *
 * La empresa de demostración la comparten todos los visitantes a la vez y se
 * entra sin credenciales: quien pulsa «ver la demostración» recibe una cuenta
 * de gestión con todas las capacidades de un cliente de verdad. Eso está bien
 * para enseñar el producto y muy mal para el resto: bastaba con vaciar los
 * roles, borrar las otras cuentas de demostración o dar de alta un webhook
 * para dejar la demostración inservible —o para usar el servidor de la
 * plataforma como emisor de peticiones a donde fuese—.
 *
 * La línea que se traza aquí es entre **enseñar** y **administrar**. Crear un
 * curso, corregir una entrega o dar una clase en vivo se permiten: son lo que
 * la visita ha venido a ver, y lo peor que dejan es una demostración
 * desordenada, que `bun run seed` rehace. Los usuarios, los roles, el dominio
 * propio, los webhooks, los tokens, las copias de seguridad y las
 * credenciales de cobro se deniegan: de eso no se vuelve con una siembra.
 *
 * Se deniega por omisión. Lo que puede escribirse lleva `@AllowInDemo()`.
 */
@Injectable()
export class DemoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Los sockets de las aulas en vivo no pasan por aquí; su entrada la
    // controla `LiveGateway`, que solo reparte señalización de la sala.
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<MayaRequest>();
    if (!request.user?.isDemo) return true;
    if (LECTURA.has(request.method)) return true;

    const permitido = this.reflector.getAllAndOverride<boolean>(ALLOW_IN_DEMO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permitido) return true;

    throw new ForbiddenException(
      'La demostración es de solo lectura en esta parte. Cree su propia cuenta para configurar ' +
        'usuarios, roles y ajustes de la empresa.',
    );
  }
}
