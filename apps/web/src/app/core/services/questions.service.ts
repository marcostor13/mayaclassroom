import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { Paginated, QuestionCategoryDto, QuestionDto, QuestionType } from '@maya/shared';
import { ApiService } from './api.service';

export interface QuestionPayload {
  type: QuestionType;
  name: string;
  questionText: string;
  categoryId: string;
  generalFeedback?: string;
  /** Pauta de corrección de las preguntas que evalúa una persona. */
  rubric?: string;
  defaultMark?: number;
  penalty?: number;
  shuffleAnswers?: boolean;
  single?: boolean;
  tolerance?: number;
  answers?: { text: string; fraction: number; feedback?: string }[];
  subquestions?: { text: string; answer: string }[];
  tags?: string[];
}

/** Banco de preguntas: categorías, CRUD de preguntas e importación. */
@Injectable({ providedIn: 'root' })
export class QuestionsService {
  private readonly api = inject(ApiService);

  list(query: Record<string, string | number | undefined> = {}): Observable<Paginated<QuestionDto>> {
    return this.api.get<Paginated<QuestionDto>>('/questions', query);
  }

  detail(id: string): Observable<QuestionDto> {
    return this.api.get<QuestionDto>(`/questions/${id}`);
  }

  create(payload: QuestionPayload): Observable<QuestionDto> {
    return this.api.post<QuestionDto>('/questions', payload);
  }

  update(id: string, payload: Partial<QuestionPayload>): Observable<QuestionDto> {
    return this.api.patch<QuestionDto>(`/questions/${id}`, payload);
  }

  duplicate(id: string): Observable<QuestionDto> {
    return this.api.post<QuestionDto>(`/questions/${id}/duplicate`);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/questions/${id}`);
  }

  categories(): Observable<QuestionCategoryDto[]> {
    return this.api.get<QuestionCategoryDto[]>('/questions/categories');
  }

  /** Categoría raíz de la empresa; la API la crea si aún no existe. */
  defaultCategory(): Observable<QuestionCategoryDto> {
    return this.api.get<QuestionCategoryDto>('/questions/categories/default');
  }

  /** Categoría del curso; es donde caen las preguntas escritas desde un examen. */
  defaultCourseCategory(courseId: string): Observable<QuestionCategoryDto> {
    return this.api.get<QuestionCategoryDto>(`/questions/categories/course/${courseId}/default`);
  }

  createCategory(payload: {
    name: string;
    description?: string;
    parentId?: string;
    contextId: string;
  }): Observable<QuestionCategoryDto> {
    return this.api.post<QuestionCategoryDto>('/questions/categories', payload);
  }

  /** Importación masiva en formato GIFT de Moodle o JSON propio. */
  import(payload: {
    format: 'gift' | 'json';
    content: string;
    categoryId: string;
  }): Observable<{ imported: number; errors: string[] }> {
    return this.api.post<{ imported: number; errors: string[] }>('/questions/import', payload);
  }
}
