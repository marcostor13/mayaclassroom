import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IssuedBadgeDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { EmptyStateComponent, FormatDatePipe, IconComponent } from '../../shared';

@Component({
  selector: 'maya-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, FormatDatePipe],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Mis insignias</h1>
        <p class="maya-page-header__subtitle">
          Reconocimientos obtenidos a lo largo de su formación
        </p>
      </div>
    </header>

    @if (loading()) {
      <div class="maya-cards">
        @for (item of [1, 2, 3]; track item) {
          <div class="maya-skeleton" style="height: 220px"></div>
        }
      </div>
    } @else if (badges().length) {
      <div class="maya-cards">
        @for (item of badges(); track item.id) {
          <article class="maya-card maya-card--interactive" style="text-align: center">
            <div class="maya-card__body maya-stack" style="align-items: center">
              <span class="badge-medal">
                @if (item.badge?.imageUrl) {
                  <img [src]="item.badge!.imageUrl!" [alt]="item.badge!.name" />
                } @else {
                  <maya-icon name="award" [size]="38" />
                }
              </span>
              <h2 style="font-size: var(--maya-text-md); font-weight: 700">
                {{ item.badge?.name }}
              </h2>
              <p class="maya-small maya-muted">{{ item.badge?.description }}</p>
              <p class="maya-tiny maya-subtle">
                Obtenida el {{ item.issuedAt | mayaDate: 'long' }}
              </p>
            </div>
            <div class="maya-card__footer">
              <a
                [href]="'/api/v1/badges/verify/' + item.uniqueHash"
                target="_blank"
                rel="noopener"
                class="maya-btn maya-btn--secondary maya-btn--sm maya-btn--block"
              >
                <maya-icon name="shield" [size]="15" /> Verificar
              </a>
            </div>
          </article>
        }
      </div>
    } @else {
      <maya-empty-state
        icon="award"
        title="Todavía no tiene insignias"
        description="Complete cursos y actividades para conseguir sus primeros reconocimientos."
      />
    }
  `,
  styles: [
    `
      .badge-medal {
        width: 92px;
        height: 92px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--maya-accent), var(--maya-primary));
        color: #fff;
        box-shadow: var(--maya-shadow-primary);
        overflow: hidden;
      }
      .badge-medal img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    `,
  ],
})
export class BadgesPage {
  private readonly admin = inject(AdminService);

  readonly badges = signal<IssuedBadgeDto[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.admin.myBadges().subscribe({
      next: (list) => {
        this.badges.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
