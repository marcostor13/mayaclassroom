import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { OrderStatus, PaymentProvider, SiteTemplate } from '@maya/shared';
import type {
  CourseSummary,
  EnrolmentRequestDto,
  OrderDto,
  PublicCourseDto,
  SiteSection,
  TenantSiteDto,
} from '@maya/shared';
import { EnrolmentRequestStatus } from '@maya/shared';
import { SiteService } from '../../../core/services/site.service';
import { CoursesService } from '../../../core/services/courses.service';
import { CommerceService } from '../../../core/services/commerce.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { FormatDatePipe, IconComponent } from '../../../shared';
import type { SiteRenderData } from '../../../shared';
import { PageBuilderComponent } from './page-builder/page-builder.component';

type Tab = 'diseno' | 'cursos' | 'pedidos' | 'solicitudes';

/**
 * Página pública de la empresa.
 *
 * El diseño ocupa la pestaña principal y es una sola vista: la página real,
 * editable pulsando sobre cada bloque. Las otras tres pestañas son las tareas
 * que la acompañan y tienen ritmos distintos —el catálogo se toca al publicar
 * un curso, los pedidos y las solicitudes a diario—, así que separarlas evita
 * bajar por delante de lo que no interesa.
 */
@Component({
  selector: 'maya-admin-storefront',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, FormatDatePipe, PageBuilderComponent],
  templateUrl: './storefront.page.html',
  styleUrl: './storefront.page.scss',
})
export class AdminStorefrontPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly courses = inject(CoursesService);
  private readonly commerce = inject(CommerceService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly RequestStatus = EnrolmentRequestStatus;
  readonly OrderState = OrderStatus;

  readonly templates = [
    { value: SiteTemplate.Classic, label: 'Clásica', hint: 'Portada amplia y secciones anchas.' },
    { value: SiteTemplate.Focus, label: 'Sobria', hint: 'Compacta y centrada en el texto.' },
    { value: SiteTemplate.Grid, label: 'Rejilla', hint: 'Todo en tarjetas, catálogo por delante.' },
  ];

  readonly tab = signal<Tab>('diseno');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  readonly copiado = signal(false);

  readonly data = signal<TenantSiteDto | null>(null);
  readonly catalogue = signal<CourseSummary[]>([]);
  readonly requests = signal<EnrolmentRequestDto[]>([]);
  readonly orders = signal<OrderDto[]>([]);

  readonly secciones = signal<SiteSection[]>([]);

  readonly publicUrl = computed(() => {
    const slug = this.auth.tenantSlug();
    return slug ? `${location.origin}/p/${slug}` : '';
  });

  readonly pendingCount = computed(
    () => this.requests().filter((r) => r.status === EnrolmentRequestStatus.Pending).length,
  );

  readonly pendingOrders = computed(
    () => this.orders().filter((o) => o.status === OrderStatus.Pending).length,
  );

  readonly listedCount = computed(
    () => this.catalogue().filter((course) => course.catalog?.listed).length,
  );

  /**
   * Lo que ve el lienzo.
   *
   * Los cursos del catálogo se traducen a la forma pública para que el bloque
   * de catálogo se pinte con los cursos de verdad y no con marcadores: lo que
   * se está diseñando es cómo quedará con este contenido, no con uno inventado.
   */
  readonly render = computed<SiteRenderData | null>(() => {
    const site = this.data();
    if (!site) return null;
    const listados = this.catalogue().filter((course) => course.catalog?.listed);

    return {
      tenant: {
        id: '',
        slug: this.auth.tenantSlug() ?? '',
        // El nombre visible sale del título de la página; la sesión solo
        // conoce la referencia corta de la empresa.
        name: site.seo.title || this.auth.tenantSlug() || 'Su empresa',
        logoUrl: null,
        primaryColor: null,
        accentColor: null,
      },
      template: site.template,
      contact: site.contact,
      courses: listados.map((course) => this.aPublico(course)),
      categories: this.categoriasDe(listados),
    };
  });

  private aPublico(course: CourseSummary): PublicCourseDto {
    return {
      id: course.id,
      slug: course.shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: course.fullName,
      summary: course.summary,
      imageUrl: course.imageUrl,
      categoryId: course.categoryId,
      categoryName: course.categoryName ?? null,
      tags: [],
      catalog: course.catalog ?? { listed: false, priceCents: 0, currency: 'EUR' },
      enrolledCount: course.enrolledCount ?? 0,
    };
  }

  private categoriasDe(
    courses: CourseSummary[],
  ): { id: string; name: string; courseCount: number }[] {
    const cuenta = new Map<string, { name: string; count: number }>();
    for (const course of courses) {
      if (!course.categoryId) continue;
      const entrada = cuenta.get(course.categoryId);
      if (entrada) entrada.count += 1;
      else cuenta.set(course.categoryId, { name: course.categoryName ?? '', count: 1 });
    }
    return [...cuenta.entries()]
      .map(([id, { name, count }]) => ({ id, name, courseCount: count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  ngOnInit(): void {
    this.site.mine().subscribe({
      next: (site) => {
        this.data.set(site);
        this.secciones.set(site.sections);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.courses.list({ limit: 100 }).subscribe({
      next: (result) => this.catalogue.set(result.items),
    });
    this.loadRequests();
    this.loadOrders();
  }

  loadRequests(): void {
    this.site.requests().subscribe({ next: (items) => this.requests.set(items) });
  }

  loadOrders(): void {
    this.commerce.orders().subscribe({ next: (items) => this.orders.set(items) });
  }

  /* --------------------------------- Diseño ------------------------------- */

  marcarSucio(): void {
    this.dirty.set(true);
  }

  setTemplate(template: SiteTemplate): void {
    const site = this.data();
    if (!site) return;
    this.data.set({ ...site, template });
    this.dirty.set(true);
  }

  save(): void {
    const site = this.data();
    if (!site || this.saving()) return;
    this.saving.set(true);
    this.site
      .update({
        template: site.template,
        sections: this.secciones(),
        seo: site.seo,
        contact: site.contact,
      })
      .subscribe({
        next: (saved) => {
          this.data.set(saved);
          this.secciones.set(saved.sections);
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
      // Publicar guarda también lo que esté sin guardar: pulsar «Publicar» y
      // que salga la versión anterior sería lo contrario de lo que se pidió.
      this.site
        .update({
          published: next,
          template: site.template,
          sections: this.secciones(),
          seo: site.seo,
          contact: site.contact,
        })
        .subscribe({
          next: (saved) => {
            this.data.set(saved);
            this.secciones.set(saved.sections);
            this.dirty.set(false);
            this.toast.success(
              next ? 'Página publicada' : 'Página retirada',
              next ? 'Ya está accesible en su dirección pública.' : undefined,
            );
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

  editContact(field: 'email' | 'phone' | 'address' | 'website', value: string): void {
    const site = this.data();
    if (!site) return;
    this.data.set({ ...site, contact: { ...site.contact, [field]: value || null } });
    this.dirty.set(true);
  }

  editSeo(field: 'title' | 'description', value: string): void {
    const site = this.data();
    if (!site) return;
    this.data.set({ ...site, seo: { ...site.seo, [field]: value || null } });
    this.dirty.set(true);
  }

  /* ------------------------------- Compartir ------------------------------ */

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

  readonly enlaceWhatsapp = computed(
    () => `https://wa.me/?text=${encodeURIComponent(`Nuestros cursos: ${this.publicUrl()}`)}`,
  );

  readonly enlaceCorreo = computed(
    () =>
      `mailto:?subject=${encodeURIComponent('Nuestros cursos')}` +
      `&body=${encodeURIComponent(`Eche un vistazo a nuestra formación:\n\n${this.publicUrl()}`)}`,
  );

  /* --------------------------------- Cursos ------------------------------- */

  toggleListed(course: CourseSummary): void {
    this.saveCatalog(course, { listed: !course.catalog?.listed });
  }

  setPrice(course: CourseSummary, euros: string): void {
    // El precio se escribe en euros y se guarda en céntimos: es la frontera
    // entre lo que entiende una persona y lo que no pierde decimales.
    const value = Number(euros.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) return;
    this.saveCatalog(course, { priceCents: Math.round(value * 100) });
  }

  setComparePrice(course: CourseSummary, euros: string): void {
    if (!euros.trim()) return this.saveCatalog(course, { compareAtPriceCents: null });
    const value = Number(euros.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) return;
    this.saveCatalog(course, { compareAtPriceCents: Math.round(value * 100) });
  }

  setHeadline(course: CourseSummary, headline: string): void {
    this.saveCatalog(course, { headline: headline || null });
  }

  setDuration(course: CourseSummary, hours: string): void {
    const value = Number(hours);
    this.saveCatalog(course, { durationHours: Number.isFinite(value) && value > 0 ? value : null });
  }

  setLevel(course: CourseSummary, level: string): void {
    this.saveCatalog(course, { level: level || null });
  }

  setCertificate(course: CourseSummary, certificate: boolean): void {
    this.saveCatalog(course, { certificate });
  }

  precioOf(course: CourseSummary): string {
    const cents = course.catalog?.priceCents ?? 0;
    return cents ? (cents / 100).toFixed(2) : '0.00';
  }

  precioAntesOf(course: CourseSummary): string {
    const cents = course.catalog?.compareAtPriceCents ?? 0;
    return cents ? (cents / 100).toFixed(2) : '';
  }

  private saveCatalog(course: CourseSummary, change: Record<string, unknown>): void {
    const catalog = {
      ...(course.catalog ?? { listed: false, priceCents: 0, currency: 'EUR' }),
      ...change,
    };
    this.courses.update(course.id, { catalog } as Partial<CourseSummary>).subscribe({
      next: () => {
        this.catalogue.update((list) =>
          list.map((item) => (item.id === course.id ? { ...item, catalog } : item)),
        );
      },
    });
  }

  /** Abre el diseñador de la página de venta de ese curso. */
  disenarCurso(course: CourseSummary): void {
    void this.router.navigate(['/admin/storefront/curso', course.id]);
  }

  verFicha(course: CourseSummary): void {
    const slug = this.auth.tenantSlug();
    if (!slug) return;
    window.open(`/p/${slug}/c/${course.id}`, '_blank');
  }

  /* -------------------------------- Pedidos ------------------------------- */

  importe(order: OrderDto): string {
    if (order.amountCents <= 0) return 'Gratis';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: order.currency || 'EUR',
    }).format(order.amountCents / 100);
  }

  /** Nombre legible de la forma de pago; el valor guardado es un código. */
  proveedor(order: OrderDto): string {
    switch (order.provider) {
      case PaymentProvider.MercadoPago:
        return 'Mercado Pago';
      case PaymentProvider.PayPal:
        return 'PayPal';
      case PaymentProvider.Manual:
        return 'Transferencia';
      case PaymentProvider.Simulated:
        return 'Pago de prueba';
      default:
        return 'Gratuito';
    }
  }

  /**
   * Un pedido que no movió dinero.
   *
   * Se marca en la lista porque, si no, un pedido simulado cuadra igual que
   * una venta real y acaba contando en las cuentas de fin de mes.
   */
  esPrueba(order: OrderDto): boolean {
    return order.provider === PaymentProvider.Simulated;
  }

  estadoPedido(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.Paid:
        return 'Pagado';
      case OrderStatus.Failed:
        return 'Fallido';
      case OrderStatus.Cancelled:
        return 'Cancelado';
      case OrderStatus.Refunded:
        return 'Reembolsado';
      default:
        return 'Pendiente';
    }
  }

  confirmarPedido(order: OrderDto): void {
    this.confirm
      .ask({
        title: 'Confirmar el pago',
        message:
          `Se dará por cobrado el pedido ${order.reference} y se matriculará a ` +
          `${order.buyerEmail} en «${order.courseTitle}», con aviso por correo.`,
        confirmLabel: 'Confirmar',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.commerce.updateOrder(order.id, OrderStatus.Paid).subscribe({
          next: (updated) => {
            this.orders.update((list) =>
              list.map((item) => (item.id === updated.id ? updated : item)),
            );
            this.toast.success('Pedido confirmado', 'La persona ya tiene acceso al curso.');
          },
        });
      });
  }

  cancelarPedido(order: OrderDto): void {
    this.confirm
      .ask({
        title: 'Cancelar el pedido',
        message: `Se marcará como cancelado el pedido ${order.reference}.`,
        confirmLabel: 'Cancelar el pedido',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.commerce.updateOrder(order.id, OrderStatus.Cancelled).subscribe({
          next: (updated) => {
            this.orders.update((list) =>
              list.map((item) => (item.id === updated.id ? updated : item)),
            );
          },
        });
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
