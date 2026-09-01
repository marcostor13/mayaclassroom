import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryNode, CourseDetail, CourseFormat, SectionDto } from '@maya/shared';
import { ActivityType, CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';
import { ConfirmService } from '../../core/services/confirm.service';

/** Creación y edición de cursos, con gestión de secciones y actividades. */
@Component({
  selector: 'maya-course-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, IconComponent],
  templateUrl: './course-editor.page.html',
})
export class CourseEditorPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly courses = inject(CoursesService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly courseId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  readonly isNew = computed(() => this.courseId() === null);

  readonly categories = signal<CategoryNode[]>([]);
  readonly sections = signal<SectionDto[]>([]);
  readonly activityTypes = signal<ActivityType[]>([]);
  readonly saving = signal(false);

  /** Formulario de nueva actividad. */
  readonly addingTo = signal<string | null>(null);
  readonly activityType = signal('page');
  readonly activityName = signal('');

  readonly form = this.fb.nonNullable.group({
    shortName: ['', [Validators.required]],
    fullName: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    summary: [''],
    format: [CourseFormat.Topics],
    numSections: [10],
    enableCompletion: [true],
    visibility: ['visible'],
  });

  constructor() {
    this.courses.categoryTree().subscribe({
      next: (tree) => {
        this.categories.set(tree);
        const flat = this.flatten(tree);
        if (!this.form.controls.categoryId.value && flat.length) {
          this.form.controls.categoryId.setValue(flat[0].node.id);
        }
      },
    });
    this.courses.activityTypes().subscribe({ next: (types) => this.activityTypes.set(types) });

    const id = this.courseId();
    if (id) {
      this.courses.detail(id).subscribe({
        next: (course) => this.patch(course),
      });
      this.loadSections(id);
    }
  }

  private patch(course: CourseDetail): void {
    this.form.patchValue({
      shortName: course.shortName,
      fullName: course.fullName,
      categoryId: course.categoryId,
      summary: course.summary ?? '',
      format: course.format,
      numSections: course.numSections,
      enableCompletion: course.enableCompletion,
      visibility: course.visibility,
    });
  }

  private loadSections(id: string): void {
    this.courses.contents(id).subscribe({ next: (sections) => this.sections.set(sections) });
  }

  flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
    return nodes.flatMap((node) => [
      { node, depth },
      ...this.flatten(node.children ?? [], depth + 1),
    ]);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload = this.form.getRawValue() as unknown as Partial<CourseDetail> & {
      shortName: string;
      fullName: string;
      categoryId: string;
    };

    const id = this.courseId();
    const request = id ? this.courses.update(id, payload) : this.courses.create(payload);

    request.subscribe({
      next: (course) => {
        this.saving.set(false);
        this.toast.success(id ? 'Curso actualizado' : 'Curso creado');
        if (!id) {
          this.courseId.set(course.id);
          void this.router.navigate(['/courses', course.id, 'edit']);
        } else {
          this.loadSections(id);
        }
      },
      error: () => this.saving.set(false),
    });
  }

  addSection(): void {
    const id = this.courseId();
    if (!id) return;
    this.courses.addSection(id, {}).subscribe({
      next: () => {
        this.loadSections(id);
        this.toast.success('Sección añadida');
      },
    });
  }

  addActivity(sectionId: string): void {
    const id = this.courseId();
    if (!id || !this.activityName().trim()) return;

    this.courses
      .addModule(id, {
        moduleType: this.activityType(),
        sectionId,
        name: this.activityName(),
        settings: {},
      })
      .subscribe({
        next: () => {
          this.activityName.set('');
          this.addingTo.set(null);
          this.loadSections(id);
          this.toast.success('Actividad añadida');
        },
      });
  }

  removeModule(moduleId: string, name: string): void {
    const id = this.courseId();
    if (!id) return;
    this.confirm
      .ask({
        title: 'Eliminar actividad',
        message: `Se eliminará «${name}» junto con las entregas y calificaciones asociadas.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courses.removeModule(id, moduleId).subscribe({
          next: () => {
            this.loadSections(id);
            this.toast.success('Actividad eliminada');
          },
        });
      });
  }

  toggleVisibility(moduleId: string, visible: boolean): void {
    const id = this.courseId();
    if (!id) return;
    this.courses.setModuleVisibility(id, moduleId, visible).subscribe({
      next: () => this.loadSections(id),
    });
  }

  sectionTitle(section: SectionDto): string {
    return section.name ?? (section.sectionNumber === 0 ? 'General' : `Tema ${section.sectionNumber}`);
  }
}
