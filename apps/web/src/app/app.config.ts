import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

/**
 * Restaura la sesión y la marca de la empresa antes de arrancar el enrutador,
 * de modo que los guards ya disponen del usuario y sus capacidades.
 */
function bootstrapSession(): Promise<void> {
  const auth = inject(AuthService);
  const theme = inject(ThemeService);

  if (!auth.accessToken) return Promise.resolve();

  return firstValueFrom(auth.restore())
    .then(async () => {
      const slug = auth.tenantSlug();
      if (!slug) return;
      const profile = await firstValueFrom(auth.tenantProfile(slug)).catch(() => null);
      if (profile) theme.applyBranding(profile.branding);
    })
    .catch(() => {
      auth.clear();
    });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideAppInitializer(bootstrapSession),
  ],
};
