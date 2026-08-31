import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategoryNode,
  CourseDetail,
  CourseModuleDto,
  CourseSummary,
  EnrolmentDto,
  GroupDto,
  Paginated,
  SectionDto,
} from '../models';
import { ApiService } from './api.service';

export interface CourseQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  includeSubcategories?: boolean;
  classification?: 'inprogress' | 'future' | 'past' | 'favourites' | 'all';
  tag?: string;
}

export interface ActivityType {
  type: string;
  label: string;
  icon: string;
  gradable: boolean;
}

@Injectable({ providedIn: 'root' })
export class CoursesService {
  private readonly api = inject(ApiService);

  list(query: CourseQuery = {}): Observable<Paginated<CourseSummary>> {
    return this.api.get<Paginated<CourseSummary>>('/courses', { ...query });
  }

  myCourses(query: CourseQuery = {}): Observable<Paginated<CourseSummary>> {
    return this.api.get<Paginated<CourseSummary>>('/courses/my', { ...query });
  }

  detail(id: string): Observable<CourseDetail> {
    return this.api.get<CourseDetail>(`/courses/${id}`);
  }

  contents(id: string): Observable<SectionDto[]> {
    return this.api.get<SectionDto[]>(`/courses/${id}/contents`);
  }

  create(payload: Partial<CourseDetail> & { shortName: string; fullName: string; categoryId: string }) {
    return this.api.post<CourseDetail>('/courses', payload);
  }

  update(id: string, payload: Partial<CourseDetail>): Observable<CourseDetail> {
    return this.api.patch<CourseDetail>(`/courses/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/courses/${id}`);
  }

  toggleFavourite(id: string): Observable<{ favourite: boolean }> {
    return this.api.post<{ favourite: boolean }>(`/courses/${id}/favourite`);
  }

  activityTypes(): Observable<ActivityType[]> {
    return this.api.get<ActivityType[]>('/courses/activity-types');
  }

  /* ------------------------------ Secciones ------------------------------ */

  addSection(courseId: string, payload: { name?: string; summary?: string }) {
    return this.api.post<SectionDto>(`/courses/${courseId}/sections`, payload);
  }

  updateSection(courseId: string, sectionId: string, payload: Partial<SectionDto>) {
    return this.api.patch<SectionDto>(`/courses/${courseId}/sections/${sectionId}`, payload);
  }

  removeSection(courseId: string, sectionId: string) {
    return this.api.delete<{ deleted: boolean }>(`/courses/${courseId}/sections/${sectionId}`);
  }

  /* ------------------------------- Módulos ------------------------------- */

  addModule(
    courseId: string,
    payload: {
      moduleType: string;
      sectionId: string;
      name: string;
      description?: string;
      settings?: Record<string, unknown>;
      completionTracking?: number;
      completionRules?: Record<string, unknown>;
    },
  ): Observable<CourseModuleDto> {
    return this.api.post<CourseModuleDto>(`/courses/${courseId}/modules`, payload);
  }

  updateModule(courseId: string, moduleId: string, payload: Record<string, unknown>) {
    return this.api.patch<CourseModuleDto>(`/courses/${courseId}/modules/${moduleId}`, payload);
  }

  moveModule(courseId: string, moduleId: string, sectionId: string, position: number) {
    return this.api.patch<{ moved: boolean }>(`/courses/${courseId}/modules/${moduleId}/move`, {
      sectionId,
      position,
    });
  }

  setModuleVisibility(courseId: string, moduleId: string, visible: boolean) {
    return this.api.patch<CourseModuleDto>(
      `/courses/${courseId}/modules/${moduleId}/visibility`,
      { visible },
    );
  }

  duplicateModule(courseId: string, moduleId: string) {
    return this.api.post<CourseModuleDto>(`/courses/${courseId}/modules/${moduleId}/duplicate`);
  }

  removeModule(courseId: string, moduleId: string) {
    return this.api.delete<{ deleted: boolean }>(`/courses/${courseId}/modules/${moduleId}`);
  }

  /* ----------------------------- Participantes --------------------------- */

  participants(courseId: string, query: Record<string, string | number> = {}) {
    return this.api.get<Paginated<EnrolmentDto>>(`/courses/${courseId}/enrolments`, query);
  }

  enrol(courseId: string, userIds: string[], roleShortName = 'student') {
    return this.api.post<{ enrolled: number }>(`/courses/${courseId}/enrolments`, {
      userIds,
      roleShortName,
    });
  }

  unenrol(courseId: string, userId: string) {
    return this.api.delete<{ unenrolled: boolean }>(
      `/courses/${courseId}/enrolments/users/${userId}`,
    );
  }

  selfEnrol(courseId: string, enrolmentKey?: string) {
    return this.api.post(`/courses/${courseId}/enrolments/self`, { enrolmentKey });
  }

  groups(courseId: string): Observable<GroupDto[]> {
    return this.api.get<GroupDto[]>(`/courses/${courseId}/groups`);
  }

  /* ------------------------------ Categorías ----------------------------- */

  categoryTree(): Observable<CategoryNode[]> {
    return this.api.get<CategoryNode[]>('/categories/tree');
  }

  categories(): Observable<CategoryNode[]> {
    return this.api.get<CategoryNode[]>('/categories');
  }

  createCategory(payload: { name: string; parentId?: string; description?: string }) {
    return this.api.post<CategoryNode>('/categories', payload);
  }
}
