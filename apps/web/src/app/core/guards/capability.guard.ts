import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/**
 * Restringe una ruta a quienes tengan alguna de las capacidades indicadas en
 * `data.capabilities`.
 */
export const capabilityGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const required = (route.data['capabilities'] as string[] | undefined) ?? [];
  if (!required.length || auth.canAny(required)) return true;

  toast.warning('Acceso restringido', 'No tiene permisos para acceder a esta sección.');
  return router.createUrlTree(['/dashboard']);
};

/** Restringe la ruta a administradores de plataforma. */
export const platformAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isPlatformAdmin() ? true : router.createUrlTree(['/dashboard']);
};
