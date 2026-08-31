import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';
import type { MayaRequest } from '../types/request-context';
import { LogsService } from '../../modules/logs/logs.service';

/** Registra en el log de eventos las acciones marcadas con `@Audit(...)`. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly logs: LogsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!metadata) return next.handle();

    const request = context.switchToHttp().getRequest<MayaRequest>();

    return next.handle().pipe(
      tap((result) => {
        const user = request.user;
        if (!user) return;
        const objectId =
          result && typeof result === 'object' && 'id' in (result as Record<string, unknown>)
            ? String((result as Record<string, unknown>).id)
            : undefined;
        void this.logs.record({
          tenantId: user.tenantId,
          userId: user.id,
          component: 'core',
          target: metadata.target,
          action: metadata.action,
          objectId,
          description: metadata.description ?? `${metadata.action} ${metadata.target}`,
          ip: request.ip ?? '',
          userAgent: (request.headers['user-agent'] as string) ?? '',
        });
      }),
    );
  }
}
