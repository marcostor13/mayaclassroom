import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { GradeItemDto, GraderReport, UserGradeReport } from '../models';
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

  items(courseId: string): Observable<GradeItemDto[]> {
    return this.api.get<GradeItemDto[]>(`/courses/${courseId}/grades/items`);
  }

  createItem(courseId: string, payload: { name: string; grademax?: number }) {
    return this.api.post<GradeItemDto>(`/courses/${courseId}/grades/items`, payload);
  }

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
