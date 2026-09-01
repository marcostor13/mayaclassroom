import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import type { SearchResult, SearchResults } from '@maya/shared';
import { SearchService } from '../../core/services/search.service';
import { IconComponent } from './icon.component';

const VACIO: SearchResults = { term: '', total: 0, groups: [] };

/**
 * Búsqueda global del topbar: escribe, espera 250 ms, muestra los resultados
 * agrupados y permite recorrerlos con el teclado. Enter sin selección abre la
 * página de resultados completa.
 */
@Component({
  selector: 'maya-global-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="gsearch" [class.gsearch--open]="open()">
      <maya-icon name="search" [size]="18" class="gsearch__icon" />
      <input
        #field
        type="search"
        class="gsearch__input"
        role="combobox"
        autocomplete="off"
        [attr.aria-expanded]="open()"
        aria-controls="maya-search-results"
        aria-label="Buscar en la plataforma"
        [placeholder]="placeholder"
        [value]="term()"
        (input)="type($any($event.target).value)"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
        (keydown.escape)="close()"
        (keydown.arrowdown)="move($event, 1)"
        (keydown.arrowup)="move($event, -1)"
        (keydown.enter)="submit()"
      />
      @if (term()) {
        <button
          type="button"
          class="gsearch__clear"
          aria-label="Limpiar la búsqueda"
          (click)="clear()"
        >
          <maya-icon name="x" [size]="16" />
        </button>
      }

      @if (open()) {
        <div class="gsearch__panel" id="maya-search-results" role="listbox">
          @if (loading()) {
            <p class="gsearch__hint">Buscando…</p>
          } @else if (!results().total) {
            <p class="gsearch__hint">Sin resultados para «{{ term() }}».</p>
          } @else {
            @for (group of results().groups; track group.kind) {
              <p class="gsearch__group">{{ group.label }}</p>
              @for (item of group.items; track item.id) {
                <button
                  type="button"
                  class="gsearch__item"
                  role="option"
                  [class.is-active]="flat()[cursor()] === item"
                  [attr.aria-selected]="flat()[cursor()] === item"
                  (mousedown)="$event.preventDefault()"
                  (click)="go(item)"
                >
                  <maya-icon [name]="item.icon" [size]="16" />
                  <span class="gsearch__item-text">
                    <span class="gsearch__item-title">{{ item.title }}</span>
                    @if (item.subtitle) {
                      <span class="gsearch__item-sub">{{ item.subtitle }}</span>
                    }
                  </span>
                </button>
              }
            }
            <button type="button" class="gsearch__all" (mousedown)="$event.preventDefault()" (click)="submit()">
              Ver todos los resultados
              <maya-icon name="arrow-right" [size]="14" />
            </button>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './global-search.component.scss',
})
export class GlobalSearchComponent {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  readonly placeholder = 'Buscar cursos, actividades o personas…';

  readonly term = signal('');
  readonly focused = signal(false);
  readonly loading = signal(false);
  readonly cursor = signal(-1);

  private readonly terms = new Subject<string>();

  readonly results = toSignal(
    this.terms.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term) => {
        this.loading.set(term.trim().length >= 2);
        return this.search.search(term);
      }),
    ),
    { initialValue: VACIO },
  );

  /** Resultados aplanados en el orden en que se pintan, para el teclado. */
  readonly flat = computed<SearchResult[]>(() =>
    this.results().groups.flatMap((group) => group.items),
  );

  readonly open = computed(
    () => this.focused() && this.term().trim().length >= 2 && !this.justNavigated(),
  );

  private readonly justNavigated = signal(false);

  type(value: string): void {
    this.term.set(value);
    this.cursor.set(-1);
    this.justNavigated.set(false);
    this.loading.set(value.trim().length >= 2);
    this.terms.next(value);
  }

  /** Recorre los resultados en bucle; -1 significa «ninguno seleccionado». */
  move(event: Event, delta: number): void {
    if (!this.open()) return;
    event.preventDefault();
    const total = this.flat().length;
    if (!total) return;
    // Se desplaza sobre `cursor + 1` para que el -1 («ninguno») sea una
    // posición más del bucle y volver a él al pasar del último resultado.
    this.cursor.set(((this.cursor() + delta + total + 2) % (total + 1)) - 1);
  }

  submit(): void {
    const chosen = this.flat()[this.cursor()];
    if (chosen) {
      this.go(chosen);
      return;
    }
    const term = this.term().trim();
    if (term.length < 2) return;
    this.close();
    void this.router.navigate(['/search'], { queryParams: { q: term } });
  }

  go(item: SearchResult): void {
    this.close();
    const [path, query] = item.route.split('?');
    const params = Object.fromEntries(new URLSearchParams(query ?? ''));
    void this.router.navigate([path], { queryParams: params });
  }

  clear(): void {
    this.term.set('');
    this.cursor.set(-1);
    this.terms.next('');
    this.field()?.nativeElement.focus();
  }

  close(): void {
    this.justNavigated.set(true);
    this.focused.set(false);
    this.field()?.nativeElement.blur();
  }
}
