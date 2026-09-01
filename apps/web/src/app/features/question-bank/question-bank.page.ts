import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CAP, QuestionCategoryDto, QuestionDto, QuestionType } from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { QuestionsService } from '../../core/services/questions.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent, ModalComponent, SafeHtmlPipe } from '../../shared';

/** Tipos con lista de respuestas editable. */
const CON_RESPUESTAS: QuestionType[] = [
  QuestionType.MultiChoice,
  QuestionType.ShortAnswer,
  QuestionType.Numerical,
];

@Component({
  selector: 'maya-question-bank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    EmptyStateComponent,
    SafeHtmlPipe,
    ModalComponent,
  ],
  templateUrl: './question-bank.page.html',
})
export class QuestionBankPage {
  private readonly questions = inject(QuestionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<QuestionDto[]>([]);
  readonly categories = signal<QuestionCategoryDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly search = signal('');
  readonly type = signal('');
  readonly categoryId = signal('');

  /** Pregunta en edición; `null` significa «pregunta nueva». */
  readonly editing = signal<QuestionDto | null>(null);
  readonly formOpen = signal(false);
  readonly importOpen = signal(false);

  readonly canEdit = computed(() => this.auth.canAny([CAP.QUESTION_ADD, CAP.QUESTION_EDIT_ALL]));

  readonly types = [
    { value: QuestionType.MultiChoice, label: 'Opción múltiple' },
    { value: QuestionType.TrueFalse, label: 'Verdadero / Falso' },
    { value: QuestionType.ShortAnswer, label: 'Respuesta corta' },
    { value: QuestionType.Numerical, label: 'Numérica' },
    { value: QuestionType.Matching, label: 'Emparejamiento' },
    { value: QuestionType.Essay, label: 'Ensayo' },
  ];

  readonly form = this.fb.nonNullable.group({
    type: [QuestionType.MultiChoice as QuestionType, [Validators.required]],
    name: ['', [Validators.required]],
    questionText: ['', [Validators.required]],
    categoryId: ['', [Validators.required]],
    generalFeedback: [''],
    defaultMark: [1],
    penalty: [0],
    shuffleAnswers: [true],
    single: [true],
    tolerance: [0],
    answers: this.fb.array<ReturnType<QuestionBankPage['answerGroup']>>([]),
    subquestions: this.fb.array<ReturnType<QuestionBankPage['subquestionGroup']>>([]),
  });

  readonly importForm = this.fb.nonNullable.group({
    format: ['gift' as 'gift' | 'json'],
    categoryId: ['', [Validators.required]],
    content: ['', [Validators.required]],
  });

  /** El tipo elegido decide qué campos del formulario tienen sentido. */
  readonly selectedType = signal<QuestionType>(QuestionType.MultiChoice);
  readonly usesAnswers = computed(() => CON_RESPUESTAS.includes(this.selectedType()));
  readonly usesSubquestions = computed(() => this.selectedType() === QuestionType.Matching);
  readonly isNumerical = computed(() => this.selectedType() === QuestionType.Numerical);
  readonly isMultiChoice = computed(() => this.selectedType() === QuestionType.MultiChoice);

  get answers(): FormArray {
    return this.form.controls.answers as unknown as FormArray;
  }

  get subquestions(): FormArray {
    return this.form.controls.subquestions as unknown as FormArray;
  }

  constructor() {
    this.load();
    this.questions.categories().subscribe({
      next: (list) => {
        if (list.length) {
          this.applyCategories(list);
          return;
        }
        // Una empresa sin cursos con banco propio no tiene ninguna categoría;
        // sin ella no se podría crear la primera pregunta.
        this.questions.defaultCategory().subscribe({
          next: (category) => this.applyCategories([category]),
        });
      },
    });
  }

  private applyCategories(list: QuestionCategoryDto[]): void {
    this.categories.set(list);
    this.form.controls.categoryId.setValue(list[0].id);
    this.importForm.controls.categoryId.setValue(list[0].id);
  }

  load(): void {
    this.loading.set(true);
    this.questions
      .list({
        limit: 50,
        search: this.search() || undefined,
        type: this.type() || undefined,
        categoryId: this.categoryId() || undefined,
      })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  typeLabel(type: QuestionType): string {
    return this.types.find((item) => item.value === type)?.label ?? type;
  }

  categoryName(id: string): string {
    return this.categories().find((item) => item.id === id)?.name ?? 'Sin categoría';
  }

  /* ------------------------------ Edición ------------------------------- */

  private answerGroup(text = '', fraction = 0, feedback = '') {
    return this.fb.nonNullable.group({
      text: [text, [Validators.required]],
      fraction: [fraction],
      feedback: [feedback],
    });
  }

  private subquestionGroup(text = '', answer = '') {
    return this.fb.nonNullable.group({
      text: [text, [Validators.required]],
      answer: [answer, [Validators.required]],
    });
  }

  openNew(): void {
    this.editing.set(null);
    this.selectedType.set(QuestionType.MultiChoice);
    this.answers.clear();
    this.subquestions.clear();
    this.form.reset({
      type: QuestionType.MultiChoice,
      name: '',
      questionText: '',
      categoryId: this.categories()[0]?.id ?? '',
      generalFeedback: '',
      defaultMark: 1,
      penalty: 0,
      shuffleAnswers: true,
      single: true,
      tolerance: 0,
    });
    // Dos opciones en blanco: el mínimo que acepta la API.
    this.answers.push(this.answerGroup('', 1));
    this.answers.push(this.answerGroup('', 0));
    this.formOpen.set(true);
  }

  openEdit(question: QuestionDto): void {
    this.questions.detail(question.id).subscribe({
      next: (full) => {
        this.editing.set(full);
        this.selectedType.set(full.type);
        this.answers.clear();
        this.subquestions.clear();
        for (const answer of full.answers) {
          this.answers.push(this.answerGroup(answer.text, answer.fraction, answer.feedback ?? ''));
        }
        for (const sub of full.subquestions ?? []) {
          this.subquestions.push(this.subquestionGroup(sub.text, sub.answer));
        }
        this.form.patchValue({
          type: full.type,
          name: full.name,
          questionText: full.questionText,
          categoryId: full.categoryId,
          generalFeedback: full.generalFeedback ?? '',
          defaultMark: full.defaultMark,
          penalty: full.penalty,
          shuffleAnswers: full.shuffleAnswers,
          single: full.single,
          tolerance: full.tolerance ?? 0,
        });
        this.formOpen.set(true);
      },
    });
  }

  changeType(type: QuestionType): void {
    this.selectedType.set(type);
    this.form.controls.type.setValue(type);

    if (type === QuestionType.TrueFalse) {
      this.answers.clear();
      this.answers.push(this.answerGroup('Verdadero', 1));
      this.answers.push(this.answerGroup('Falso', 0));
      return;
    }
    if (type === QuestionType.Matching) {
      this.answers.clear();
      if (!this.subquestions.length) {
        this.addSubquestion();
        this.addSubquestion();
      }
      return;
    }
    if (type === QuestionType.Essay) {
      this.answers.clear();
      this.subquestions.clear();
      return;
    }
    this.subquestions.clear();
    if (!this.answers.length) {
      this.answers.push(this.answerGroup('', 1));
      this.answers.push(this.answerGroup('', 0));
    }
  }

  addAnswer(): void {
    this.answers.push(this.answerGroup());
  }

  removeAnswer(index: number): void {
    this.answers.removeAt(index);
  }

  addSubquestion(): void {
    this.subquestions.push(this.subquestionGroup());
  }

  removeSubquestion(index: number): void {
    this.subquestions.removeAt(index);
  }

  close(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning('Faltan datos', 'Revise los campos marcados en rojo.');
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      type: value.type,
      name: value.name.trim(),
      questionText: value.questionText.trim(),
      categoryId: value.categoryId,
      generalFeedback: value.generalFeedback.trim() || undefined,
      defaultMark: Number(value.defaultMark),
      penalty: Number(value.penalty),
      shuffleAnswers: value.shuffleAnswers,
      single: value.single,
      ...(this.isNumerical() ? { tolerance: Number(value.tolerance) } : {}),
      ...(this.usesSubquestions()
        ? { subquestions: value.subquestions, answers: [] }
        : { answers: value.answers }),
    };

    const current = this.editing();
    const request = current
      ? this.questions.update(current.id, payload)
      : this.questions.create(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Pregunta actualizada' : 'Pregunta creada');
        this.close();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  duplicate(question: QuestionDto): void {
    this.questions.duplicate(question.id).subscribe({
      next: () => {
        this.toast.success('Pregunta duplicada');
        this.load();
      },
    });
  }

  remove(question: QuestionDto): void {
    this.confirm
      .ask({
        title: 'Eliminar pregunta',
        message: `Se eliminará «${question.name}» del banco. Los cuestionarios que ya la usen conservan los intentos realizados.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.questions.remove(question.id).subscribe({
          next: () => {
            this.items.update((list) => list.filter((item) => item.id !== question.id));
            this.toast.success('Pregunta eliminada');
          },
        });
      });
  }

  /* ---------------------------- Importación ----------------------------- */

  runImport(): void {
    if (this.importForm.invalid) {
      this.importForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.questions.import(this.importForm.getRawValue()).subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.errors.length) {
          this.toast.warning(
            `${result.imported} preguntas importadas`,
            `${result.errors.length} no se pudieron leer: ${result.errors[0]}`,
          );
        } else {
          this.toast.success(`${result.imported} preguntas importadas`);
        }
        this.importOpen.set(false);
        this.importForm.controls.content.setValue('');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
