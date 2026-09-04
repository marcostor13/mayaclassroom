import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuizGradingItem, QuizGradingQueue } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
} from '../../shared';

/** Lo que quien corrige va escribiendo, antes de guardarlo. */
interface Correccion {
  mark: number | null;
  feedback: string;
}

/**
 * Corrección de las preguntas que evalúa una persona.
 *
 * Agrupa por pregunta y no por alumno a propósito: corregir treinta respuestas
 * a la misma pregunta seguidas es lo que hace que el criterio se mantenga
 * igual de la primera a la última. La pauta de corrección queda fija arriba
 * mientras se recorre el grupo.
 *
 * Nada se envía hasta pulsar guardar, y se envía todo junto: media tanda
 * guardada dejaría exámenes con nota provisional sin que nadie lo supiera.
 */
@Component({
  selector: 'maya-quiz-grading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    FormatDatePipe,
  ],
  templateUrl: './quiz-grading.page.html',
  styleUrl: './quiz-grading.page.scss',
})
export class QuizGradingPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly queue = signal<QuizGradingQueue | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showGraded = signal(false);

  /** Pregunta que se está corrigiendo; `null` mientras se elige. */
  readonly focusedQuestion = signal<string | null>(null);

  /** Correcciones en curso, indexadas por intento y pregunta. */
  private readonly drafts = signal<Record<string, Correccion>>({});

  readonly items = computed(() => {
    const data = this.queue();
    if (!data) return [];
    return this.showGraded() ? [...data.pending, ...data.graded] : data.pending;
  });

  /** Las preguntas presentes en la cola, con cuántas respuestas esperan. */
  readonly questions = computed(() => {
    const byQuestion = new Map<string, { id: string; name: string; pending: number; total: number }>();
    const data = this.queue();
    if (!data) return [];
    for (const item of [...data.pending, ...data.graded]) {
      const entry = byQuestion.get(item.questionId) ?? {
        id: item.questionId,
        name: item.questionName,
        pending: 0,
        total: 0,
      };
      entry.total += 1;
      if (data.pending.includes(item)) entry.pending += 1;
      byQuestion.set(item.questionId, entry);
    }
    return [...byQuestion.values()].sort((a, b) => b.pending - a.pending);
  });

  /** Respuestas de la pregunta elegida, o todas si no se ha elegido ninguna. */
  readonly visible = computed(() => {
    const focused = this.focusedQuestion();
    const items = this.items();
    return focused ? items.filter((item) => item.questionId === focused) : items;
  });

  /** Pauta de la pregunta elegida: se enseña una vez, no en cada respuesta. */
  readonly rubric = computed(() => {
    const focused = this.focusedQuestion();
    if (!focused) return null;
    return this.items().find((item) => item.questionId === focused)?.rubric ?? null;
  });

  readonly pendingCount = computed(() => this.queue()?.pending.length ?? 0);

  readonly dirtyCount = computed(
    () => Object.values(this.drafts()).filter((draft) => draft.mark !== null).length,
  );

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.activities.quizGradingQueue(this.moduleId).subscribe({
      next: (queue) => {
        this.queue.set(queue);
        this.drafts.set({});
        // Con una sola pregunta pendiente no hay nada que elegir: se entra
        // directamente a corregirla.
        const unicas = new Set(queue.pending.map((item) => item.questionId));
        this.focusedQuestion.set(unicas.size === 1 ? [...unicas][0] : null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  key(item: QuizGradingItem): string {
    return `${item.attemptId}:${item.questionId}`;
  }

  draft(item: QuizGradingItem): Correccion {
    return (
      this.drafts()[this.key(item)] ?? {
        mark: item.mark,
        feedback: item.feedback ?? '',
      }
    );
  }

  setMark(item: QuizGradingItem, value: string): void {
    const parsed = value === '' ? null : Number(value);
    const mark =
      parsed === null || !Number.isFinite(parsed)
        ? null
        : Math.min(item.maxMark, Math.max(0, parsed));
    this.drafts.update((map) => ({
      ...map,
      [this.key(item)]: { ...this.draft(item), mark },
    }));
  }

  setFeedback(item: QuizGradingItem, feedback: string): void {
    this.drafts.update((map) => ({
      ...map,
      [this.key(item)]: { ...this.draft(item), feedback },
    }));
  }

  /** Puntuación completa de un toque: lo más habitual en una respuesta buena. */
  full(item: QuizGradingItem): void {
    this.setMark(item, String(item.maxMark));
  }

  zero(item: QuizGradingItem): void {
    this.setMark(item, '0');
  }

  /** El texto de la respuesta, sea cual sea la forma en que llegó. */
  answerText(item: QuizGradingItem): string {
    if (item.answer === null || item.answer === undefined) return '';
    if (typeof item.answer === 'string') return item.answer;
    return JSON.stringify(item.answer, null, 2);
  }

  save(): void {
    const grades = Object.entries(this.drafts())
      .filter(([, draft]) => draft.mark !== null)
      .map(([key, draft]) => {
        const [attemptId, questionId] = key.split(':');
        return {
          attemptId,
          questionId,
          mark: draft.mark as number,
          feedback: draft.feedback || undefined,
        };
      });
    if (!grades.length || this.saving()) return;

    this.saving.set(true);
    this.activities.saveQuizGrades(this.moduleId, grades).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(
          `${result.graded} respuestas corregidas`,
          'Los exámenes cuyas preguntas ya están todas evaluadas han pasado al libro de notas.',
        );
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
