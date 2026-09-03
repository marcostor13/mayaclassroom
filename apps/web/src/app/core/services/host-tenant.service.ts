import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { HostResolutionDto } from '@maya/shared';
import { ApiService } from './api.service';

/**
 * Qué empresa sirve el dominio por el que se ha entrado.
 *
 * En el dominio de la plataforma la respuesta es «ninguna» y todo funciona
 * como siempre: la portada vende el producto y las páginas públicas viven en
 * `/p/<empresa>`. En el dominio propio de una empresa la raíz **es** su página
 * pública, y el prefijo sobra.
 *
 * Se pregunta a la API en lugar de deducirlo del nombre porque el cliente se
 * compila una sola vez para todos los dominios: en el paquete no hay nada que
 * distinga `cursos.dulcelima.pe` de `mayaclassroom.pe`. La respuesta se guarda
 * para toda la sesión —el dominio no cambia mientras la pestaña esté abierta—
 * así que la consulta se hace una vez y las rutas la leen ya resuelta.
 */
@Injectable({ providedIn: 'root' })
export class HostTenantService {
  private readonly api = inject(ApiService);

  private readonly slugSignal = signal<string | null>(null);
  private pendiente: Promise<string | null> | null = null;

  /** La empresa del dominio actual, o `null` si es el de la plataforma. */
  readonly tenantSlug = this.slugSignal.asReadonly();

  /** ¿Estamos en el dominio propio de una empresa? */
  readonly esDominioPropio = computed(() => this.slugSignal() !== null);

  /**
   * Resuelve el dominio una sola vez.
   *
   * Los fallos se tratan como «dominio de la plataforma»: si la API no
   * contesta, lo peor que puede pasar es que la página pública se sirva en su
   * dirección larga, y eso es mejor que una pantalla en blanco.
   */
  resolver(): Promise<string | null> {
    this.pendiente ??= firstValueFrom(
      this.api.get<HostResolutionDto>('/tenants/resolve', { host: window.location.hostname }),
    )
      .then((respuesta) => {
        this.slugSignal.set(respuesta?.tenantSlug ?? null);
        return this.slugSignal();
      })
      .catch(() => null);

    return this.pendiente;
  }

  /* ------------------------- Direcciones del escaparate ------------------- */

  /**
   * La raíz de la página pública de una empresa, en segmentos para `navigate`.
   *
   * En su propio dominio la raíz es `/`; en el de la plataforma, `/p/<empresa>`.
   * Todas las direcciones del escaparate se arman con esto para que un enlace
   * no devuelva a quien navega a la dirección larga a mitad de la visita.
   */
  rutaPublica(slug: string, ...segmentos: string[]): string[] {
    const raiz = this.sirveA(slug) ? ['/'] : ['/p', slug];
    return [...raiz, ...segmentos];
  }

  /** Lo mismo para un `href`, que necesita la dirección ya escrita. */
  enlacePublico(slug: string, ...segmentos: string[]): string {
    const raiz = this.sirveA(slug) ? '' : `/p/${slug}`;
    const cola = segmentos.length ? `/${segmentos.join('/')}` : '';
    return `${raiz}${cola}` || '/';
  }

  /** ¿Es esta empresa la dueña del dominio por el que se ha entrado? */
  private sirveA(slug: string): boolean {
    return this.slugSignal() !== null && this.slugSignal() === slug;
  }
}
