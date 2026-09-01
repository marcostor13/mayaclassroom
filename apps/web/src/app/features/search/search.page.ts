import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap, tap } from 'rxjs';
import type { SearchResult, SearchResultKind, SearchResults } from '@maya/shared';
import { SearchService } from '../../core/services/search.service';
import { EmptyStateComponent, GlobalSearchComponent, IconComponent } from '../../shared';

const VACIO: SearchResults = { term: '', total: 0, groups: [] };

/** Resultados completos de la búsqueda global, filtrables por tipo. */
@Component({
  selector: 'maya-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, GlobalSearchComponent],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Resultados</h1>
        <p class="maya-page-header__subtitle">
          @if (term()) {
            {{ results().total }}
            {{ results().total === 1 ? 'coincidencia' : 'coincidencias' }} para «{{ term() }}»
          } @else {
            Escriba en la caja de búsqueda para encontrar cursos, actividades o personas.
          }
        </p>
      </div>
    </header>

    <maya-global-search class="maya-hide-desktop" style="margin-bottom: var(--maya-space-4)" />

    @if (results().groups.length > 1) {
      <div class="maya-tabs" role="tablist" style="margin-bottom: var(--maya-space-4)">
        <button
          type="button"
          class="maya-tabs__tab"
          role="tab"
          [class.is-active]="filter() === null"
          [attr.aria-selected]="filter() === null"
          (click)="filter.set(null)"
        >
          Todo ({{ results().total }})
        </button>
        @for (group of results().groups; track group.kind) {
          <button
            type="button"
            class="maya-tabs__tab"
            role="tab"
            [class.is-active]="filter() === group.kind"
            [attr.aria-selected]="filter() === group.kind"
            (click)="filter.set(group.kind)"
          >
            {{ group.label }} ({{ group.items.length }})
          </button>
        }
      </div>
    }

    @if (loading()) {
      <div class="maya-skeleton" style="height: 280px"></div>
    } @else if (visible().length) {
      <div class="maya-stack" style="gap: var(--maya-space-3)">
        @for (item of visible(); track item.kind + item.id) {
          <button type="button" class="maya-card maya-card--interactive" (click)="go(item)">
            <div class="maya-card__body maya-row" style="gap: var(--maya-space-4); align-items: flex-start">
              <span class="maya-icon-tile">
                <maya-icon [name]="item.icon" [size]="18" />
              </span>
              <span class="maya-stack" style="gap: 2px; text-align: left; min-width: 0">
                <strong>{{ item.title }}</strong>
                @if (item.subtitle) {
                  <span class="maya-small maya-muted">{{ item.subtitle }}</span>
                }
                @if (item.excerpt) {
                  <span class="maya-tiny maya-subtle maya-clamp-2">{{ item.excerpt }}</span>
                }
              </span>
            </div>
          </button>
        }
      </div>
    } @else {
      <maya-empty-state
        icon="search"
        title="Sin resultados"
        [description]="
          term()
            ? 'Pruebe con otras palabras o revise la ortografía.'
            : 'Use la caja de búsqueda de la barra superior.'
        "
      />
    }
  `,
})
export class SearchPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly search = inject(SearchService);

  readonly filter = signal<SearchResultKind | null>(null);
  readonly loading = signal(false);

  readonly term = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q')?.trim() ?? '')),
    { initialValue: '' },
  );

  readonly results = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => params.get('q')?.trim() ?? ''),
      tap((term) => this.loading.set(term.length >= 2)),
      // Se piden 20 por grupo: esta es la vista completa, no el desplegable.
      switchMap((term) => this.search.search(term, 20)),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: VACIO },
  );

  readonly visible = computed<SearchResult[]>(() => {
    const kind = this.filter();
    return this.results()
      .groups.filter((group) => kind === null || group.kind === kind)
      .flatMap((group) => group.items);
  });

  go(item: SearchResult): void {
    const [path, query] = item.route.split('?');
    const params = Object.fromEntries(new URLSearchParams(query ?? ''));
    void this.router.navigate([path], { queryParams: params });
  }
}
