import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../models';

export type QueryValue = string | number | boolean | undefined | null;

/**
 * Cliente HTTP tipado. Desempaqueta el sobre uniforme (`{ success, data }`) que
 * devuelve la API para que los componentes trabajen con el dato directamente.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  private toParams(query?: Record<string, QueryValue | QueryValue[]>): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) params = params.append(key, String(item));
        }
      } else {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  get<T>(path: string, query?: Record<string, QueryValue | QueryValue[]>): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(`${this.baseUrl}${path}`, { params: this.toParams(query) })
      .pipe(map((response) => response.data));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body ?? {})
      .pipe(map((response) => response.data));
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body ?? {})
      .pipe(map((response) => response.data));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<ApiEnvelope<T>>(`${this.baseUrl}${path}`, body ?? {})
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(`${this.baseUrl}${path}`, { params: this.toParams(query) })
      .pipe(map((response) => response.data));
  }

  /** Subida de ficheros mediante `multipart/form-data`. */
  upload<T>(path: string, formData: FormData, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(`${this.baseUrl}${path}`, formData, { params: this.toParams(query) })
      .pipe(map((response) => response.data));
  }

  /** Descarga binaria (exportaciones, copias de seguridad, certificados). */
  download(path: string, query?: Record<string, QueryValue>): Observable<Blob> {
    return this.http.get(`${this.baseUrl}${path}`, {
      params: this.toParams(query),
      responseType: 'blob',
    });
  }
}
