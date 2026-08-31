import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { TENANT_HEADER } from '@maya/shared';
import { AuthService } from '../services/auth.service';

let refreshing = false;
const refreshed = new BehaviorSubject<string | null>(null);

/**
 * Añade el token de acceso y la empresa activa a cada petición. Ante un 401
 * intenta renovar la sesión una sola vez y reintenta la petición original.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const isAuthEndpoint = /\/auth\/(login|register|refresh|forgot-password|reset-password)/.test(
    request.url,
  );

  const withCredentials = (token: string | null) =>
    request.clone({
      setHeaders: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(auth.tenantSlug() ? { [TENANT_HEADER]: auth.tenantSlug() } : {}),
      },
    });

  return next(withCredentials(auth.accessToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }
      if (!auth.refreshToken) {
        auth.clear();
        return throwError(() => error);
      }

      if (refreshing) {
        return refreshed.pipe(
          filter((token): token is string => token !== null),
          take(1),
          switchMap((token) => next(withCredentials(token))),
        );
      }

      refreshing = true;
      refreshed.next(null);

      return auth.refreshSession().pipe(
        switchMap((tokens) => {
          refreshing = false;
          refreshed.next(tokens.accessToken);
          return next(withCredentials(tokens.accessToken));
        }),
        catchError((refreshError: unknown) => {
          refreshing = false;
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
