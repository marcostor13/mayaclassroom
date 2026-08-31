import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CompetencyProficiency, LearningPlanDto, UserCompetencyDto } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import {
  EmptyStateComponent,
  FormatDatePipe,
  ProgressBarComponent,
} from '../../shared';

@Component({
  selector: 'maya-competencies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, ProgressBarComponent, FormatDatePipe],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Mis competencias</h1>
        <p class="maya-page-header__subtitle">
          Seguimiento de su desarrollo profesional y planes de aprendizaje
        </p>
      </div>
    </header>

    <div class="maya-grid" style="grid-template-columns: 1fr; gap: var(--maya-space-6)">
      <section>
        <h2 style="font-size: var(--maya-text-lg); margin-bottom: var(--maya-space-4)">
          Planes de aprendizaje
        </h2>
        @if (plans().length) {
          <div class="maya-cards">
            @for (plan of plans(); track plan.id) {
              <article class="maya-card">
                <div class="maya-card__body maya-stack">
                  <div class="maya-spread">
                    <h3 style="font-size: var(--maya-text-md); font-weight: 700">{{ plan.name }}</h3>
                    <span class="maya-badge maya-badge--primary">{{ plan.status }}</span>
                  </div>
                  @if (plan.description) {
                    <p class="maya-small maya-muted">{{ plan.description }}</p>
                  }
                  <div class="maya-stack" style="gap: 6px">
                    <div class="maya-spread maya-tiny maya-muted">
                      <span>Progreso</span>
                      <strong>{{ plan.progress }} %</strong>
                    </div>
                    <maya-progress [value]="plan.progress" size="thin" />
                  </div>
                  @if (plan.dueDate) {
                    <p class="maya-tiny maya-subtle">
                      Fecha objetivo: {{ plan.dueDate | mayaDate: 'long' }}
                    </p>
                  }
                </div>
              </article>
            }
          </div>
        } @else {
          <maya-empty-state
            icon="target"
            title="Sin planes asignados"
            description="Su responsable de formación puede asignarle un plan de aprendizaje."
          />
        }
      </section>

      <section>
        <h2 style="font-size: var(--maya-text-lg); margin-bottom: var(--maya-space-4)">
          Competencias evaluadas
        </h2>
        @if (competencies().length) {
          <div class="maya-table-wrap">
            <table class="maya-table">
              <thead>
                <tr>
                  <th scope="col">Competencia</th>
                  <th scope="col">Nivel</th>
                  <th scope="col">Evidencias</th>
                  <th scope="col">Actualizada</th>
                </tr>
              </thead>
              <tbody>
                @for (item of competencies(); track item.id) {
                  <tr>
                    <td class="maya-bold">{{ item.competency?.shortName ?? '—' }}</td>
                    <td>
                      <span class="maya-badge" [class]="badgeClass(item)">
                        {{ label(item.proficiency) }}
                      </span>
                    </td>
                    <td class="maya-small">{{ item.evidenceCount }}</td>
                    <td class="maya-small">{{ item.updatedAt | mayaDate: 'short' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <maya-empty-state
            icon="sparkles"
            title="Sin competencias evaluadas"
            description="Sus competencias aparecerán aquí cuando el profesorado las evalúe."
          />
        }
      </section>
    </div>
  `,
})
export class CompetenciesPage {
  private readonly api = inject(ApiService);

  readonly plans = signal<LearningPlanDto[]>([]);
  readonly competencies = signal<UserCompetencyDto[]>([]);

  constructor() {
    this.api.get<LearningPlanDto[]>('/competencies/plans/me').subscribe({
      next: (plans) => this.plans.set(plans),
    });
    this.api.get<UserCompetencyDto[]>('/competencies/me').subscribe({
      next: (list) => this.competencies.set(list),
    });
  }

  label(proficiency: CompetencyProficiency): string {
    switch (proficiency) {
      case CompetencyProficiency.Proficient:
        return 'Competente';
      case CompetencyProficiency.InProgress:
        return 'En progreso';
      default:
        return 'Sin evaluar';
    }
  }

  badgeClass(item: UserCompetencyDto): string {
    if (item.proficiency === CompetencyProficiency.Proficient) return 'maya-badge--success';
    if (item.proficiency === CompetencyProficiency.InProgress) return 'maya-badge--warning';
    return '';
  }
}
