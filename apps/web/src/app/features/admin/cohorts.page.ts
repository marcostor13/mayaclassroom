import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CohortDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent } from '../../shared';

@Component({
  selector: 'maya-admin-cohorts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, EmptyStateComponent],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Cohortes</h1>
        <p class="maya-page-header__subtitle">
          Agrupe usuarios para matricularlos de una sola vez
        </p>
      </div>
      <div class="maya-page-header__actions">
        <button type="button" class="maya-btn maya-btn--primary" (click)="creating.set(!creating())">
          <maya-icon name="plus" [size]="16" /> Nueva cohorte
        </button>
      </div>
    </header>

    @if (creating()) {
      <section class="maya-card" style="margin-bottom: var(--maya-space-5)">
        <div class="maya-card__body maya-stack">
          <div class="maya-field">
            <label class="maya-label" for="co-name">Nombre</label>
            <input id="co-name" class="maya-input" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </div>
          <div class="maya-field">
            <label class="maya-label" for="co-desc">Descripción</label>
            <textarea
              id="co-desc"
              class="maya-textarea"
              rows="3"
              [ngModel]="description()"
              (ngModelChange)="description.set($event)"
            ></textarea>
          </div>
        </div>
        <div class="maya-card__footer" style="display: flex; gap: var(--maya-space-2); justify-content: flex-end">
          <button type="button" class="maya-btn maya-btn--ghost" (click)="creating.set(false)">
            Cancelar
          </button>
          <button type="button" class="maya-btn maya-btn--primary" (click)="create()">Crear</button>
        </div>
      </section>
    }

    @if (cohorts().length) {
      <div class="maya-cards">
        @for (cohort of cohorts(); track cohort.id) {
          <article class="maya-card">
            <div class="maya-card__body maya-stack">
              <div class="maya-spread">
                <h2 style="font-size: var(--maya-text-md); font-weight: 700">{{ cohort.name }}</h2>
                <span class="maya-badge maya-badge--primary">{{ cohort.memberCount }}</span>
              </div>
              @if (cohort.description) {
                <p class="maya-small maya-muted">{{ cohort.description }}</p>
              }
            </div>
          </article>
        }
      </div>
    } @else {
      <maya-empty-state
        icon="users-round"
        title="Sin cohortes"
        description="Las cohortes permiten matricular grupos completos en un curso."
      />
    }
  `,
})
export class AdminCohortsPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly cohorts = signal<CohortDto[]>([]);
  readonly creating = signal(false);
  readonly name = signal('');
  readonly description = signal('');

  constructor() {
    this.load();
  }

  private load(): void {
    this.admin.cohorts({ limit: 50 }).subscribe({
      next: (result) => this.cohorts.set(result.items),
    });
  }

  create(): void {
    if (!this.name().trim()) return;
    this.admin.createCohort({ name: this.name(), description: this.description() }).subscribe({
      next: () => {
        this.toast.success('Cohorte creada');
        this.name.set('');
        this.description.set('');
        this.creating.set(false);
        this.load();
      },
    });
  }
}
