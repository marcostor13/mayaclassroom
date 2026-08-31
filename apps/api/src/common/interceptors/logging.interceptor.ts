import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { MayaRequest } from '../types/request-context';

/** Traza cada petición con un identificador correlacionable. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<MayaRequest>();
    request.requestId ??= randomUUID();
    request.capabilityCache ??= new Map();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.logger.log(
            `${request.method} ${request.originalUrl} ${ms}ms · tenant=${request.user?.tenantSlug ?? '-'} user=${request.user?.email ?? 'anon'}`,
          );
        },
      }),
    );
  }
}
