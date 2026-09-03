import { inject } from '@angular/core';
import type { CanMatchFn, ResolveFn } from '@angular/router';
import { HostTenantService } from '../services/host-tenant.service';

/**
 * Deja pasar solo cuando se ha entrado por el dominio propio de una empresa.
 *
 * Es `canMatch` y no `canActivate` por una diferencia que aquí lo es todo: un
 * `canActivate` que dice que no cancela la navegación, mientras que un
 * `canMatch` que dice que no hace que el enrutador siga probando rutas. Con eso
 * la raíz puede declararse dos veces —la página de la empresa primero, la
 * portada de Maya después— y cada dominio se queda con la suya sin que la otra
 * estorbe.
 */
export const dominioPropioGuard: CanMatchFn = async () => {
  const host = inject(HostTenantService);
  return (await host.resolver()) !== null;
};

/**
 * La empresa del dominio, para las páginas públicas servidas en la raíz.
 *
 * Se entrega como dato resuelto de la ruta y no leyendo el servicio dentro del
 * componente: así las mismas páginas sirven en `/p/<empresa>` —donde la empresa
 * llega por parámetro— y en el dominio propio, sin una rama por caso dentro.
 */
export const empresaDelDominio: ResolveFn<string> = async () => {
  const host = inject(HostTenantService);
  return (await host.resolver()) ?? '';
};
