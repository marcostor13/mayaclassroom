import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Exige sesión iniciada. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/auth/login'], { queryParams: { redirect: state.url } });
};

/** Impide entrar en las pantallas de acceso con la sesión ya iniciada. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * Desvía a la pantalla de cambio de contraseña a quien todavía usa la
 * temporal con la que se creó su cuenta. La API aplica la misma regla
 * (`PasswordChangeGuard`), así que esto es comodidad, no seguridad.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.mustChangePassword() ? router.createUrlTree(['/password-change']) : true;
};
