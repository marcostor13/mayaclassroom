import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ActivityCatalogItem,
  ActivityGroup,
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
import { CoursesService } from '../../core/services/courses.service';
import { moduleIcon, moduleLink } from '../../core/module-links';
import { ToastService } from '../../core/services/toast.service';
import {
  EmptyStateComponent,
  IconComponent,
  ImageUploadComponent,
  ModalComponent,
  RichEditorComponent,
} from '../../shared';
import { ConfirmService } from '../../core/services/confirm.service';

/** Pasos del asistente, en el orden en que se recorren. */
type StepId = 'datos' | 'presentacion' | 'estructura' | 'contenido';

interface Step {
  id: StepId;
  /**
   * Rótulo del stepper. De una palabra: la banda reparte el ancho entre los
   * cuatro pasos y una palabra larga impone su ancho mínimo a todos, así que
   * el contexto completo lo da `title`, no esto.
   */
  label: string;
  icon: string;
  title: string;
  hint: string;
}

const STEPS: readonly Step[] = [
  {
    id: 'datos',
    label: 'Datos',
    icon: 'sparkles',
    title: '¿Qué curso vamos a montar?',
    hint: 'El nombre y dónde se guarda. Lo demás se puede cambiar en cualquier momento.',
  },
  {
    id: 'presentacion',
    label: 'Portada',
    icon: 'image',
    title: 'Portada y resumen del curso',
    hint: 'Es lo primero que ve quien se plantea matricularse, antes que el temario.',
  },
  {
    id: 'estructura',
    label: 'Estructura',
    icon: 'layers',
    title: 'Cómo se organiza el temario',
    hint: 'El formato decide si el contenido se agrupa por temas, por semanas o en una sola pieza.',
  },
  {
    id: 'contenido',
    label: 'Contenido',
    icon: 'list-checks',
    title: 'El temario del curso',
    hint: 'Cree las secciones y ponga dentro páginas, vídeos, tareas y cuestionarios.',
  },
];

/** Formatos de curso, explicados: el desplegable no decía qué elegía nadie. */
const FORMATS: readonly { value: CourseFormat; label: string; icon: string; text: string }[] = [
  {
    value: CourseFormat.Topics,
    label: 'Por temas',
    icon: 'layers',
    text: 'Bloques numerados sin fechas. La opción habitual para un curso que se sigue a ritmo libre.',
  },
  {
    value: CourseFormat.Weekly,
    label: 'Semanal',
    icon: 'calendar',
    text: 'Una sección por semana, con sus fechas. Para grupos que avanzan a la vez.',
  },
  {
    value: CourseFormat.SingleActivity,
    label: 'Actividad única',
    icon: 'target',
    text: 'Todo el curso es una sola actividad: un examen, un paquete SCORM o un vídeo.',
  },
  {
    value: CourseFormat.Social,
    label: 'Social',
    icon: 'message-square',
    text: 'Un foro en el centro del curso. Para comunidades y espacios de debate.',
  },
];

/** Quita tildes y pasa a minúsculas, para que la búsqueda no dependa de ellas. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Propone un nombre corto a partir del completo: iniciales de las palabras
 * largas, o las primeras letras si solo hay una. Es un punto de partida que
 * casi nadie quiere teclear a mano, y se puede sobrescribir.
 */
function suggestShortName(fullName: string): string {
  const words = normalize(fullName)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2);
  if (!words.length) return '';
  const acronym = words.map((word) => word[0]).join('');
  return (acronym.length >= 3 ? acronym : words[0].slice(0, 6)).toUpperCase().slice(0, 10);
}

/** Creación y edición de cursos como asistente de cuatro pasos. */
@Component({
  selector: 'maya-course-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    ImageUploadComponent,
    ModalComponent,
    RichEditorComponent,
  ],
  templateUrl: './course-editor.page.html',
  styleUrl: './course-editor.page.scss',
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
  readonly activityTypes = signal<ActivityCatalogItem[]>([]);
  readonly saving = signal(false);
  readonly groups = signal<GroupDto[]>([]);

  /** Portada del curso: la usan la lista de cursos y el catálogo público. */
  readonly imageUrl = signal<string | null>(null);

  /**
   * Resumen en HTML. Fuera del formulario reactivo, como el resto de campos
   * que edita un componente de señales.
   */
  readonly summary = signal('');

  readonly form = this.fb.nonNullable.group({
    shortName: ['', [Validators.required]],
    fullName: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    format: [CourseFormat.Topics],
    numSections: [10],
    enableCompletion: [true],
    visibility: ['visible'],
  });

  /**
   * Valor del formulario como señal: el stepper decide con él qué pasos deja
   * abrir, y un `FormGroup` por sí solo no dispara la detección de cambios sin
   * zonas.
   */
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as Partial<ReturnType<typeof this.form.getRawValue>>,
  });

  /* --------------------------- Pasos del asistente ------------------------ */

  readonly steps = STEPS;
  readonly formats = FORMATS;
  readonly step = signal<StepId>('datos');
  readonly stepIndex = computed(() => STEPS.findIndex((item) => item.id === this.step()));
  readonly current = computed(() => STEPS[this.stepIndex()] ?? STEPS[0]);

  /** Lo esencial está resuelto: sin esto no hay curso que guardar. */
  readonly basicsDone = computed(() => {
    const value = this.value();
    return Boolean(value.fullName?.trim() && value.shortName?.trim() && value.categoryId);
  });

  /** El paso de contenido solo existe cuando el curso ya está creado. */
  stepEnabled(id: StepId): boolean {
    if (id === 'datos') return true;
    if (id === 'contenido') return !this.isNew();
    return this.basicsDone();
  }

  stepState(index: number): 'done' | 'active' | 'pending' {
    if (index === this.stepIndex()) return 'active';
    if (index >= this.stepIndex()) return 'pending';
    // Sólo se da por resuelto lo que de verdad lo está: haber pasado por el
    // primer paso sin rellenarlo no merece un visto.
    return STEPS[index].id === 'datos' && !this.basicsDone() ? 'pending' : 'done';
  }

  goTo(id: StepId): void {
    if (!this.stepEnabled(id)) return;
    this.step.set(id);
    scrollToTop();
  }

  next(): void {
    const following = STEPS[this.stepIndex() + 1];
    if (following) this.goTo(following.id);
  }

  back(): void {
    const previous = STEPS[this.stepIndex() - 1];
    if (previous) this.goTo(previous.id);
  }

  /** Hay un paso siguiente accesible al que llevar. */
  readonly hasNext = computed(() => {
    const following = STEPS[this.stepIndex() + 1];
    return Boolean(following && this.stepEnabled(following.id));
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
      this.courses.detail(id).subscribe({ next: (course) => this.patch(course) });
      this.loadSections(id);
    }

    // Tras crear el curso se vuelve a entrar por otra ruta: el paso llega en
    // la consulta para no aterrizar de nuevo en el primero.
    const requested = this.route.snapshot.queryParamMap.get('paso') as StepId | null;
    if (requested && STEPS.some((item) => item.id === requested) && this.stepEnabled(requested)) {
      this.step.set(requested);
    }
  }

  private patch(course: CourseDetail): void {
    this.form.patchValue({
      shortName: course.shortName,
      fullName: course.fullName,
      categoryId: course.categoryId,
      format: course.format,
      numSections: course.numSections,
      enableCompletion: course.enableCompletion,
      visibility: course.visibility,
    });
    this.imageUrl.set(course.imageUrl ?? null);
    this.summary.set(course.summary ?? '');
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

  /** Completa el nombre corto mientras nadie lo haya tocado a mano. */
  suggestShortName(): void {
    const control = this.form.controls.shortName;
    if (control.dirty && control.value.trim()) return;
    const suggestion = suggestShortName(this.form.controls.fullName.value);
    if (suggestion) control.setValue(suggestion);
  }

  /* -------------------------- Catálogo de actividades --------------------- */

  /** Ficha de cada tipo, para rotular las actividades ya añadidas. */
  private readonly catalogByType = computed(
    () => new Map(this.activityTypes().map((item) => [item.type as string, item])),
  );

  /** Sección a la que se está añadiendo una actividad; `null` con el diálogo cerrado. */
  readonly pickerSection = signal<SectionDto | null>(null);
  readonly pickerQuery = signal('');
  readonly pickerGroup = signal<ActivityGroup | 'all'>('all');
  /** Tipo elegido: mientras es `null` el diálogo muestra el catálogo. */
  readonly pickerType = signal<ActivityCatalogItem | null>(null);
  readonly activityName = signal('');
  readonly addingActivity = signal(false);

  readonly groupFilters: readonly { value: ActivityGroup | 'all'; label: string }[] = [
    { value: 'all', label: 'Todo' },
    { value: 'activity', label: 'Actividades' },
    { value: 'resource', label: 'Recursos' },
  ];

  /** Catálogo filtrado por familia y por texto (nombre, descripción y etiquetas). */
  readonly pickerResults = computed(() => {
    const group = this.pickerGroup();
    const query = normalize(this.pickerQuery().trim());
    return this.activityTypes().filter((item) => {
      if (group !== 'all' && item.group !== group) return false;
      if (!query) return true;
      const haystack = normalize(`${item.label} ${item.description} ${item.tags.join(' ')}`);
      return haystack.includes(query);
    });
  });

  openPicker(section: SectionDto): void {
    this.pickerSection.set(section);
    this.pickerType.set(null);
    this.pickerQuery.set('');
    this.pickerGroup.set('all');
    this.activityName.set('');
  }

  closePicker(): void {
    this.pickerSection.set(null);
    this.pickerType.set(null);
  }

  chooseType(item: ActivityCatalogItem): void {
    this.pickerType.set(item);
    this.activityName.set('');
  }

  addActivity(): void {
    const id = this.courseId();
    const section = this.pickerSection();
    const type = this.pickerType();
    const name = this.activityName().trim();
    if (!id || !section || !type || !name) return;

    this.addingActivity.set(true);
    this.courses
      .addModule(id, { moduleType: type.type, sectionId: section.id, name, settings: {} })
      .subscribe({
        next: () => {
          this.addingActivity.set(false);
          this.closePicker();
          this.loadSections(id);
          this.toast.success(`${type.label} añadida`);
        },
        error: () => this.addingActivity.set(false),
      });
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
      this.goTo('datos');
      return;
    }
    this.saving.set(true);
    const payload = {
      ...this.form.getRawValue(),
      imageUrl: this.imageUrl(),
      summary: this.summary(),
    } as unknown as Partial<CourseDetail> & {
      shortName: string;
      fullName: string;
      categoryId: string;
    };

    const id = this.courseId();
    const request = id ? this.courses.update(id, payload) : this.courses.create(payload);

    request.subscribe({
      next: (course) => {
        this.saving.set(false);
        this.toast.success(id ? 'Curso actualizado' : 'Curso creado: ya puede poner el temario');
        if (!id) {
          this.courseId.set(course.id);
          // Recién creado, lo único que queda por hacer es el contenido.
          void this.router.navigate(['/courses', course.id, 'edit'], {
            queryParams: { paso: 'contenido' },
          });
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

  /**
   * Duplica una actividad. Es la vía natural para hacer la lección siguiente
   * cuando se parece a la anterior: copiar y cambiar lo que difiere cuesta
   * mucho menos que montarla otra vez desde cero.
   */
  duplicateModule(moduleId: string): void {
    const id = this.courseId();
    if (!id) return;
    this.courses.duplicateModule(id, moduleId).subscribe({
      next: () => {
        this.loadSections(id);
        this.toast.success('Actividad duplicada');
      },
    });
  }

  /**
   * Sube o baja una actividad dentro de su sección.
   *
   * Con botones y no arrastrando: funciona con el teclado y en una pantalla
   * táctil, donde arrastrar entre bloques altos es incómodo de verdad.
   */
  moveModule(section: SectionDto, moduleId: string, delta: -1 | 1): void {
    const id = this.courseId();
    if (!id) return;
    const modules = section.modules ?? [];
    const from = modules.findIndex((module) => module.id === moduleId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= modules.length) return;

    this.courses.moveModule(id, moduleId, section.id, to).subscribe({
      next: () => this.loadSections(id),
    });
  }

  /** Ruta de la actividad, para abrirla y editar su contenido. */
  moduleLink(module: CourseModuleDto): string[] {
    return moduleLink(module);
  }

  moduleIcon(module: CourseModuleDto): string {
    return moduleIcon(module);
  }

  /** Nombre legible del tipo. Sin el catálogo se vería «h5pactivity». */
  moduleTypeLabel(module: CourseModuleDto): string {
    return this.catalogByType().get(module.moduleType)?.label ?? module.moduleType;
  }

  /** Renombra la sección sin salir de la pantalla. */
  renameSection(section: SectionDto, name: string): void {
    const id = this.courseId();
    const limpio = name.trim();
    if (!id || !limpio || limpio === section.name) return;
    this.courses.updateSection(id, section.id, { name: limpio }).subscribe({
      next: () => {
        this.loadSections(id);
        this.toast.success('Sección renombrada');
      },
    });
  }

  sectionTitle(section: SectionDto): string {
    return section.name ?? (section.sectionNumber === 0 ? 'General' : `Tema ${section.sectionNumber}`);
  }

  /** Cuántas actividades tiene la sección, ya redactado. */
  sectionCount(section: SectionDto): string {
    const total = section.modules?.length ?? 0;
    return total === 1 ? '1 actividad' : `${total} actividades`;
  }
}

/** Al cambiar de paso hay que volver arriba: el siguiente empieza donde acabó el anterior. */
function scrollToTop(): void {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
