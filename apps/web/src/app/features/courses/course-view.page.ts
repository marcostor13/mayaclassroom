import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CAP,
  CompletionState,
  CourseDetail,
  CourseModuleDto,
  ModuleType,
  SectionDto,
} from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { CoursesService } from '../../core/services/courses.service';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import { moduleIcon, moduleLink } from '../../core/module-links';
import { PreviewService } from '../../core/services/preview.service';
import {
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ProgressBarComponent,
  SafeHtmlPipe,
} from '../../shared';

@Component({
  selector: 'maya-course-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    ProgressBarComponent,
    EmptyStateComponent,
    SafeHtmlPipe,
    FormatDatePipe,
  ],
  templateUrl: './course-view.page.html',
  styleUrl: './course-view.page.scss',
})
export class CourseViewPage {
  private readonly route = inject(ActivatedRoute);
  private readonly courses = inject(CoursesService);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly course = signal<CourseDetail | null>(null);
  readonly sections = signal<SectionDto[]>([]);
  readonly progress = signal(0);
  readonly loading = signal(true);
  readonly tab = signal<'contents' | 'participants' | 'grades'>('contents');
  readonly collapsed = signal<Set<string>>(new Set());

  readonly preview = inject(PreviewService);

  /** Quien de verdad puede editar, se mire como se mire. */
  private readonly esDocente = computed(
    () => this.auth.can(CAP.COURSE_MANAGE_ACTIVITIES) || this.auth.isTeacherOf(this.courseId),
  );

  // En vista de alumno desaparecen los controles: es justo lo que se quiere
  // comprobar. El permiso real no cambia, solo lo que se muestra.
  readonly canEdit = computed(() => this.esDocente() && !this.preview.studentView());
  readonly canGrade = computed(
    () =>
      (this.auth.can(CAP.GRADE_VIEW_ALL) || this.auth.isTeacherOf(this.courseId)) &&
      !this.preview.studentView(),
  );
  readonly canSeeMediaReports = computed(
    () =>
      (this.auth.can(CAP.MEDIA_VIEW_REPORTS) || this.auth.isTeacherOf(this.courseId)) &&
      !this.preview.studentView(),
  );

  /** Puede alternar la vista quien podría editar. */
  readonly canPreview = computed(() => this.esDocente());

  /**
   * Secciones tal como las vería el alumnado: sin lo oculto.
   *
   * El filtro es de presentación, no de seguridad: la API ya decide qué
   * entrega a cada quien. Aquí solo sirve para comprobar el resultado.
   */
  readonly visibleSections = computed(() => {
    if (!this.preview.studentView()) return this.sections();
    return this.sections()
      .filter((section) => section.visible !== false)
      .map((section) => ({
        ...section,
        modules: (section.modules ?? []).filter((module) => module.visible !== false),
      }));
  });

  readonly totalActivities = computed(() =>
    this.sections().reduce((sum, section) => sum + section.modules.length, 0),
  );

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.courses.detail(this.courseId).subscribe({
      next: (course) => this.course.set(course),
      error: () => this.loading.set(false),
    });
    this.courses.contents(this.courseId).subscribe({
      next: (sections) => {
        this.sections.set(sections);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.activities.courseProgress(this.courseId).subscribe({
      next: (result) => this.progress.set(result.progress),
    });
  }

  icon(module: CourseModuleDto): string {
    return moduleIcon(module);
  }

  link(module: CourseModuleDto): string[] {
    return moduleLink(module);
  }

  isComplete(module: CourseModuleDto): boolean {
    return (
      module.completionState === CompletionState.Complete ||
      module.completionState === CompletionState.CompletePass
    );
  }

  sectionTitle(section: SectionDto): string {
    if (section.name) return section.name;
    return section.sectionNumber === 0 ? 'General' : `Tema ${section.sectionNumber}`;
  }

  toggleSection(id: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isCollapsed(id: string): boolean {
    return this.collapsed().has(id);
  }

  toggleCompletion(module: CourseModuleDto, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const next = !this.isComplete(module);
    this.activities.toggleCompletion(module.id, next).subscribe(() => {
      this.sections.update((sections) =>
        sections.map((section) => ({
          ...section,
          modules: section.modules.map((item) =>
            item.id === module.id
              ? {
                  ...item,
                  completionState: next ? CompletionState.Complete : CompletionState.Incomplete,
                }
              : item,
          ),
        })),
      );
      this.activities.courseProgress(this.courseId).subscribe({
        next: (result) => this.progress.set(result.progress),
      });
      this.toast.success(next ? 'Actividad marcada como completada' : 'Marca retirada');
    });
  }
}
