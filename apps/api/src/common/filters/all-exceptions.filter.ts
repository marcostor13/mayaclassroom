import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { MayaRequest } from '../types/request-context';

interface NormalizedError {
  status: number;
  message: string;
  error: string;
  details?: unknown;
}

/** Filtro global: normaliza cualquier excepción a un cuerpo de error uniforme. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<MayaRequest>();

    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${normalized.status} ${normalized.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${normalized.status} ${normalized.message}`);
    }

    response.status(normalized.status).json({
      success: false,
      statusCode: normalized.status,
      message: normalized.message,
      error: normalized.error,
      details: normalized.details,
      path: request.url,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { status, message: payload, error: exception.name };
      }
      const body = payload as Record<string, unknown>;
      const message = Array.isArray(body.message)
        ? (body.message as string[]).join('; ')
        : String(body.message ?? exception.message);
      return {
        status,
        message,
        error: String(body.error ?? exception.name),
        details: Array.isArray(body.message) ? body.message : undefined,
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Los datos enviados no son válidos.',
        error: 'ValidationError',
        details: Object.entries(exception.errors).map(([field, err]) => ({
          field,
          message: err.message,
        })),
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `El valor de «${exception.path}» no es válido.`,
        error: 'CastError',
      };
    }

    const mongoError = exception as MongoServerError;
    if (mongoError?.code === 11000) {
      const fields = Object.keys(mongoError.keyPattern ?? {});
      return {
        status: HttpStatus.CONFLICT,
        message: `Ya existe un registro con el mismo valor en: ${fields.join(', ') || 'campo único'}.`,
        error: 'DuplicateKey',
        details: mongoError.keyValue,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        exception instanceof Error ? exception.message : 'Se ha producido un error inesperado.',
      error: 'InternalServerError',
    };
  }
}
