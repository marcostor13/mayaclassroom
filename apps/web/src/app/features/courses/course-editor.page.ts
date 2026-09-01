import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AvailabilityCondition,
  AvailabilityConditionType,
  AvailabilityOperator,
  AvailabilityTree,
  CategoryNode,
  CompletionTracking,
  CourseDetail,
  CourseFormat,
  CourseModuleDto,
  GroupDto,
  SectionDto,
} from '@maya/shared';
import { ActivityType, CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, ModalComponent } from '../../shared';
import { ConfirmService } from '../../core/services/confirm.service';

/** Creación y edición de cursos, con gestión de secciones y actividades. */
@Component({
  selector: 'maya-course-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, IconComponent, ModalComponent],
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
  readonly groups = signal<GroupDto[]>([]);

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

  /* ------------------- Ajustes de finalización y acceso ------------------ */

  /** Actividad cuyos ajustes se están editando. */
  readonly settingsFor = signal<CourseModuleDto | null>(null);
  readonly savingSettings = signal(false);

  readonly completionTracking = signal<CompletionTracking>(CompletionTracking.None);
  readonly completionExpected = signal('');
  readonly restrictionOperator = signal<AvailabilityOperator>(AvailabilityOperator.And);
  readonly restrictions = signal<AvailabilityCondition[]>([]);

  /** Actividades del curso, para la condición «al completar otra actividad». */
  readonly allModules = computed(() =>
    this.sections().flatMap((section) => section.modules ?? []),
  );

  readonly conditionTypes = [
    { value: AvailabilityConditionType.Date, label: 'Fecha' },
    { value: AvailabilityConditionType.Completion, label: 'Finalización de otra actividad' },
    { value: AvailabilityConditionType.Grade, label: 'Calificación' },
    { value: AvailabilityConditionType.Group, label: 'Pertenencia a un grupo' },
  ];

  openSettings(module: CourseModuleDto): void {
    this.settingsFor.set(module);
    this.completionTracking.set(module.completionTracking ?? CompletionTracking.None);
    this.completionExpected.set(
      module.completionExpected ? module.completionExpected.slice(0, 10) : '',
    );

    // El árbol se guarda serializado; aquí se edita como lista plana, que es
    // lo que cubre la práctica totalidad de los casos reales.
    const parsed = parseAvailability(module.availabilityJson);
    this.restrictionOperator.set(parsed.op);
    this.restrictions.set(parsed.conditions);

    if (!this.groups().length) {
      this.courses.groups(this.courseId() ?? '').subscribe({
        next: (groups) => this.groups.set(groups),
      });
    }
  }

  addRestriction(type: AvailabilityConditionType): void {
    if (!type) return;
    const base: Record<AvailabilityConditionType, AvailabilityCondition> = {
      [AvailabilityConditionType.Date]: { type, d: '>=', t: new Date().toISOString() },
      [AvailabilityConditionType.Completion]: { type, cm: '', e: 1 },
      [AvailabilityConditionType.Grade]: { type, id: '', min: 50 },
      [AvailabilityConditionType.Group]: { type, id: '' },
      [AvailabilityConditionType.Grouping]: { type, id: '' },
      [AvailabilityConditionType.Profile]: { type, sf: 'country', op: 'isequalto', v: '' },
      [AvailabilityConditionType.Role]: { type, id: '' },
    };
    this.restrictions.update((list) => [...list, { ...base[type] }]);
  }

  updateRestriction(index: number, key: string, value: unknown): void {
    this.restrictions.update((list) =>
      list.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    );
  }

  removeRestriction(index: number): void {
    this.restrictions.update((list) => list.filter((_, i) => i !== index));
  }

  saveSettings(): void {
    const module = this.settingsFor();
    const courseId = this.courseId();
    if (!module || !courseId) return;

    const conditions = this.restrictions();
    const tree: AvailabilityTree = { op: this.restrictionOperator(), c: conditions, show: true };

    this.savingSettings.set(true);
    this.courses
      .updateModule(courseId, module.id, {
        completionTracking: this.completionTracking(),
        // Cadena vacía = quitar la fecha; `undefined` no llegaría al servidor.
        completionExpected: this.completionExpected()
          ? new Date(this.completionExpected()).toISOString()
          : '',
        // Sin condiciones no se guarda un árbol vacío: se limpia la restricción.
        availabilityJson: conditions.length ? JSON.stringify(tree) : '',
      })
      .subscribe({
        next: () => {
          this.savingSettings.set(false);
          this.toast.success('Ajustes guardados');
          this.settingsFor.set(null);
          this.loadSections(courseId);
        },
        error: () => this.savingSettings.set(false),
      });
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

/** Lee el árbol serializado y lo devuelve como lista plana de condiciones. */
function parseAvailability(json: string | null | undefined): {
  op: AvailabilityOperator;
  conditions: AvailabilityCondition[];
} {
  if (!json) return { op: AvailabilityOperator.And, conditions: [] };
  try {
    const tree = JSON.parse(json) as AvailabilityTree;
    return {
      op: tree.op ?? AvailabilityOperator.And,
      // Los subárboles anidados se crean fuera de esta pantalla; aquí se
      // conservan tal cual sólo las condiciones simples.
      conditions: (tree.c ?? []).filter(
        (node): node is AvailabilityCondition => !('op' in node),
      ),
    };
  } catch {
    return { op: AvailabilityOperator.And, conditions: [] };
  }
}
