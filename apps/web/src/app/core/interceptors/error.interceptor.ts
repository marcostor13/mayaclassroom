import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

const SILENT = [401];

/** Traduce los errores HTTP a avisos legibles para la persona usuaria. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !SILENT.includes(error.status)) {
        const body = error.error as { message?: string; details?: unknown } | null;
        const message = body?.message ?? describe(error.status);
        toast.error('No se pudo completar la operación', message);
      }
      return throwError(() => error);
    }),
  );
};

function describe(status: number): string {
  switch (status) {
    case 0:
      return 'No hay conexión con el servidor.';
    case 403:
      return 'No tiene permisos suficientes para esta acción.';
    case 404:
      return 'El recurso solicitado no existe.';
    case 409:
      return 'El recurso ya existe o está en uso.';
    case 422:
      return 'Los datos enviados no son válidos.';
    case 429:
      return 'Demasiadas peticiones. Inténtelo de nuevo en unos instantes.';
    default:
      return status >= 500
        ? 'Se ha producido un error en el servidor.'
        : 'La petición no se ha podido completar.';
  }
}
