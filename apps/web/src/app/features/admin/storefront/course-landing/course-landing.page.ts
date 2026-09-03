import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { DEFAULT_CURRENCY, SiteTemplate } from '@maya/shared';
import type {
  CourseDetail,
  PublicCourseDto,
  PublicCurriculumSection,
  SiteSection,
} from '@maya/shared';
import { CoursesService } from '../../../../core/services/courses.service';
import { SiteService } from '../../../../core/services/site.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { IconComponent } from '../../../../shared';
import type { SiteRenderData } from '../../../../shared';
import { PageBuilderComponent } from '../page-builder/page-builder.component';

/**
 * Diseñador de la página de venta de un curso.
 *
 * Usa el mismo constructor que la página de la empresa: son la misma clase de
 * página y aprender dos editores para lo mismo no tendría sentido. Lo único
 * que cambia es qué bloques se ofrecen —aquí hay temario, profesorado y
 * compra; allí, catálogo y contacto— y de dónde salen las secciones.
 *
 * Un curso sin página propia no arranca en blanco: hereda la maqueta por
 * defecto que ya usa su ficha pública, de modo que editar es cambiar lo que no
 * encaje y no construir desde cero.
 */
@Component({
  selector: 'maya-course-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, PageBuilderComponent],
  templateUrl: './course-landing.page.html',
  styleUrl: './course-landing.page.scss',
})
export class AdminCourseLandingPage implements OnInit {
  private readonly courses = inject(CoursesService);
  private readonly site = inject(SiteService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly location = inject(Location);

  readonly id = input.required<string>();

  readonly course = signal<CourseDetail | null>(null);
  readonly secciones = signal<SiteSection[]>([]);
  readonly curriculum = signal<PublicCurriculumSection[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly dirty = signal(false);
  /** `true` mientras la página sea la heredada y no una propia guardada. */
  readonly heredada = signal(true);

  readonly render = computed<SiteRenderData | null>(() => {
    const course = this.course();
    if (!course) return null;
    const publico: PublicCourseDto = {
      id: course.id,
      slug: course.shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: course.fullName,
      summary: course.summary,
      imageUrl: course.imageUrl,
      categoryId: course.categoryId,
      categoryName: course.categoryName ?? null,
      tags: course.tags,
      catalog: course.catalog ?? { listed: false, priceCents: 0, currency: DEFAULT_CURRENCY },
      enrolledCount: course.enrolledCount ?? 0,
    };

    return {
      tenant: {
        id: '',
        slug: this.auth.tenantSlug() ?? '',
        name: this.auth.tenantSlug() ?? 'Su empresa',
        logoUrl: null,
        primaryColor: null,
        accentColor: null,
      },
      template: SiteTemplate.Classic,
      contact: {},
      courses: [],
      categories: [],
      course: publico,
      curriculum: this.curriculum(),
    };
  });

  ngOnInit(): void {
    this.courses.detail(this.id()).subscribe({
      next: (course) => {
        this.course.set(course);
        this.loading.set(false);
        const propia = course.catalog?.landing ?? [];
        this.heredada.set(propia.length === 0);
        if (propia.length) this.secciones.set(propia);
      },
      error: () => this.loading.set(false),
    });

    // El temario y la maqueta heredada se piden a la ficha pública: es el
    // mismo cálculo que ve el visitante, y duplicarlo aquí lo haría divergir.
    const slug = this.auth.tenantSlug();
    if (slug) {
      this.site.publicCourse(slug, this.id()).subscribe({
        next: (detalle) => {
          this.curriculum.set(detalle.curriculum);
          if (!this.secciones().length) this.secciones.set(detalle.landing);
        },
        // Un curso todavía no publicado no tiene ficha pública; la página se
        // sigue pudiendo diseñar, solo que sin temario de muestra.
        error: () => undefined,
      });
    }
  }

  marcarSucio(): void {
    this.dirty.set(true);
    this.heredada.set(false);
  }

  guardar(): void {
    const course = this.course();
    if (!course || this.saving()) return;
    this.saving.set(true);

    const catalog = { ...(course.catalog ?? { listed: false, priceCents: 0, currency: DEFAULT_CURRENCY }) };
    this.courses
      .update(course.id, { catalog: { ...catalog, landing: this.secciones() } } as never)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dirty.set(false);
          this.heredada.set(false);
          this.toast.success('Página de venta guardada');
        },
        error: () => this.saving.set(false),
      });
  }

  /** Vuelve a la maqueta por defecto, descartando la página propia. */
  restablecer(): void {
    const course = this.course();
    if (!course) return;
    this.confirm
      .ask({
        title: 'Volver a la página por defecto',
        message:
          'Se descartará el diseño propio de este curso y volverá a usarse la maqueta que ' +
          'la plataforma compone con sus datos.',
        confirmLabel: 'Restablecer',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        const catalog = {
          ...(course.catalog ?? { listed: false, priceCents: 0, currency: DEFAULT_CURRENCY }),
        };
        this.courses
          .update(course.id, { catalog: { ...catalog, landing: [] } } as never)
          .subscribe({
            next: () => {
              this.heredada.set(true);
              this.dirty.set(false);
              this.toast.success('Restablecida', 'Recargue para ver la maqueta por defecto.');
            },
          });
      });
  }

  verFicha(): void {
    const slug = this.auth.tenantSlug();
    if (!slug) return;
    window.open(`/p/${slug}/c/${this.id()}`, '_blank');
  }

  volver(): void {
    this.location.back();
  }
}
