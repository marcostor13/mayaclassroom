import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  SurveyDto,
  SurveyQuestionType,
  SurveyResultsDto,
  SurveyStatus,
  SurveyTrigger,
  slugify,
} from '@maya/shared';
import { SurveysService, SurveyQuestionPayload } from '../../core/services/surveys.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent, ModalComponent } from '../../shared';

/** Pregunta mientras se compone la encuesta. */
interface PreguntaBorrador extends SurveyQuestionPayload {
  optionsText: string;
}

const TIPOS: { type: SurveyQuestionType; label: string; hint: string }[] = [
  { type: SurveyQuestionType.Scale, label: 'Escala', hint: 'Del 1 al 5 o al 10' },
  { type: SurveyQuestionType.Single, label: 'Opción única', hint: 'Elegir una alternativa' },
  { type: SurveyQuestionType.Multiple, label: 'Opción múltiple', hint: 'Elegir varias' },
  { type: SurveyQuestionType.Boolean, label: 'Sí o no', hint: 'Respuesta binaria' },
  { type: SurveyQuestionType.Text, label: 'Texto corto', hint: 'Una línea' },
  { type: SurveyQuestionType.Paragraph, label: 'Texto largo', hint: 'Comentario abierto' },
];

/**
 * Encuestas de un curso, como las gestiona el profesorado.
 *
 * Componer, publicar y leer los resultados viven en la misma pantalla porque
 * son el mismo ciclo y se recorren en cuestión de días: separarlos obligaba a
 * ir y volver para comprobar si ya ha contestado alguien.
 */
@Component({
  selector: 'maya-surveys',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, IconComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './surveys.page.html',
  styleUrl: './surveys.page.scss',
})
export class SurveysPage {
  private readonly route = inject(ActivatedRoute);
  private readonly surveys = inject(SurveysService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly SurveyStatus = SurveyStatus;
  readonly SurveyQuestionType = SurveyQuestionType;
  readonly SurveyTrigger = SurveyTrigger;
  readonly tipos = TIPOS;

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly items = signal<SurveyDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);

  /* ------------------------------- Editor -------------------------------- */

  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly title = signal('');
  readonly description = signal('');
  readonly trigger = signal<SurveyTrigger>(SurveyTrigger.OnCompletion);
  readonly closesAt = signal('');
  readonly questions = signal<PreguntaBorrador[]>([]);

  readonly editorValid = computed(
    () => this.title().trim().length > 0 && this.questions().some((q) => q.text.trim()),
  );

  /* ------------------------------ Resultados ----------------------------- */

  readonly results = signal<SurveyResultsDto | null>(null);
  readonly resultsLoading = signal(false);
  readonly downloading = signal<'xlsx' | 'csv' | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.surveys.forCourse(this.courseId).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /* ------------------------------- Editor -------------------------------- */

  openNew(): void {
    this.editingId.set(null);
    this.title.set('Encuesta de satisfacción del curso');
    this.description.set(
      'Sus respuestas son anónimas y nos ayudan a mejorar el curso. Gracias por dedicarle un minuto.',
    );
    this.trigger.set(SurveyTrigger.OnCompletion);
    this.closesAt.set('');
    // Una encuesta en blanco desanima; estas tres preguntas son las que casi
    // siempre se acaban escribiendo, y se pueden borrar de un toque.
    this.questions.set([
      this.nueva(SurveyQuestionType.Scale, '¿Cómo valora el curso en conjunto?'),
      this.nueva(SurveyQuestionType.Scale, '¿Cómo valora al profesorado?'),
      this.nueva(SurveyQuestionType.Paragraph, '¿Qué mejoraría del curso?'),
    ]);
    this.editorOpen.set(true);
  }

  openEdit(survey: SurveyDto): void {
    this.editingId.set(survey.id);
    this.title.set(survey.title);
    this.description.set(survey.description ?? '');
    this.trigger.set(survey.trigger);
    this.closesAt.set(survey.closesAt ? survey.closesAt.slice(0, 16) : '');
    this.questions.set(
      survey.questions.map((question) => ({
        type: question.type,
        text: question.text,
        help: question.help ?? undefined,
        required: question.required,
        options: question.options,
        optionsText: question.options.join('\n'),
        scaleMax: question.scaleMax ?? 5,
        scaleMinLabel: question.scaleMinLabel ?? undefined,
        scaleMaxLabel: question.scaleMaxLabel ?? undefined,
      })),
    );
    this.editorOpen.set(true);
  }

  private nueva(type: SurveyQuestionType, text = ''): PreguntaBorrador {
    return {
      type,
      text,
      required: false,
      options: type === SurveyQuestionType.Single || type === SurveyQuestionType.Multiple
        ? ['', '']
        : [],
      optionsText:
        type === SurveyQuestionType.Single || type === SurveyQuestionType.Multiple ? '' : '',
      scaleMax: type === SurveyQuestionType.Scale ? 5 : undefined,
    };
  }

  addQuestion(type: SurveyQuestionType): void {
    this.questions.update((list) => [...list, this.nueva(type)]);
  }

  removeQuestion(index: number): void {
    this.questions.update((list) => list.filter((_, i) => i !== index));
  }

  moveQuestion(index: number, delta: number): void {
    const target = index + delta;
    this.questions.update((list) => {
      if (target < 0 || target >= list.length) return list;
      const copia = [...list];
      [copia[index], copia[target]] = [copia[target], copia[index]];
      return copia;
    });
  }

  setQuestion(index: number, patch: Partial<PreguntaBorrador>): void {
    this.questions.update((list) =>
      list.map((question, i) => (i === index ? { ...question, ...patch } : question)),
    );
  }

  needsOptions(type: SurveyQuestionType): boolean {
    return type === SurveyQuestionType.Single || type === SurveyQuestionType.Multiple;
  }

  save(): void {
    if (!this.editorValid() || this.saving()) return;
    this.saving.set(true);

    const payload = {
      title: this.title().trim(),
      description: this.description() || undefined,
      trigger: this.trigger(),
      anonymous: true,
      closesAt: this.closesAt() ? new Date(this.closesAt()).toISOString() : undefined,
      questions: this.questions()
        .filter((question) => question.text.trim())
        .map((question) => ({
          type: question.type,
          text: question.text.trim(),
          help: question.help || undefined,
          required: question.required ?? false,
          // Las opciones se escriben una por línea, que es más rápido que ir
          // añadiendo campos de uno en uno.
          options: this.needsOptions(question.type)
            ? question.optionsText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
            : undefined,
          scaleMax: question.type === SurveyQuestionType.Scale ? question.scaleMax : undefined,
        })),
    };

    const id = this.editingId();
    const request = id
      ? this.surveys.update(id, payload)
      : this.surveys.create(this.courseId, payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.toast.success(id ? 'Encuesta actualizada' : 'Encuesta creada');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  /* ------------------------------- Acciones ------------------------------ */

  publish(survey: SurveyDto): void {
    this.surveys.publish(survey.id).subscribe({
      next: () => {
        this.toast.success(
          'Encuesta publicada',
          survey.trigger === SurveyTrigger.OnCompletion
            ? 'Aparecerá a cada alumno al terminar el curso.'
            : 'Ya está disponible para el alumnado.',
        );
        this.load();
      },
    });
  }

  close(survey: SurveyDto): void {
    this.surveys.close(survey.id).subscribe({
      next: () => {
        this.toast.success('Encuesta cerrada');
        this.load();
      },
    });
  }

  remove(survey: SurveyDto): void {
    this.confirm
      .ask({
        title: 'Eliminar la encuesta',
        message: survey.responseCount
          ? `«${survey.title}» tiene ${survey.responseCount} respuestas y se perderán todas.`
          : `«${survey.title}» se eliminará.`,
        confirmLabel: 'Eliminar',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.surveys.remove(survey.id).subscribe({
          next: () => {
            this.toast.success('Encuesta eliminada');
            this.load();
          },
        });
      });
  }

  /* ------------------------------ Resultados ----------------------------- */

  openResults(survey: SurveyDto): void {
    this.results.set(null);
    this.resultsLoading.set(true);
    this.surveys.results(survey.id).subscribe({
      next: (results) => {
        this.results.set(results);
        this.resultsLoading.set(false);
      },
      error: () => this.resultsLoading.set(false),
    });
  }

  closeResults(): void {
    this.results.set(null);
  }

  download(formato: 'xlsx' | 'csv'): void {
    const results = this.results();
    if (!results || this.downloading()) return;
    this.downloading.set(formato);

    const peticion =
      formato === 'xlsx'
        ? this.surveys.excel(results.survey.id)
        : this.surveys.csv(results.survey.id);

    peticion.subscribe({
      next: (blob) => {
        this.downloading.set(null);
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `encuesta-${slugify(results.survey.title)}.${formato}`;
        enlace.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.downloading.set(null),
    });
  }

  statusLabel(status: SurveyStatus): string {
    switch (status) {
      case SurveyStatus.Published:
        return 'Publicada';
      case SurveyStatus.Closed:
        return 'Cerrada';
      default:
        return 'Borrador';
    }
  }

  typeLabel(type: SurveyQuestionType): string {
    return TIPOS.find((item) => item.type === type)?.label ?? 'Pregunta';
  }
}
