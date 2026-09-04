import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CourseGradeSummaryDto,
  GradeCategoryDto,
  GradeItemDto,
  GradeLetterDto,
  GradeScaleDto,
  GraderReport,
  UserGradeReport,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class GradesService {
  private readonly api = inject(ApiService);

  graderReport(courseId: string): Observable<GraderReport> {
    return this.api.get<GraderReport>(`/courses/${courseId}/grades/report`);
  }

  myReport(courseId: string): Observable<UserGradeReport> {
    return this.api.get<UserGradeReport>(`/courses/${courseId}/grades/me`);
  }

  userReport(courseId: string, userId: string): Observable<UserGradeReport> {
    return this.api.get<UserGradeReport>(`/courses/${courseId}/grades/users/${userId}`);
  }

  /** Situación académica propia: nota final, requisitos y si se aprueba. */
  mySummary(courseId: string): Observable<CourseGradeSummaryDto> {
    return this.api.get<CourseGradeSummaryDto>(`/courses/${courseId}/grades/summary/me`);
  }

  studentSummary(courseId: string, userId: string): Observable<CourseGradeSummaryDto> {
    return this.api.get<CourseGradeSummaryDto>(
      `/courses/${courseId}/grades/summary/users/${userId}`,
    );
  }

  /* ---------------------------- Ítems ---------------------------------- */

  items(courseId: string): Observable<GradeItemDto[]> {
    return this.api.get<GradeItemDto[]>(`/courses/${courseId}/grades/items`);
  }

  createItem(courseId: string, payload: Record<string, unknown>): Observable<GradeItemDto> {
    return this.api.post<GradeItemDto>(`/courses/${courseId}/grades/items`, payload);
  }

  updateItem(
    courseId: string,
    itemId: string,
    payload: Record<string, unknown>,
  ): Observable<GradeItemDto> {
    return this.api.patch<GradeItemDto>(`/courses/${courseId}/grades/items/${itemId}`, payload);
  }

  removeItem(courseId: string, itemId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/courses/${courseId}/grades/items/${itemId}`);
  }

  /* -------------------------- Categorías ------------------------------- */

  categories(courseId: string): Observable<GradeCategoryDto[]> {
    return this.api.get<GradeCategoryDto[]>(`/courses/${courseId}/grades/categories`);
  }

  createCategory(courseId: string, payload: Record<string, unknown>): Observable<GradeCategoryDto> {
    return this.api.post<GradeCategoryDto>(`/courses/${courseId}/grades/categories`, payload);
  }

  updateCategory(
    courseId: string,
    categoryId: string,
    payload: Record<string, unknown>,
  ): Observable<GradeCategoryDto> {
    return this.api.patch<GradeCategoryDto>(
      `/courses/${courseId}/grades/categories/${categoryId}`,
      payload,
    );
  }

  removeCategory(courseId: string, categoryId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(
      `/courses/${courseId}/grades/categories/${categoryId}`,
    );
  }

  /* --------------------------- Escalas y letras -------------------------- */

  scales(courseId?: string): Observable<GradeScaleDto[]> {
    return this.api.get<GradeScaleDto[]>('/grade-scales', { courseId });
  }

  createScale(payload: {
    name: string;
    items: string[];
    description?: string;
    courseId?: string;
  }): Observable<GradeScaleDto> {
    return this.api.post<GradeScaleDto>('/grade-scales', payload);
  }

  letters(courseId: string): Observable<GradeLetterDto[]> {
    return this.api.get<GradeLetterDto[]>(`/courses/${courseId}/grades/letters`);
  }

  setLetters(
    courseId: string,
    letters: { letter: string; lowerBoundary: number }[],
  ): Observable<GradeLetterDto[]> {
    return this.api.post<GradeLetterDto[]>(`/courses/${courseId}/grades/letters`, { letters });
  }

  /* ------------------------------ Notas --------------------------------- */

  setGrade(courseId: string, itemId: string, userId: string, grade: number | null, feedback?: string) {
    return this.api.post(`/courses/${courseId}/grades/items/${itemId}/grade`, {
      userId,
      grade,
      feedback,
    });
  }

  exportCsv(courseId: string): Observable<Blob> {
    return this.api.download(`/courses/${courseId}/grades/export`);
  }
}
