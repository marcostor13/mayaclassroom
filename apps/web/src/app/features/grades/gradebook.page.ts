import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CAP,
  GradeAggregation,
  GradeCategoryDto,
  GradeItemDto,
  GradeItemType,
  GradeLetterDto,
  GradeScaleDto,
  GradeType,
  GraderReport,
} from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { GradesService } from '../../core/services/grades.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  IconComponent,
  ModalComponent,
} from '../../shared';

/** Letras de calificación por defecto, la escala habitual de Moodle. */
const LETRAS_POR_DEFECTO = [
  { letter: 'A', lowerBoundary: 90 },
  { letter: 'B', lowerBoundary: 80 },
  { letter: 'C', lowerBoundary: 70 },
  { letter: 'D', lowerBoundary: 60 },
  { letter: 'F', lowerBoundary: 0 },
];

@Component({
  selector: 'maya-gradebook',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './gradebook.page.html',
})
export class GradebookPage {
  private readonly route = inject(ActivatedRoute);
  private readonly grades = inject(GradesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly report = signal<GraderReport | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly tab = signal<'grades' | 'setup' | 'letters'>('grades');

  readonly items = signal<GradeItemDto[]>([]);
  readonly categories = signal<GradeCategoryDto[]>([]);
  readonly scales = signal<GradeScaleDto[]>([]);
  readonly letters = signal<GradeLetterDto[]>([]);

  readonly itemFormOpen = signal(false);
  readonly editingItem = signal<GradeItemDto | null>(null);
  readonly categoryFormOpen = signal(false);
  readonly editingCategory = signal<GradeCategoryDto | null>(null);
  readonly scaleFormOpen = signal(false);

  readonly canManage = computed(() => this.auth.can(CAP.GRADE_MANAGE));

  readonly aggregations = [
    { value: GradeAggregation.Mean, label: 'Media de las calificaciones' },
    { value: GradeAggregation.WeightedMean, label: 'Media ponderada' },
    { value: GradeAggregation.SimpleWeightedMean, label: 'Media ponderada simple' },
    { value: GradeAggregation.Natural, label: 'Natural (suma de puntos)' },
    { value: GradeAggregation.Median, label: 'Mediana' },
    { value: GradeAggregation.Min, label: 'Calificación más baja' },
    { value: GradeAggregation.Max, label: 'Calificación más alta' },
    { value: GradeAggregation.Mode, label: 'Moda' },
    { value: GradeAggregation.Sum, label: 'Suma' },
  ];

  readonly itemForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    gradeType: [GradeType.Value as GradeType],
    categoryId: [''],
    scaleId: [''],
    grademax: [100],
    grademin: [0],
    gradepass: [50],
    weight: [1],
    decimals: [2],
    hidden: [false],
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    parentId: [''],
    aggregation: [GradeAggregation.Mean as GradeAggregation],
    aggregateOnlyGraded: [true],
    dropLowest: [0],
    keepHighest: [0],
  });

  readonly scaleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    /** Una opción por línea, de menor a mayor, como en Moodle. */
    items: ['', [Validators.required]],
  });

  /** Letras en edición; se guardan todas de una vez. */
  readonly letterDraft = signal<{ letter: string; lowerBoundary: number }[]>([]);

  /** Ítems calificables: el total del curso se calcula y no se edita a mano. */
  readonly gradableItems = computed(() =>
    this.items().filter((item) => item.itemType !== GradeItemType.Course),
  );

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.grades.graderReport(this.courseId).subscribe({
      next: (report) => {
        this.report.set({
          ...report,
          items: report.items.filter((item) => item.itemType !== GradeItemType.Course),
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** La configuración se pide sólo al abrir su pestaña. */
  openSetup(): void {
    this.tab.set('setup');
    this.grades.items(this.courseId).subscribe({ next: (list) => this.items.set(list) });
    this.grades.categories(this.courseId).subscribe({ next: (list) => this.categories.set(list) });
    this.grades.scales(this.courseId).subscribe({ next: (list) => this.scales.set(list) });
  }

  openLetters(): void {
    this.tab.set('letters');
    this.grades.letters(this.courseId).subscribe({
      next: (list) => {
        this.letters.set(list);
        this.letterDraft.set(
          list.length
            ? list.map((item) => ({ letter: item.letter, lowerBoundary: item.lowerBoundary }))
            : [...LETRAS_POR_DEFECTO],
        );
      },
    });
  }

  categoryName(id: string | null | undefined): string {
    if (!id) return 'Sin categoría';
    return this.categories().find((item) => item.id === id)?.name ?? 'Sin categoría';
  }

  aggregationLabel(value: GradeAggregation): string {
    return this.aggregations.find((item) => item.value === value)?.label ?? value;
  }

  /* -------------------------- Notas del calificador ---------------------- */

  save(itemId: string, userId: string, value: string): void {
    const grade = value === '' ? null : Number(value);
    if (grade !== null && !Number.isFinite(grade)) return;
    this.grades.setGrade(this.courseId, itemId, userId, grade).subscribe(() => this.load());
  }

  exportCsv(): void {
    this.grades.exportCsv(this.courseId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'calificaciones.csv';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /* ------------------------------- Ítems --------------------------------- */

  openNewItem(): void {
    this.editingItem.set(null);
    this.itemForm.reset({
      name: '',
      gradeType: GradeType.Value,
      categoryId: '',
      scaleId: '',
      grademax: 100,
      grademin: 0,
      gradepass: 50,
      weight: 1,
      decimals: 2,
      hidden: false,
    });
    this.itemFormOpen.set(true);
  }

  openEditItem(item: GradeItemDto): void {
    this.editingItem.set(item);
    this.itemForm.reset({
      name: item.name,
      gradeType: item.gradeType,
      categoryId: item.categoryId ?? '',
      scaleId: item.scaleId ?? '',
      grademax: item.grademax,
      grademin: item.grademin,
      gradepass: item.gradepass ?? 0,
      weight: item.weight,
      decimals: 2,
      hidden: item.hidden,
    });
    this.itemFormOpen.set(true);
  }

  saveItem(): void {
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      return;
    }
    const value = this.itemForm.getRawValue();
    const payload: Record<string, unknown> = {
      name: value.name.trim(),
      gradeType: value.gradeType,
      grademax: Number(value.grademax),
      grademin: Number(value.grademin),
      gradepass: Number(value.gradepass),
      weight: Number(value.weight),
      decimals: Number(value.decimals),
      hidden: value.hidden,
    };
    if (value.categoryId) payload['categoryId'] = value.categoryId;
    if (value.gradeType === GradeType.Scale && value.scaleId) payload['scaleId'] = value.scaleId;

    const current = this.editingItem();
    const request = current
      ? this.grades.updateItem(this.courseId, current.id, payload)
      : this.grades.createItem(this.courseId, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Ítem actualizado' : 'Ítem creado');
        this.itemFormOpen.set(false);
        this.openSetup();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  removeItem(item: GradeItemDto): void {
    this.confirm
      .ask({
        title: 'Eliminar ítem de calificación',
        message: `Se eliminará «${item.name}» y todas las calificaciones que contiene.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.grades.removeItem(this.courseId, item.id).subscribe({
          next: () => {
            this.toast.success('Ítem eliminado');
            this.openSetup();
            this.load();
          },
        });
      });
  }

  /* ----------------------------- Categorías ------------------------------ */

  openNewCategory(): void {
    this.editingCategory.set(null);
    this.categoryForm.reset({
      name: '',
      parentId: '',
      aggregation: GradeAggregation.Mean,
      aggregateOnlyGraded: true,
      dropLowest: 0,
      keepHighest: 0,
    });
    this.categoryFormOpen.set(true);
  }

  openEditCategory(category: GradeCategoryDto): void {
    this.editingCategory.set(category);
    this.categoryForm.reset({
      name: category.name,
      parentId: category.parentId ?? '',
      aggregation: category.aggregation,
      aggregateOnlyGraded: category.aggregateOnlyGraded,
      dropLowest: category.dropLowest,
      keepHighest: category.keepHighest,
    });
    this.categoryFormOpen.set(true);
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const value = this.categoryForm.getRawValue();
    const payload: Record<string, unknown> = {
      name: value.name.trim(),
      aggregation: value.aggregation,
      aggregateOnlyGraded: value.aggregateOnlyGraded,
      dropLowest: Number(value.dropLowest),
      keepHighest: Number(value.keepHighest),
    };
    if (value.parentId) payload['parentId'] = value.parentId;

    const current = this.editingCategory();
    const request = current
      ? this.grades.updateCategory(this.courseId, current.id, payload)
      : this.grades.createCategory(this.courseId, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Categoría actualizada' : 'Categoría creada');
        this.categoryFormOpen.set(false);
        this.openSetup();
      },
      error: () => this.saving.set(false),
    });
  }

  removeCategory(category: GradeCategoryDto): void {
    this.confirm
      .ask({
        title: 'Eliminar categoría',
        message: `Se eliminará «${category.name}». Los ítems que contiene pasan a la categoría superior.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.grades.removeCategory(this.courseId, category.id).subscribe({
          next: () => {
            this.toast.success('Categoría eliminada');
            this.openSetup();
          },
        });
      });
  }

  /* ------------------------------- Escalas ------------------------------- */

  openNewScale(): void {
    this.scaleForm.reset({ name: '', description: '', items: '' });
    this.scaleFormOpen.set(true);
  }

  saveScale(): void {
    if (this.scaleForm.invalid) {
      this.scaleForm.markAllAsTouched();
      return;
    }
    const value = this.scaleForm.getRawValue();
    const items = value.items
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (items.length < 2) {
      this.toast.warning('Escala incompleta', 'Escriba al menos dos niveles, uno por línea.');
      return;
    }

    this.saving.set(true);
    this.grades
      .createScale({
        name: value.name.trim(),
        description: value.description.trim() || undefined,
        items,
        courseId: this.courseId,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Escala creada');
          this.scaleFormOpen.set(false);
          this.openSetup();
        },
        error: () => this.saving.set(false),
      });
  }

  /* -------------------------------- Letras ------------------------------- */

  updateLetter(index: number, field: 'letter' | 'lowerBoundary', value: string): void {
    this.letterDraft.update((list) =>
      list.map((item, i) =>
        i === index
          ? { ...item, [field]: field === 'lowerBoundary' ? Number(value) : value }
          : item,
      ),
    );
  }

  addLetter(): void {
    this.letterDraft.update((list) => [...list, { letter: '', lowerBoundary: 0 }]);
  }

  removeLetter(index: number): void {
    this.letterDraft.update((list) => list.filter((_, i) => i !== index));
  }

  saveLetters(): void {
    const draft = this.letterDraft().filter((item) => item.letter.trim());
    if (!draft.length) {
      this.toast.warning('Sin letras', 'Defina al menos una letra de calificación.');
      return;
    }
    this.saving.set(true);
    this.grades.setLetters(this.courseId, draft).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.letters.set(saved);
        this.toast.success('Letras guardadas');
      },
      error: () => this.saving.set(false),
    });
  }
}
