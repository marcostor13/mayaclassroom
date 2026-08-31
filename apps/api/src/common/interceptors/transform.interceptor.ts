import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { MayaRequest } from '../types/request-context';

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  requestId?: string;
  timestamp: string;
}

/** Envuelve toda respuesta correcta en un sobre uniforme. */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T>> {
    const request = context.switchToHttp().getRequest<MayaRequest>();
    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
