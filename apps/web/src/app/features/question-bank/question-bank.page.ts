import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Paginated, QuestionDto, QuestionType } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { EmptyStateComponent, IconComponent, SafeHtmlPipe } from '../../shared';

@Component({
  selector: 'maya-question-bank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, EmptyStateComponent, SafeHtmlPipe],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Banco de preguntas</h1>
        <p class="maya-page-header__subtitle">
          Preguntas reutilizables en todos sus cuestionarios
        </p>
      </div>
    </header>

    <div class="maya-row" style="flex-wrap: wrap; margin-bottom: var(--maya-space-4)">
      <input
        type="search"
        class="maya-input"
        style="max-width: 320px"
        placeholder="Buscar preguntas…"
        [ngModel]="search()"
        (ngModelChange)="search.set($event)"
        (keyup.enter)="load()"
        aria-label="Buscar preguntas"
      />
      <select
        class="maya-select"
        style="max-width: 220px"
        [ngModel]="type()"
        (ngModelChange)="type.set($event); load()"
        aria-label="Filtrar por tipo"
      >
        <option value="">Todos los tipos</option>
        @for (option of types; track option.value) {
          <option [value]="option.value">{{ option.label }}</option>
        }
      </select>
      <button type="button" class="maya-btn maya-btn--primary" (click)="load()">
        <maya-icon name="search" [size]="16" /> Buscar
      </button>
    </div>

    @if (loading()) {
      <div class="maya-skeleton" style="height: 320px"></div>
    } @else if (questions().length) {
      <div class="maya-stack" style="gap: var(--maya-space-3)">
        @for (question of questions(); track question.id) {
          <article class="maya-card">
            <div class="maya-card__body">
              <div class="maya-spread" style="margin-bottom: var(--maya-space-2)">
                <strong class="maya-small">{{ question.name }}</strong>
                <span class="maya-badge maya-badge--primary">{{ typeLabel(question.type) }}</span>
              </div>
              <div
                class="maya-rich maya-small maya-clamp-2"
                [innerHTML]="question.questionText | safeHtml"
              ></div>
              <p class="maya-tiny maya-subtle" style="margin-top: var(--maya-space-2)">
                {{ question.answers.length }} respuestas · {{ question.defaultMark }} puntos
              </p>
            </div>
          </article>
        }
      </div>
    } @else {
      <maya-empty-state
        icon="help-circle"
        title="Banco vacío"
        description="Cree preguntas desde el editor de cuestionarios o impórtelas en formato GIFT."
      />
    }
  `,
})
export class QuestionBankPage {
  private readonly api = inject(ApiService);

  readonly questions = signal<QuestionDto[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly type = signal('');

  readonly types = [
    { value: QuestionType.MultiChoice, label: 'Opción múltiple' },
    { value: QuestionType.TrueFalse, label: 'Verdadero / Falso' },
    { value: QuestionType.ShortAnswer, label: 'Respuesta corta' },
    { value: QuestionType.Numerical, label: 'Numérica' },
    { value: QuestionType.Matching, label: 'Emparejamiento' },
    { value: QuestionType.Essay, label: 'Ensayo' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .get<Paginated<QuestionDto>>('/questions', {
        limit: 50,
        search: this.search() || undefined,
        type: this.type() || undefined,
      })
      .subscribe({
        next: (result) => {
          this.questions.set(result.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  typeLabel(type: QuestionType): string {
    return this.types.find((item) => item.value === type)?.label ?? type;
  }
}
