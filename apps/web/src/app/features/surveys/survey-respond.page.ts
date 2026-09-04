import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SurveyDto, SurveyQuestionDto, SurveyQuestionType } from '@maya/shared';
import { SurveysService } from '../../core/services/surveys.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

/**
 * Encuesta desde el lado del alumno.
 *
 * Insiste en el anonimato arriba y no al final: quien va a opinar del
 * profesorado decide si es franco antes de escribir, no después. Todo cabe en
 * una página, sin pasos, porque son media docena de preguntas y partirlas en
 * pantallas solo alarga algo que se hace en un minuto.
 */
@Component({
  selector: 'maya-survey-respond',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, IconComponent],
  templateUrl: './survey-respond.page.html',
  styleUrl: './survey-respond.page.scss',
})
export class SurveyRespondPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly surveys = inject(SurveysService);
  private readonly toast = inject(ToastService);

  readonly SurveyQuestionType = SurveyQuestionType;

  readonly surveyId = this.route.snapshot.paramMap.get('id')!;
  readonly survey = signal<(SurveyDto & { answered: boolean }) | null>(null);
  readonly loading = signal(true);
  readonly sending = signal(false);
  readonly sent = signal(false);

  readonly answers = signal<Record<string, unknown>>({});

  /** Preguntas obligatorias todavía sin responder. */
  readonly missing = computed(() => {
    const survey = this.survey();
    if (!survey) return [];
    return survey.questions.filter((question) => {
      if (!question.required) return false;
      const value = this.answers()[question.id];
      return value === undefined || value === null || value === '' ||
        (Array.isArray(value) && !value.length);
    });
  });

  readonly canSubmit = computed(() => !this.missing().length && !this.sending());

  constructor() {
    this.surveys.respond(this.surveyId).subscribe({
      next: (survey) => {
        this.survey.set(survey);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  set(questionId: string, value: unknown): void {
    this.answers.update((map) => ({ ...map, [questionId]: value }));
  }

  value(questionId: string): unknown {
    return this.answers()[questionId];
  }

  /** Casilla de opción múltiple: alterna un valor dentro de la lista. */
  toggle(questionId: string, option: string): void {
    const actual = (this.answers()[questionId] as string[] | undefined) ?? [];
    this.set(
      questionId,
      actual.includes(option) ? actual.filter((item) => item !== option) : [...actual, option],
    );
  }

  isChecked(questionId: string, option: string): boolean {
    return ((this.answers()[questionId] as string[] | undefined) ?? []).includes(option);
  }

  /** Los puntos de una escala, para pintarlos como botones. */
  scalePoints(question: SurveyQuestionDto): number[] {
    return Array.from({ length: question.scaleMax ?? 5 }, (_, index) => index + 1);
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.sending.set(true);
    this.surveys.submit(this.surveyId, this.answers()).subscribe({
      next: () => {
        this.sending.set(false);
        this.sent.set(true);
        this.toast.success('Gracias por su respuesta', 'Se ha guardado de forma anónima.');
      },
      error: () => this.sending.set(false),
    });
  }

  volverAlCurso(): void {
    const courseId = this.survey()?.courseId;
    void this.router.navigate(courseId ? ['/courses', courseId] : ['/courses']);
  }
}
