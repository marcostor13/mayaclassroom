import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CourseSummary,
  EnrolmentRequestDto,
  EnrolmentRequestStatus,
  SiteSection,
  SiteSectionType,
  SiteTemplate,
  TenantSiteDto,
} from '@maya/shared';
import { SiteService } from '../../../core/services/site.service';
import { CoursesService } from '../../../core/services/courses.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormatDatePipe, IconComponent, ImageUploadComponent } from '../../../shared';

type Tab = 'diseno' | 'cursos' | 'solicitudes';

/** Nombre legible y descripción de cada tipo de sección, para el editor. */
const SECTION_META: Record<SiteSectionType, { label: string; hint: string }> = {
  [SiteSectionType.Hero]: {
    label: 'Portada',
    hint: 'El primer bloque: titular, frase y botón.',
  },
  [SiteSectionType.Courses]: {
    label: 'Catálogo',
    hint: 'Los cursos marcados para la venta, con su precio.',
  },
  [SiteSectionType.Categories]: {
    label: 'Áreas de formación',
    hint: 'Las categorías que tienen cursos publicados.',
  },
  [SiteSectionType.About]: { label: 'Sobre la empresa', hint: 'Un texto libre.' },
  [SiteSectionType.Testimonials]: { label: 'Testimonios', hint: 'Opiniones del alumnado.' },
  [SiteSectionType.Faq]: { label: 'Preguntas frecuentes', hint: 'Preguntas y respuestas.' },
  [SiteSectionType.Contact]: { label: 'Contacto', hint: 'Los datos de contacto de la empresa.' },
  [SiteSectionType.Cta]: { label: 'Llamada a la acción', hint: 'Un bloque destacado con botón.' },
};

/**
 * Editor de la página pública.
 *
 * Tres pestañas porque son tres tareas distintas y con ritmos distintos: el
 * diseño se toca de vez en cuando, el catálogo cada vez que se publica un
 * curso, y las solicitudes a diario. Mezclarlas en una sola pantalla obligaría
 * a bajar por delante de lo que no interesa.
 */
@Component({
  selector: 'maya-admin-storefront',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, ImageUploadComponent, FormatDatePipe],
  templateUrl: './storefront.page.html',
  styleUrl: './storefront.page.scss',
})
export class AdminStorefrontPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly courses = inject(CoursesService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly SectionType = SiteSectionType;
  readonly RequestStatus = EnrolmentRequestStatus;

  readonly templates = [
    { value: SiteTemplate.Classic, label: 'Clásica', hint: 'Portada amplia y secciones anchas.' },
    { value: SiteTemplate.Focus, label: 'Sobria', hint: 'Compacta y centrada en el texto.' },
    { value: SiteTemplate.Grid, label: 'Rejilla', hint: 'Todo en tarjetas, catálogo por delante.' },
  ];

  readonly tab = signal<Tab>('diseno');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dirty = signal(false);

  readonly data = signal<TenantSiteDto | null>(null);
  readonly catalogue = signal<CourseSummary[]>([]);
  readonly requests = signal<EnrolmentRequestDto[]>([]);

  /** Sección abierta en el editor; solo una a la vez para no marear. */
  readonly openSection = signal<string | null>(null);

  readonly publicUrl = computed(() => {
    const slug = this.auth.tenantSlug();
    return slug ? `${location.origin}/p/${slug}` : '';
  });

  readonly copiado = signal(false);

  /**
   * Copia la dirección de la página al portapapeles.
   *
   * Es la acción que más se repite: publicar sirve de poco si después hay que
   * reconstruir la dirección a mano para pegarla en un correo o en redes.
   */
  async copiarEnlace(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2500);
    } catch {
      this.toast.warning('No se pudo copiar', 'Seleccione la dirección y cópiela a mano.');
    }
  }

  /**
   * Usa el diálogo de compartir del sistema donde exista —en móvil es lo
   * natural— y cae en copiar cuando no está disponible, que es el caso de
   * buena parte de los navegadores de escritorio.
   */
  async compartir(): Promise<void> {
    const url = this.publicUrl();
    const nav = navigator as Navigator & {
      share?: (data: { title: string; text: string; url: string }) => Promise<void>;
    };
    if (!nav.share) return this.copiarEnlace();
    try {
      await nav.share({
        title: 'Nuestros cursos',
        text: 'Eche un vistazo a nuestra oferta de formación:',
        url,
      });
    } catch {
      // Cancelar el diálogo lanza; no es un error que haya que contar.
    }
  }

  /** Dirección para compartir por WhatsApp o por correo, ya montada. */
  readonly enlaceWhatsapp = computed(
    () => `https://wa.me/?text=${encodeURIComponent(`Nuestros cursos: ${this.publicUrl()}`)}`,
  );

  readonly enlaceCorreo = computed(
    () =>
      `mailto:?subject=${encodeURIComponent('Nuestros cursos')}` +
      `&body=${encodeURIComponent(`Eche un vistazo a nuestra formación:\n\n${this.publicUrl()}`)}`,
  );

  readonly pendingCount = computed(
    () => this.requests().filter((r) => r.status === EnrolmentRequestStatus.Pending).length,
  );

  readonly listedCount = computed(
    () => this.catalogue().filter((course) => course.catalog?.listed).length,
  );

  ngOnInit(): void {
    this.site.mine().subscribe({
      next: (site) => {
        this.data.set(site);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.courses.list({ limit: 100 }).subscribe({
      next: (result) => this.catalogue.set(result.items),
    });
    this.loadRequests();
  }

  loadRequests(): void {
    this.site.requests().subscribe({ next: (items) => this.requests.set(items) });
  }

  meta(type: SiteSectionType): { label: string; hint: string } {
    return SECTION_META[type];
  }

  /* --------------------------------- Diseño ------------------------------- */

  setTemplate(template: SiteTemplate): void {
    this.patch((site) => ({ ...site, template }));
  }

  toggleSection(section: SiteSection): void {
    this.replaceSection({ ...section, enabled: !section.enabled });
  }

  /**
   * Mueve una sección. El editor usa botones de subir y bajar en lugar de
   * arrastrar y soltar: funciona igual con el teclado y en una pantalla táctil
   * pequeña, donde arrastrar entre bloques altos es incómodo de verdad.
   */
  move(section: SiteSection, delta: -1 | 1): void {
    const site = this.data();
    if (!site) return;
    const sections = [...site.sections];
    const from = sections.findIndex((s) => s.id === section.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= sections.length) return;
    [sections[from], sections[to]] = [sections[to], sections[from]];
    this.patch((current) => ({ ...current, sections }));
  }

  editField(section: SiteSection, field: keyof SiteSection, value: string | number | null): void {
    this.replaceSection({ ...section, [field]: value === '' ? null : value });
  }

  addItem(section: SiteSection): void {
    const items = [...(section.items ?? []), { title: 'Nuevo', body: '', author: null, imageUrl: null }];
    this.replaceSection({ ...section, items });
  }

  editItem(section: SiteSection, index: number, field: 'title' | 'body' | 'author', value: string): void {
    const items = [...(section.items ?? [])];
    items[index] = { ...items[index], [field]: value };
    this.replaceSection({ ...section, items });
  }

  removeItem(section: SiteSection, index: number): void {
    const items = (section.items ?? []).filter((_, i) => i !== index);
    this.replaceSection({ ...section, items });
  }

  private replaceSection(updated: SiteSection): void {
    this.patch((site) => ({
      ...site,
      sections: site.sections.map((s) => (s.id === updated.id ? updated : s)),
    }));
  }

  private patch(change: (site: TenantSiteDto) => TenantSiteDto): void {
    const site = this.data();
    if (!site) return;
    this.data.set(change(site));
    this.dirty.set(true);
  }

  editContact(field: 'email' | 'phone' | 'address' | 'website', value: string): void {
    this.patch((site) => ({ ...site, contact: { ...site.contact, [field]: value || null } }));
  }

  editSeo(field: 'title' | 'description', value: string): void {
    this.patch((site) => ({ ...site, seo: { ...site.seo, [field]: value || null } }));
  }

  save(): void {
    const site = this.data();
    if (!site || this.saving()) return;
    this.saving.set(true);
    this.site
      .update({
        template: site.template,
        sections: site.sections,
        seo: site.seo,
        contact: site.contact,
      })
      .subscribe({
        next: (saved) => {
          this.data.set(saved);
          this.saving.set(false);
          this.dirty.set(false);
          this.toast.success('Página guardada');
        },
        error: () => this.saving.set(false),
      });
  }

  togglePublished(): void {
    const site = this.data();
    if (!site) return;
    const next = !site.published;
    const act = (): void => {
      this.site.update({ published: next }).subscribe({
        next: (saved) => {
          this.data.set(saved);
          this.toast.success(next ? 'Página publicada' : 'Página retirada');
        },
      });
    };

    if (next) return act();
    this.confirm
      .ask({
        title: 'Retirar la página',
        message: 'Dejará de estar accesible para quien no tenga cuenta. Puede volver a publicarla.',
        confirmLabel: 'Retirar',
      })
      .subscribe((ok) => ok && act());
  }

  /* --------------------------------- Cursos ------------------------------- */

  toggleListed(course: CourseSummary): void {
    const listed = !course.catalog?.listed;
    this.saveCatalog(course, { listed });
  }

  setPrice(course: CourseSummary, euros: string): void {
    // El precio se escribe en euros y se guarda en céntimos: es la frontera
    // entre lo que entiende una persona y lo que no pierde decimales.
    const value = Number(euros.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) return;
    this.saveCatalog(course, { priceCents: Math.round(value * 100) });
  }

  setHeadline(course: CourseSummary, headline: string): void {
    this.saveCatalog(course, { headline: headline || null });
  }

  priceOf(course: CourseSummary): string {
    return ((course.catalog?.priceCents ?? 0) / 100).toFixed(2);
  }

  private saveCatalog(course: CourseSummary, change: Record<string, unknown>): void {
    const catalog = { ...(course.catalog ?? { listed: false, priceCents: 0, currency: 'EUR' }), ...change };
    this.courses.update(course.id, { catalog } as Partial<CourseSummary>).subscribe({
      next: () => {
        this.catalogue.update((list) =>
          list.map((item) => (item.id === course.id ? { ...item, catalog } : item)),
        );
      },
    });
  }

  /* ------------------------------ Solicitudes ----------------------------- */

  resolve(request: EnrolmentRequestDto, status: EnrolmentRequestStatus): void {
    const approving = status === EnrolmentRequestStatus.Approved;
    this.confirm
      .ask({
        title: approving ? 'Aprobar la solicitud' : 'Rechazar la solicitud',
        message: approving
          ? `Se creará la cuenta de ${request.email} si no existía y se matriculará en «${request.course.title}».`
          : `Se rechazará la solicitud de ${request.email}.`,
        confirmLabel: approving ? 'Aprobar' : 'Rechazar',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.site.resolveRequest(request.id, status).subscribe({
          next: (updated) => {
            this.requests.update((list) =>
              list.map((item) => (item.id === updated.id ? updated : item)),
            );
            this.toast.success(approving ? 'Matriculado' : 'Solicitud rechazada');
          },
        });
      });
  }

  statusLabel(status: EnrolmentRequestStatus): string {
    switch (status) {
      case EnrolmentRequestStatus.Approved:
        return 'Aprobada';
      case EnrolmentRequestStatus.Rejected:
        return 'Rechazada';
      default:
        return 'Pendiente';
    }
  }
}
