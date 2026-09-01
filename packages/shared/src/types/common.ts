export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorBody {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
  details?: unknown;
}

export interface IdName {
  id: string;
  name: string;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Naturaleza de un resultado de la búsqueda global. */
export type SearchResultKind = 'course' | 'activity' | 'user' | 'category';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  /** Segunda línea: categoría del curso, nombre del curso, correo… */
  subtitle?: string;
  /** Fragmento de texto donde ha casado el término. */
  excerpt?: string;
  /** Ruta del cliente a la que lleva el resultado. */
  route: string;
  icon: string;
}

export interface SearchResults {
  term: string;
  total: number;
  groups: { kind: SearchResultKind; label: string; items: SearchResult[] }[];
}
