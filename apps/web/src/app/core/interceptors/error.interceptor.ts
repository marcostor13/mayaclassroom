import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { PASSWORD_CHANGE_REQUIRED } from '@maya/shared';
import { ToastService } from '../services/toast.service';

/**
 * Rutas donde un 401 es la respuesta que se está buscando —unas credenciales
 * que no valen— y no una sesión caducada.
 *
 * El 401 se silencia porque, en cualquier otra petición, significa que el
 * testigo expiró: de eso ya se ocupa `authInterceptor` renovándolo o llevando
 * al login, y un aviso ahí solo asusta. Pero al intentar entrar es justo al
 * revés: sin este aviso el formulario se quedaba mudo y parecía que el botón
 * no hacía nada.
 */
const CREDENCIALES = ['/auth/login'];

function esIntentoDeCredenciales(url: string): boolean {
  return CREDENCIALES.some((ruta) => url.includes(ruta));
}

/** Traduce los errores HTTP a avisos legibles para la persona usuaria. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      const silencioso =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !esIntentoDeCredenciales(request.url);

      if (error instanceof HttpErrorResponse && !silencioso) {
        const body = error.error as { message?: string; error?: string; details?: unknown } | null;

        // La API cierra la plataforma a quien no ha cambiado su contraseña
        // temporal. No es un fallo que reportar, sino un desvío.
        if (body?.error === PASSWORD_CHANGE_REQUIRED) {
          void router.navigate(['/password-change']);
          return throwError(() => error);
        }

        const message = body?.message ?? describe(error.status);
        toast.error(
          error.status === 401 ? 'No se pudo entrar' : 'No se pudo completar la operación',
          message,
        );
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
