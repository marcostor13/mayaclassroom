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
import {
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ProgressBarComponent,
  SafeHtmlPipe,
} from '../../shared';

/** Iconos por tipo de actividad, alineados con el catálogo de la API. */
const MODULE_ICONS: Record<string, string> = {
  [ModuleType.Assign]: 'clipboard-check',
  [ModuleType.Quiz]: 'help-circle',
  [ModuleType.Forum]: 'message-square',
  [ModuleType.Choice]: 'list-checks',
  [ModuleType.Feedback]: 'clipboard-list',
  [ModuleType.Resource]: 'file',
  [ModuleType.Folder]: 'folder',
  [ModuleType.Page]: 'file-text',
  [ModuleType.Url]: 'link',
  [ModuleType.Book]: 'book-open',
  [ModuleType.Label]: 'tag',
  [ModuleType.Lesson]: 'route',
  [ModuleType.Glossary]: 'book-a',
  [ModuleType.Wiki]: 'network',
  [ModuleType.Workshop]: 'users-round',
  [ModuleType.Database]: 'database',
  [ModuleType.Chat]: 'messages-square',
  [ModuleType.Scorm]: 'package',
  [ModuleType.Lti]: 'plug',
  [ModuleType.H5p]: 'puzzle',
  [ModuleType.Survey]: 'bar-chart-3',
  [ModuleType.Attendance]: 'user-check',
};

const MODULE_ROUTES: Record<string, string> = {
  [ModuleType.Assign]: '/mod/assign',
  [ModuleType.Quiz]: '/mod/quiz',
  [ModuleType.Forum]: '/mod/forum',
  [ModuleType.Choice]: '/mod/choice',
  [ModuleType.Feedback]: '/mod/feedback',
};

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

  readonly canEdit = computed(
    () => this.auth.can(CAP.COURSE_MANAGE_ACTIVITIES) || this.auth.isTeacherOf(this.courseId),
  );
  readonly canGrade = computed(
    () => this.auth.can(CAP.GRADE_VIEW_ALL) || this.auth.isTeacherOf(this.courseId),
  );

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
    return MODULE_ICONS[module.moduleType] ?? 'file';
  }

  link(module: CourseModuleDto): string[] {
    const base = MODULE_ROUTES[module.moduleType];
    if (base) return [base, module.id];
    const advanced = [
      ModuleType.Lesson,
      ModuleType.Glossary,
      ModuleType.Wiki,
      ModuleType.Workshop,
      ModuleType.Database,
      ModuleType.Chat,
      ModuleType.Scorm,
      ModuleType.Lti,
      ModuleType.H5p,
      ModuleType.Survey,
      ModuleType.Attendance,
    ];
    return advanced.includes(module.moduleType)
      ? ['/mod/advanced', module.id]
      : ['/mod/resource', module.id];
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
