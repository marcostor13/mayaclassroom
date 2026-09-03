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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { PaymentProvider, formatMoney } from '@maya/shared';
import type {
  PublicCourseDetailDto,
  PublicCourseDto,
  PublicPaymentMethod,
} from '@maya/shared';
import { SiteService } from '../../core/services/site.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, SiteRenderComponent } from '../../shared';
import type { SiteRenderData } from '../../shared';

/**
 * Ficha de venta de un curso.
 *
 * Es la página que cierra la venta, así que tiene una sola llamada a la acción
 * —comprar— repetida arriba y abajo, y un formulario que pide lo mínimo:
 * nombre, apellidos y correo. Cualquier campo de más aquí es una compra menos.
 *
 * El cobro lo lleva la pasarela; la plataforma solo abre el pedido y espera su
 * confirmación. No pasa por aquí ningún dato de tarjeta.
 */
@Component({
  selector: 'maya-course-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SiteRenderComponent],
  templateUrl: './course-public.page.html',
  styleUrl: './course-public.page.scss',
})
export class CoursePublicPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly slug = input.required<string>();
  readonly ref = input.required<string>();

  readonly data = signal<PublicCourseDetailDto | null>(null);
  readonly methods = signal<PublicPaymentMethod[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  /** Panel de compra abierto. */
  readonly comprando = signal(false);
  readonly enviando = signal(false);
  readonly provider = signal<PaymentProvider | null>(null);

  readonly Proveedor = PaymentProvider;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  readonly render = computed<SiteRenderData | null>(() => {
    const d = this.data();
    if (!d) return null;
    return {
      tenant: d.tenant,
      template: d.site.template,
      contact: d.site.contact,
      courses: d.related,
      categories: [],
      course: d.course,
      curriculum: d.curriculum,
      paymentMethods: this.methods(),
    };
  });

  readonly gratuito = computed(() => (this.data()?.course.catalog.priceCents ?? 0) <= 0);

  readonly precio = computed(() => {
    const course = this.data()?.course;
    if (!course) return '';
    if (course.catalog.priceCents <= 0) return 'Gratis';
    return formatMoney(course.catalog.priceCents, course.catalog.currency);
  });

  ngOnInit(): void {
    this.site.publicCourse(this.slug(), this.ref()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
        this.title.setTitle(`${data.course.title} · ${data.tenant.name}`);
        this.meta.updateTag({
          name: 'description',
          content: data.course.catalog.headline ?? data.course.summary ?? '',
        });
        if (data.tenant.primaryColor) {
          this.theme.applyBranding({
            primaryColor: data.tenant.primaryColor,
            accentColor: data.tenant.accentColor ?? data.tenant.primaryColor,
            logoUrl: data.tenant.logoUrl,
          });
        }
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });

    this.site.paymentMethods(this.slug()).subscribe({
      next: (methods) => {
        this.methods.set(methods);
        // Se preselecciona la primera para que comprar sea un solo gesto en el
        // caso corriente, que es tener una única pasarela conectada.
        this.provider.set(methods[0]?.provider ?? null);
      },
      // Sin pasarelas configuradas la compra sigue siendo posible si el curso
      // es gratuito; el error no debe romper la página.
      error: () => this.methods.set([]),
    });
  }

  abrirCompra(): void {
    this.comprando.set(true);
    queueMicrotask(() =>
      document.getElementById('compra')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  cerrarCompra(): void {
    this.comprando.set(false);
  }

  invalid(control: 'firstName' | 'lastName' | 'email'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }

  comprar(): void {
    const course = this.data()?.course;
    if (!course || this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const provider = this.gratuito()
      ? PaymentProvider.Free
      : (this.provider() ?? this.methods()[0]?.provider);
    if (!provider) {
      this.toast.warning(
        'Sin forma de pago',
        'Esta empresa todavía no ha conectado ninguna pasarela.',
      );
      return;
    }

    this.enviando.set(true);
    const value = this.form.getRawValue();
    this.site
      .checkout(this.slug(), {
        courseId: course.id,
        provider,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone || undefined,
      })
      .subscribe({
        next: (session) => {
          if (session.redirectUrl) {
            // Se sale de la aplicación a la pasarela: `location` y no el
            // enrutador, que solo sabe navegar dentro.
            window.location.href = session.redirectUrl;
            return;
          }
          this.enviando.set(false);
          void this.router.navigate(['/p', this.slug(), 'pedido', session.reference]);
        },
        error: () => this.enviando.set(false),
      });
  }

  abrirCurso(course: PublicCourseDto): void {
    void this.router.navigate(['/p', this.slug(), 'c', course.slug || course.id]);
  }
}
