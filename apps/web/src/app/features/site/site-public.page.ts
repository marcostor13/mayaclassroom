import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import {
  PublicCourseDto,
  PublicSiteDto,
  SiteSection,
  SiteSectionType,
} from '@maya/shared';
import { SiteService } from '../../core/services/site.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

/**
 * Escaparate público de una empresa.
 *
 * Vive fuera del armazón de la aplicación —sin barra lateral ni sesión— porque
 * su público es quien todavía no es alumno. Lo que se pinta y en qué orden lo
 * decide la propia empresa desde el editor: aquí solo se recorre la lista de
 * secciones activas.
 */
@Component({
  selector: 'maya-site-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './site-public.page.html',
  styleUrl: './site-public.page.scss',
})
export class SitePublicPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);
  private readonly fb = inject(FormBuilder);

  readonly slug = input.required<string>();

  readonly SectionType = SiteSectionType;

  readonly data = signal<PublicSiteDto | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly submitting = signal(false);
  readonly sent = signal<string | null>(null);

  /** Curso cuya solicitud está abierta. Nulo mientras no se pide plaza. */
  readonly selectedCourse = signal<PublicCourseDto | null>(null);

  /** Categoría por la que se filtra el catálogo; vacío es «todas». */
  readonly categoryFilter = signal('');

  readonly sections = computed(() =>
    (this.data()?.site.sections ?? []).filter((section) => section.enabled),
  );

  readonly visibleCourses = computed(() => {
    const courses = this.data()?.courses ?? [];
    const category = this.categoryFilter();
    return category ? courses.filter((course) => course.categoryId === category) : courses;
  });

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    message: [''],
  });

  ngOnInit(): void {
    this.site.publicSite(this.slug()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
        this.title.setTitle(data.site.seo.title || data.tenant.name);
        // La marca de la empresa manda también fuera del aula: es su página.
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
  }

  /** Cuántos cursos mostrar en una sección de catálogo. */
  coursesFor(section: SiteSection): PublicCourseDto[] {
    const courses = this.visibleCourses();
    return section.limit ? courses.slice(0, section.limit) : courses;
  }

  price(course: PublicCourseDto): string {
    if (course.catalog.priceCents <= 0) return 'Gratuito';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: course.catalog.currency || 'EUR',
    }).format(course.catalog.priceCents / 100);
  }

  openRequest(course: PublicCourseDto): void {
    this.selectedCourse.set(course);
    this.sent.set(null);
    // El formulario se desplaza a la vista: en móvil queda fuera de pantalla y
    // pulsar el botón parecería no hacer nada.
    queueMicrotask(() => {
      document.getElementById('solicitud')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  closeRequest(): void {
    this.selectedCourse.set(null);
  }

  submitRequest(): void {
    const course = this.selectedCourse();
    if (!course || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const value = this.form.getRawValue();
    this.site
      .requestPlace(this.slug(), {
        courseId: course.id,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        phone: value.phone || undefined,
        message: value.message || undefined,
      })
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          this.sent.set(result.message);
          this.selectedCourse.set(null);
          this.form.reset();
          this.toast.success('Solicitud enviada', result.message);
        },
        error: () => this.submitting.set(false),
      });
  }

  invalid(control: 'firstName' | 'lastName' | 'email'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }
}
