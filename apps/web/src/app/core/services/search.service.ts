import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import type { SearchResults } from '@maya/shared';
import { ApiService } from './api.service';

/** Búsqueda global del topbar y de la página de resultados. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = inject(ApiService);

  /** Búsqueda global. Con menos de dos caracteres no se llama a la API. */
  search(term: string, limit = 5): Observable<SearchResults> {
    const clean = term.trim();
    if (clean.length < 2) return of({ term: clean, total: 0, groups: [] });
    return this.api.get<SearchResults>('/search', { q: clean, limit });
  }
}
