import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityCatalogItem,
  CategoryNode,
  CourseDetail,
  CourseModuleDto,
  CourseSummary,
  EnrolmentDto,
  EnrolmentMethodDto,
  GroupDto,
  GroupingDto,
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

  activityTypes(): Observable<ActivityCatalogItem[]> {
    return this.api.get<ActivityCatalogItem[]>('/courses/activity-types');
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

  createGroup(courseId: string, payload: { name: string; description?: string; enrolmentKey?: string }) {
    return this.api.post<GroupDto>(`/courses/${courseId}/groups`, payload);
  }

  updateGroup(courseId: string, groupId: string, payload: Record<string, unknown>) {
    return this.api.patch<GroupDto>(`/courses/${courseId}/groups/${groupId}`, payload);
  }

  removeGroup(courseId: string, groupId: string) {
    return this.api.delete<{ deleted: boolean }>(`/courses/${courseId}/groups/${groupId}`);
  }

  addGroupMembers(courseId: string, groupId: string, userIds: string[]) {
    return this.api.post<GroupDto>(`/courses/${courseId}/groups/${groupId}/members`, { userIds });
  }

  /**
   * La baja de integrantes viaja en el cuerpo, no en la ruta: la API acepta
   * varias personas de una vez.
   */
  removeGroupMembers(courseId: string, groupId: string, userIds: string[]) {
    return this.api.deleteWithBody<GroupDto>(
      `/courses/${courseId}/groups/${groupId}/members`,
      { userIds },
    );
  }

  autoCreateGroups(
    courseId: string,
    payload: {
      mode: 'numberOfGroups' | 'membersPerGroup';
      value: number;
      namingScheme?: string;
      allocation?: 'random' | 'alphabetical';
      groupingId?: string;
    },
  ) {
    return this.api.post<GroupDto[]>(`/courses/${courseId}/groups/auto-create`, payload);
  }

  /* ------------------------- Métodos de matrícula ------------------------ */

  enrolmentMethods(courseId: string): Observable<EnrolmentMethodDto[]> {
    return this.api.get<EnrolmentMethodDto[]>(`/courses/${courseId}/enrolments/methods`);
  }

  createEnrolmentMethod(courseId: string, payload: Record<string, unknown>) {
    return this.api.post<EnrolmentMethodDto>(`/courses/${courseId}/enrolments/methods`, payload);
  }

  updateEnrolmentMethod(courseId: string, methodId: string, payload: Record<string, unknown>) {
    return this.api.patch<EnrolmentMethodDto>(
      `/courses/${courseId}/enrolments/methods/${methodId}`,
      payload,
    );
  }

  removeEnrolmentMethod(courseId: string, methodId: string) {
    return this.api.delete<{ deleted: boolean }>(
      `/courses/${courseId}/enrolments/methods/${methodId}`,
    );
  }

  groupings(courseId: string): Observable<GroupingDto[]> {
    return this.api.get<GroupingDto[]>(`/courses/${courseId}/groupings`);
  }

  createGrouping(courseId: string, payload: { name: string; description?: string; groupIds?: string[] }) {
    return this.api.post<GroupingDto>(`/courses/${courseId}/groupings`, payload);
  }

  updateGrouping(courseId: string, groupingId: string, payload: Record<string, unknown>) {
    return this.api.patch<GroupingDto>(`/courses/${courseId}/groupings/${groupingId}`, payload);
  }

  removeGrouping(courseId: string, groupingId: string) {
    return this.api.delete<{ deleted: boolean }>(`/courses/${courseId}/groupings/${groupingId}`);
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
