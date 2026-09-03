import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import type { PublicCourseDto, PublicSiteDto } from '@maya/shared';
import { HostTenantService } from '../../core/services/host-tenant.service';
import { SiteService } from '../../core/services/site.service';
import { ThemeService } from '../../core/services/theme.service';
import { GuideTourComponent, IconComponent, SiteRenderComponent } from '../../shared';
import type { SiteRenderData } from '../../shared';
import { DEMO_TOUR, DEMO_TOUR_KEY } from './demo-tour';

/**
 * Escaparate público de una empresa.
 *
 * Vive fuera del armazón de la aplicación —sin barra lateral ni sesión— porque
 * su público es quien todavía no es alumno. Lo que se pinta y en qué orden lo
 * decide la propia empresa desde el editor: aquí solo se cargan los datos y se
 * entregan al renderizador, que es el mismo componente que usa el editor.
 */
@Component({
  selector: 'maya-site-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SiteRenderComponent, GuideTourComponent],
  templateUrl: './site-public.page.html',
  styleUrl: './site-public.page.scss',
})
export class SitePublicPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly theme = inject(ThemeService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly host = inject(HostTenantService);

  readonly slug = input.required<string>();

  readonly data = signal<PublicSiteDto | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly categoryFilter = signal('');

  /* --------------------------- Recorrido guiado --------------------------- */

  readonly tour = DEMO_TOUR;
  readonly tourAbierto = signal(false);
  readonly tourPaso = signal(0);

  /**
   * Se ofrece, no se impone.
   *
   * Arranca solo la primera visita de este navegador y con un pequeño retraso
   * —lo justo para que la página haya pintado— y a partir de ahí queda en el
   * botón flotante. Un recorrido que se abre en cada visita es un recorrido
   * que se cierra sin leer.
   */
  private ofrecerTour(): void {
    let visto = true;
    try {
      visto = localStorage.getItem(DEMO_TOUR_KEY) === '1';
    } catch {
      // Almacenamiento bloqueado (navegación privada, ajustes estrictos): se
      // trata como «ya visto» para no insistir en cada carga.
    }
    if (visto) return;
    setTimeout(() => this.abrirTour(), 1200);
  }

  abrirTour(): void {
    this.tourPaso.set(0);
    this.tourAbierto.set(true);
  }

  siguientePaso(): void {
    const siguiente = this.tourPaso() + 1;
    if (siguiente >= this.tour.length) return this.cerrarTour();
    this.tourPaso.set(siguiente);
  }

  pasoAnterior(): void {
    this.tourPaso.update((paso) => Math.max(0, paso - 1));
  }

  cerrarTour(): void {
    this.tourAbierto.set(false);
    try {
      localStorage.setItem(DEMO_TOUR_KEY, '1');
    } catch {
      // Sin almacenamiento el recorrido se volverá a ofrecer; es inofensivo.
    }
  }

  readonly render = computed<SiteRenderData | null>(() => {
    const d = this.data();
    if (!d) return null;
    return {
      tenant: d.tenant,
      template: d.site.template,
      contact: d.site.contact,
      courses: d.courses,
      categories: d.categories,
    };
  });

  ngOnInit(): void {
    this.site.publicSite(this.slug()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
        this.title.setTitle(data.site.seo.title || data.tenant.name);
        if (data.site.seo.description) {
          this.meta.updateTag({ name: 'description', content: data.site.seo.description });
        }
        // La marca de la empresa manda también fuera del aula: es su página.
        if (data.tenant.primaryColor) {
          this.theme.applyBranding({
            primaryColor: data.tenant.primaryColor,
            accentColor: data.tenant.accentColor ?? data.tenant.primaryColor,
            logoUrl: data.tenant.logoUrl,
          });
        }
        this.ofrecerTour();
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * Abre la ficha de venta del curso.
   *
   * Se navega por el nombre corto y no por el identificador: la dirección se
   * comparte por mensajería y por redes, y `…/c/ang-22` dice de qué va mientras
   * que veinticuatro caracteres hexadecimales no dicen nada.
   */
  abrirCurso(course: PublicCourseDto): void {
    void this.router.navigate(this.host.rutaPublica(this.slug(), 'c', course.slug || course.id));
  }
}
