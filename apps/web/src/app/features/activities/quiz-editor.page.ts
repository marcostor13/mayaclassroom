import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  QuestionCategoryDto,
  QuestionDto,
  QuestionType,
  QuizDto,
  QuizGradeMethod,
} from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { QuestionsService } from '../../core/services/questions.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent, ModalComponent } from '../../shared';

/** Una opción de respuesta mientras se escribe la pregunta. */
interface OpcionBorrador {
  text: string;
  correct: boolean;
}

/** Los tipos que el editor sabe componer, con su explicación. */
const TIPOS: { type: QuestionType; label: string; hint: string; icon: string }[] = [
  {
    type: QuestionType.MultiChoice,
    label: 'Opción múltiple',
    hint: 'Varias alternativas; se corrige sola',
    icon: 'check',
  },
  {
    type: QuestionType.TrueFalse,
    label: 'Verdadero o falso',
    hint: 'Dos alternativas; se corrige sola',
    icon: 'check',
  },
  {
    type: QuestionType.ShortAnswer,
    label: 'Respuesta corta',
    hint: 'Una palabra o cifra exacta; se corrige sola',
    icon: 'edit',
  },
  {
    type: QuestionType.Numerical,
    label: 'Numérica',
    hint: 'Un número con margen de tolerancia',
    icon: 'target',
  },
  {
    type: QuestionType.Essay,
    label: 'Desarrollo',
    hint: 'Texto libre; la evalúa el profesorado',
    icon: 'file-text',
  },
  {
    type: QuestionType.Matching,
    label: 'Emparejamiento',
    hint: 'Relacionar cada enunciado con su respuesta',
    icon: 'link',
  },
];

/**
 * Editor de exámenes.
 *
 * Compone el examen en una sola pantalla: escribir una pregunta, ponerle nota y
 * ordenarla no obliga a salir al banco de preguntas ni a volver. El banco sigue
 * ahí para reutilizar lo ya escrito, pero deja de ser el paso obligado, que es
 * lo que hacía que montar un examen costara una tarde.
 *
 * Cada pregunta se guarda en cuanto se acepta, no al final: un examen a medio
 * montar no se pierde al cerrar la pestaña.
 */
@Component({
  selector: 'maya-quiz-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, IconComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './quiz-editor.page.html',
  styleUrl: './quiz-editor.page.scss',
})
export class QuizEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly questions = inject(QuestionsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly QuestionType = QuestionType;
  readonly tipos = TIPOS;

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly quiz = signal<QuizDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly tab = signal<'questions' | 'settings'>('questions');

  private category: QuestionCategoryDto | null = null;

  /* ----------------------------- Ajustes -------------------------------- */

  readonly name = signal('');
  readonly intro = signal('');
  readonly maxGrade = signal(20);
  readonly passingGrade = signal<number | null>(null);
  readonly attemptsAllowed = signal(1);
  readonly timeLimitMinutes = signal(0);
  readonly gradeMethod = signal<QuizGradeMethod>(QuizGradeMethod.Highest);
  readonly shuffleQuestions = signal(false);
  readonly shuffleAnswers = signal(true);
  readonly showCorrectAnswers = signal(true);
  readonly requiredToPass = signal(false);
  readonly blocksProgress = signal(false);
  readonly timeOpen = signal('');
  readonly timeClose = signal('');

  readonly gradeMethods = [
    { value: QuizGradeMethod.Highest, label: 'La nota más alta' },
    { value: QuizGradeMethod.Average, label: 'La media de los intentos' },
    { value: QuizGradeMethod.First, label: 'El primer intento' },
    { value: QuizGradeMethod.Last, label: 'El último intento' },
  ];

  /* --------------------------- Composición ------------------------------ */

  readonly composerOpen = signal(false);
  readonly bankOpen = signal(false);
  readonly editingId = signal<string | null>(null);

  readonly draftType = signal<QuestionType>(QuestionType.MultiChoice);
  readonly draftName = signal('');
  readonly draftText = signal('');
  readonly draftMark = signal(1);
  readonly draftFeedback = signal('');
  readonly draftRubric = signal('');
  readonly draftTolerance = signal(0);
  readonly draftMultiple = signal(false);
  readonly draftOptions = signal<OpcionBorrador[]>([
    { text: '', correct: true },
    { text: '', correct: false },
  ]);
  readonly draftPairs = signal<{ text: string; answer: string }[]>([{ text: '', answer: '' }]);

  readonly bankItems = signal<QuestionDto[]>([]);
  readonly bankSearch = signal('');
  readonly bankSelected = signal<Set<string>>(new Set());

  /* ----------------------------- Derivados ------------------------------ */

  readonly slots = computed(() => this.quiz()?.questions ?? []);

  readonly totalMarks = computed(() =>
    this.slots().reduce((sum, slot) => sum + slot.maxMark, 0),
  );

  /** Cuántas preguntas tendrá que evaluar una persona a mano. */
  readonly manualCount = computed(
    () => this.slots().filter((slot) => slot.question?.type === QuestionType.Essay).length,
  );

  readonly pendingGrading = computed(() => this.quiz()?.pendingManualGrading ?? 0);

  /** Un examen sin preguntas no se puede abrir; conviene decirlo antes. */
  readonly ready = computed(() => this.slots().length > 0);

  /** El corte, escrito como se leerá en el boletín. */
  readonly passingLabel = computed(() => {
    const passing = this.passingGrade();
    if (passing === null) return 'Sin nota mínima';
    return `Aprueba con ${passing} de ${this.maxGrade()}`;
  });

  readonly composerValid = computed(() => {
    if (!this.draftText().trim()) return false;
    switch (this.draftType()) {
      case QuestionType.MultiChoice:
        return (
          this.draftOptions().filter((o) => o.text.trim()).length >= 2 &&
          this.draftOptions().some((o) => o.correct && o.text.trim())
        );
      case QuestionType.TrueFalse:
        return true;
      case QuestionType.ShortAnswer:
      case QuestionType.Numerical:
        return this.draftOptions().some((o) => o.text.trim());
      case QuestionType.Matching:
        return this.draftPairs().some((p) => p.text.trim() && p.answer.trim());
      default:
        return true;
    }
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.activities.quizForEdit(this.moduleId).subscribe({
      next: (quiz) => {
        this.apply(quiz);
        this.loading.set(false);
        this.questions.defaultCourseCategory(quiz.courseId).subscribe({
          next: (category) => (this.category = category),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private apply(quiz: QuizDto): void {
    this.quiz.set(quiz);
    this.name.set(quiz.name);
    this.intro.set(quiz.intro ?? '');
    this.maxGrade.set(quiz.maxGrade);
    this.passingGrade.set(quiz.passingGrade ?? null);
    this.attemptsAllowed.set(quiz.attemptsAllowed);
    this.timeLimitMinutes.set(Math.round(quiz.timeLimitSeconds / 60));
    this.gradeMethod.set(quiz.gradeMethod);
    this.shuffleQuestions.set(quiz.shuffleQuestions);
    this.shuffleAnswers.set(quiz.shuffleAnswers);
    this.showCorrectAnswers.set(quiz.showCorrectAnswers);
    this.requiredToPass.set(quiz.requiredToPass);
    this.blocksProgress.set(quiz.blocksProgress);
    this.timeOpen.set(quiz.timeOpen ? quiz.timeOpen.slice(0, 16) : '');
    this.timeClose.set(quiz.timeClose ? quiz.timeClose.slice(0, 16) : '');
  }

  /* ------------------------------ Ajustes ------------------------------- */

  saveSettings(): void {
    if (this.saving()) return;
    this.saving.set(true);

    // Un examen obligatorio sin corte no puede aprobarse ni suspenderse: se
    // propone la mitad, que es lo que hace la API si llega sin nada.
    const passing =
      this.requiredToPass() && this.passingGrade() === null
        ? Math.round((this.maxGrade() / 2) * 100) / 100
        : this.passingGrade();

    this.activities
      .saveQuizSettings(this.moduleId, {
        name: this.name().trim() || undefined,
        intro: this.intro(),
        maxGrade: this.maxGrade(),
        passingGrade: passing ?? undefined,
        attemptsAllowed: this.attemptsAllowed(),
        timeLimitSeconds: this.timeLimitMinutes() * 60,
        gradeMethod: this.gradeMethod(),
        shuffleQuestions: this.shuffleQuestions(),
        shuffleAnswers: this.shuffleAnswers(),
        showCorrectAnswers: this.showCorrectAnswers(),
        requiredToPass: this.requiredToPass(),
        blocksProgress: this.blocksProgress(),
        timeOpen: this.timeOpen() ? new Date(this.timeOpen()).toISOString() : undefined,
        timeClose: this.timeClose() ? new Date(this.timeClose()).toISOString() : undefined,
      })
      .subscribe({
        next: (quiz) => {
          this.apply(quiz);
          this.saving.set(false);
          this.toast.success('Examen guardado');
        },
        error: () => this.saving.set(false),
      });
  }

  /* ---------------------------- Composición ----------------------------- */

  openComposer(type: QuestionType): void {
    this.editingId.set(null);
    this.draftType.set(type);
    this.draftName.set('');
    this.draftText.set('');
    this.draftFeedback.set('');
    this.draftRubric.set('');
    this.draftTolerance.set(0);
    this.draftMultiple.set(false);
    this.draftMark.set(type === QuestionType.Essay ? 5 : 1);
    this.draftOptions.set(
      type === QuestionType.TrueFalse
        ? [
            { text: 'Verdadero', correct: true },
            { text: 'Falso', correct: false },
          ]
        : [
            { text: '', correct: true },
            { text: '', correct: false },
          ],
    );
    this.draftPairs.set([{ text: '', answer: '' }]);
    this.composerOpen.set(true);
  }

  /** Abre el compositor con lo que ya tiene una pregunta, para retocarla. */
  editQuestion(question: QuestionDto, maxMark: number): void {
    this.editingId.set(question.id);
    this.draftType.set(question.type);
    this.draftName.set(question.name);
    this.draftText.set(question.questionText);
    this.draftMark.set(maxMark);
    this.draftFeedback.set(question.generalFeedback ?? '');
    this.draftRubric.set(question.rubric ?? '');
    this.draftTolerance.set(question.tolerance ?? 0);
    this.draftMultiple.set(!question.single);
    this.draftOptions.set(
      question.answers.length
        ? question.answers.map((a) => ({ text: a.text, correct: a.fraction > 0 }))
        : [
            { text: '', correct: true },
            { text: '', correct: false },
          ],
    );
    this.draftPairs.set(
      question.subquestions?.length ? [...question.subquestions] : [{ text: '', answer: '' }],
    );
    this.composerOpen.set(true);
  }

  closeComposer(): void {
    this.composerOpen.set(false);
  }

  addOption(): void {
    this.draftOptions.update((list) => [...list, { text: '', correct: false }]);
  }

  removeOption(index: number): void {
    this.draftOptions.update((list) => list.filter((_, i) => i !== index));
  }

  setOptionText(index: number, text: string): void {
    this.draftOptions.update((list) =>
      list.map((option, i) => (i === index ? { ...option, text } : option)),
    );
  }

  /**
   * Marca la opción correcta.
   *
   * En una pregunta de respuesta única marcar una desmarca el resto; con varias
   * correctas cada casilla va por su cuenta.
   */
  toggleCorrect(index: number): void {
    const multiple = this.draftMultiple() && this.draftType() === QuestionType.MultiChoice;
    this.draftOptions.update((list) =>
      list.map((option, i) => ({
        ...option,
        correct: multiple ? (i === index ? !option.correct : option.correct) : i === index,
      })),
    );
  }

  addPair(): void {
    this.draftPairs.update((list) => [...list, { text: '', answer: '' }]);
  }

  removePair(index: number): void {
    this.draftPairs.update((list) => list.filter((_, i) => i !== index));
  }

  setPair(index: number, field: 'text' | 'answer', value: string): void {
    this.draftPairs.update((list) =>
      list.map((pair, i) => (i === index ? { ...pair, [field]: value } : pair)),
    );
  }

  /** Guarda la pregunta y, si es nueva, la añade al examen. */
  submitComposer(): void {
    if (!this.composerValid() || this.saving()) return;
    const categoryId = this.category?.id;
    if (!categoryId) {
      this.toast.error('No se ha podido resolver la categoría de preguntas del curso.');
      return;
    }

    const type = this.draftType();
    const opciones = this.draftOptions().filter((o) => o.text.trim());
    const payload = {
      type,
      // Sin nombre propio, el enunciado recortado sirve de nombre en el banco:
      // pedirlo dos veces solo alarga el formulario.
      name: this.draftName().trim() || this.draftText().replace(/<[^>]*>/g, '').slice(0, 60),
      questionText: this.draftText().trim(),
      categoryId,
      courseId: this.quiz()?.courseId,
      generalFeedback: this.draftFeedback() || undefined,
      rubric: type === QuestionType.Essay ? this.draftRubric() || undefined : undefined,
      defaultMark: this.draftMark(),
      single: type === QuestionType.MultiChoice ? !this.draftMultiple() : true,
      tolerance: type === QuestionType.Numerical ? this.draftTolerance() : undefined,
      answers:
        type === QuestionType.Essay || type === QuestionType.Matching
          ? undefined
          : opciones.map((option) => ({
              text: option.text.trim(),
              // Con varias correctas el acierto se reparte, para que marcarlas
              // todas sume exactamente la puntuación completa.
              fraction: option.correct
                ? this.draftMultiple() && type === QuestionType.MultiChoice
                  ? 1 / Math.max(1, opciones.filter((o) => o.correct).length)
                  : 1
                : 0,
            })),
      subquestions:
        type === QuestionType.Matching
          ? this.draftPairs().filter((p) => p.text.trim() && p.answer.trim())
          : undefined,
    };

    this.saving.set(true);
    const editing = this.editingId();
    const request = editing
      ? this.questions.update(editing, payload)
      : this.questions.create(payload);

    request.subscribe({
      next: (question) => {
        if (editing) {
          this.activities
            .setQuizQuestionMark(this.moduleId, question.id, this.draftMark())
            .subscribe({ next: () => this.refresh('Pregunta actualizada') });
        } else {
          this.activities.addQuizQuestions(this.moduleId, [question.id]).subscribe({
            next: () => {
              this.activities
                .setQuizQuestionMark(this.moduleId, question.id, this.draftMark())
                .subscribe({ next: () => this.refresh('Pregunta añadida') });
            },
          });
        }
      },
      error: () => this.saving.set(false),
    });
  }

  private refresh(message: string): void {
    this.activities.quizForEdit(this.moduleId).subscribe({
      next: (quiz) => {
        this.apply(quiz);
        this.saving.set(false);
        this.composerOpen.set(false);
        this.toast.success(message);
      },
      error: () => this.saving.set(false),
    });
  }

  /* -------------------------- Banco de preguntas ------------------------- */

  openBank(): void {
    this.bankSelected.set(new Set());
    this.bankOpen.set(true);
    this.questions.list({ limit: 50, courseId: this.quiz()?.courseId }).subscribe({
      next: (page) => this.bankItems.set(page.items),
    });
  }

  searchBank(): void {
    this.questions
      .list({ limit: 50, search: this.bankSearch() || undefined })
      .subscribe({ next: (page) => this.bankItems.set(page.items) });
  }

  toggleBank(id: string): void {
    this.bankSelected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  addFromBank(): void {
    const ids = [...this.bankSelected()];
    if (!ids.length) return;
    this.saving.set(true);
    this.activities.addQuizQuestions(this.moduleId, ids).subscribe({
      next: () => {
        this.bankOpen.set(false);
        this.refresh(`${ids.length} preguntas añadidas`);
      },
      error: () => this.saving.set(false),
    });
  }

  /** ¿Está ya en el examen? Evita añadir la misma pregunta dos veces. */
  inQuiz(id: string): boolean {
    return this.slots().some((slot) => slot.questionId === id);
  }

  /* -------------------------- Orden y puntuación ------------------------- */

  move(index: number, delta: number): void {
    const ids = this.slots().map((slot) => slot.questionId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.activities.reorderQuizQuestions(this.moduleId, ids).subscribe({
      next: (quiz) => this.apply(quiz),
    });
  }

  setMark(questionId: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) return;
    this.activities.setQuizQuestionMark(this.moduleId, questionId, value).subscribe({
      next: (quiz) => this.apply(quiz),
    });
  }

  remove(questionId: string, name: string): void {
    this.confirm
      .ask({
        title: 'Quitar la pregunta del examen',
        message: `«${name}» dejará de formar parte del examen. Seguirá en el banco de preguntas.`,
        confirmLabel: 'Quitar',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.activities.removeQuizQuestion(this.moduleId, questionId).subscribe({
          next: (quiz) => {
            this.apply(quiz);
            this.toast.success('Pregunta retirada');
          },
        });
      });
  }

  typeLabel(type: QuestionType | undefined): string {
    return TIPOS.find((t) => t.type === type)?.label ?? 'Pregunta';
  }
}
