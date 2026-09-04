import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CAP,
  CourseModuleDto,
  QuestionDto,
  QuestionType,
  QuizAttemptDto,
  QuizAttemptState,
  QuizDto,
} from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { FormatDatePipe, IconComponent, SafeHtmlPipe } from '../../shared';

@Component({
  selector: 'maya-quiz',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SafeHtmlPipe, FormatDatePipe],
  templateUrl: './quiz.page.html',
  styleUrl: './activity.shared.scss',
})
export class QuizPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Los accesos de docencia se ocultan a quien no puede usarlos. */
  readonly canManage = computed(() => this.auth.can(CAP.QUIZ_MANAGE));
  readonly canGrade = computed(() => this.auth.can(CAP.QUIZ_GRADE));

  readonly QuestionType = QuestionType;
  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;

  readonly module = signal<CourseModuleDto | null>(null);
  readonly quiz = signal<QuizDto | null>(null);
  readonly attempts = signal<QuizAttemptDto[]>([]);
  readonly loading = signal(true);

  /** Estado del intento en curso. */
  readonly attempt = signal<QuizAttemptDto | null>(null);
  readonly questions = signal<QuestionDto[]>([]);
  readonly answers = signal<Record<string, unknown>>({});
  readonly current = signal(0);
  readonly remaining = signal<number | null>(null);
  private timer?: ReturnType<typeof setInterval>;

  readonly bestGrade = computed(() => {
    const grades = this.attempts()
      .filter((a) => a.state === QuizAttemptState.Finished)
      .map((a) => a.grade ?? 0);
    return grades.length ? Math.max(...grades) : null;
  });

  readonly canAttempt = computed(() => {
    const quiz = this.quiz();
    if (!quiz) return false;
    if (quiz.attemptsAllowed === 0) return true;
    return this.attempts().length < quiz.attemptsAllowed;
  });

  readonly currentQuestion = computed(() => this.questions()[this.current()] ?? null);

  readonly timerLabel = computed(() => {
    const seconds = this.remaining();
    if (seconds === null) return null;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  });

  constructor() {
    this.activities.quiz(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.quiz.set(data.quiz);
        this.attempts.set(data.attempts);
        this.loading.set(false);
        const inProgress = data.attempts.find((a) => a.state === QuizAttemptState.InProgress);
        if (inProgress) this.resume(inProgress);
      },
      error: () => this.loading.set(false),
    });
  }

  start(): void {
    this.activities.startAttempt(this.moduleId).subscribe({
      next: (attempt) => this.resume(attempt),
    });
  }

  private resume(attempt: QuizAttemptDto): void {
    this.attempt.set(attempt);
    this.current.set(0);
    const previous: Record<string, unknown> = {};
    for (const response of attempt.responses) {
      if (response.answer !== null) previous[response.questionId] = response.answer;
    }
    this.answers.set(previous);

    this.activities.attemptQuestions(attempt.id).subscribe({
      next: (questions) => this.questions.set(questions),
    });

    if (attempt.dueAt) this.startTimer(new Date(attempt.dueAt));
  }

  private startTimer(dueAt: Date): void {
    clearInterval(this.timer);
    const tick = () => {
      const seconds = Math.max(0, Math.floor((dueAt.getTime() - Date.now()) / 1000));
      this.remaining.set(seconds);
      if (seconds <= 0) {
        clearInterval(this.timer);
        this.finish(true);
      }
    };
    tick();
    this.timer = setInterval(tick, 1000);
  }

  select(questionId: string, value: unknown): void {
    this.answers.update((map) => ({ ...map, [questionId]: value }));
    const attempt = this.attempt();
    if (attempt) {
      this.activities.saveResponse(attempt.id, questionId, value).subscribe();
    }
  }

  isSelected(questionId: string, value: unknown): boolean {
    return this.answers()[questionId] === value;
  }

  next(): void {
    if (this.current() < this.questions().length - 1) this.current.update((i) => i + 1);
  }

  previous(): void {
    if (this.current() > 0) this.current.update((i) => i - 1);
  }

  goTo(index: number): void {
    this.current.set(index);
  }

  isAnswered(index: number): boolean {
    const question = this.questions()[index];
    return question ? this.answers()[question.id] !== undefined : false;
  }

  finish(auto = false): void {
    const attempt = this.attempt();
    if (!attempt) return;
    clearInterval(this.timer);
    this.activities.finishAttempt(attempt.id).subscribe({
      next: (finished) => {
        this.attempt.set(null);
        this.questions.set([]);
        this.remaining.set(null);
        this.attempts.update((list) => [...list.filter((a) => a.id !== finished.id), finished]);
        this.toast.success(
          auto ? 'Tiempo agotado' : 'Examen enviado',
          this.pendingReview(finished)
            ? 'Tiene preguntas de desarrollo: recibirá la nota cuando el profesorado las evalúe.'
            : `Calificación: ${finished.grade} / ${this.quiz()?.maxGrade}`,
        );
      },
    });
  }

  /**
   * Veredicto del intento, o `null` si el examen no tiene nota de corte.
   *
   * Devuelve la etiqueta ya escrita en lugar de un booleano porque «sin nota
   * mínima» y «suspenso» son cosas distintas y un booleano las confundiría.
   */
  aprobado(attempt: QuizAttemptDto, quiz: QuizDto): string | null {
    const corte = quiz.passingGrade;
    if (corte === null || corte === undefined || attempt.grade === null || attempt.grade === undefined) {
      return null;
    }
    return attempt.grade >= corte ? 'Aprobado' : 'Suspenso';
  }

  /** ¿Este intento espera todavía que una persona evalúe alguna respuesta? */
  pendingReview(attempt: QuizAttemptDto): boolean {
    return attempt.responses.some((response) => response.needsManualGrading);
  }

  stateLabel(state: QuizAttemptState): string {
    switch (state) {
      case QuizAttemptState.Finished:
        return 'Finalizado';
      case QuizAttemptState.InProgress:
        return 'En curso';
      case QuizAttemptState.Overdue:
        return 'Fuera de plazo';
      default:
        return 'Abandonado';
    }
  }
}
