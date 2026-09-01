import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  CourseBackupDto,
  CustomFieldDto,
  CustomFieldScope,
  DataRequestDto,
  Paginated,
  ScheduledTaskDto,
  TagDto,
  WebServiceTokenDto,
  WebhookDto,
} from '@maya/shared';
import { ApiService } from './api.service';

/** Evento del registro, tal como lo devuelve `GET /logs`. */
export interface LogEntry {
  id: string;
  userId?: string | null;
  userName?: string | null;
  courseId?: string | null;
  component: string;
  target: string;
  action: string;
  description?: string | null;
  ip?: string | null;
  createdAt: string;
}

/**
 * Administración del sitio: registros, copias de seguridad, etiquetas, campos
 * personalizados, RGPD, servicios web y tareas programadas.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly api = inject(ApiService);

  /* ------------------------------ Registros ------------------------------ */

  logs(query: Record<string, string | number | undefined> = {}): Observable<Paginated<LogEntry>> {
    return this.api.get<Paginated<LogEntry>>('/logs', query);
  }

  /* -------------------------- Copias de seguridad ------------------------ */

  backups(courseId?: string): Observable<CourseBackupDto[]> {
    return this.api.get<CourseBackupDto[]>('/backups', { courseId });
  }

  createBackup(courseId: string, includeUsers: boolean): Observable<CourseBackupDto> {
    return this.api.post<CourseBackupDto>(`/backups/courses/${courseId}`, { includeUsers });
  }

  downloadBackup(id: string): Observable<Blob> {
    return this.api.download(`/backups/${id}/download`);
  }

  restoreBackup(
    id: string,
    payload: { categoryId: string; shortName: string; fullName: string },
  ): Observable<{ courseId: string }> {
    return this.api.post<{ courseId: string }>(`/backups/${id}/restore`, payload);
  }

  importCourse(sourceCourseId: string, targetCourseId: string): Observable<{ imported: number }> {
    return this.api.post<{ imported: number }>('/backups/import', {
      sourceCourseId,
      targetCourseId,
    });
  }

  deleteBackup(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/backups/${id}`);
  }

  /* ------------------------------- Etiquetas ----------------------------- */

  tags(search?: string): Observable<TagDto[]> {
    return this.api.get<TagDto[]>('/tags', { search });
  }

  setTagStandard(id: string, isStandard: boolean): Observable<TagDto> {
    return this.api.patch<TagDto>(`/tags/${id}/standard`, { isStandard });
  }

  deleteTag(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/tags/${id}`);
  }

  /* ------------------------- Campos personalizados ----------------------- */

  customFields(scope?: CustomFieldScope): Observable<CustomFieldDto[]> {
    return this.api.get<CustomFieldDto[]>('/custom-fields', { scope });
  }

  createCustomField(payload: Record<string, unknown>): Observable<CustomFieldDto> {
    return this.api.post<CustomFieldDto>('/custom-fields', payload);
  }

  updateCustomField(id: string, payload: Record<string, unknown>): Observable<CustomFieldDto> {
    return this.api.patch<CustomFieldDto>(`/custom-fields/${id}`, payload);
  }

  deleteCustomField(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/custom-fields/${id}`);
  }

  /* --------------------------------- RGPD -------------------------------- */

  privacyRequests(): Observable<DataRequestDto[]> {
    return this.api.get<DataRequestDto[]>('/privacy/requests');
  }

  myPrivacyRequests(): Observable<DataRequestDto[]> {
    return this.api.get<DataRequestDto[]>('/privacy/requests/me');
  }

  createPrivacyRequest(
    requestType: 'export' | 'delete',
    comment?: string,
  ): Observable<DataRequestDto> {
    return this.api.post<DataRequestDto>('/privacy/requests', { requestType, comment });
  }

  resolvePrivacyRequest(
    id: string,
    status: 'approved' | 'rejected',
  ): Observable<DataRequestDto> {
    return this.api.patch<DataRequestDto>(`/privacy/requests/${id}`, { status });
  }

  exportMyData(): Observable<Blob> {
    return this.api.download('/privacy/export');
  }

  /* ----------------------------- Servicios web --------------------------- */

  tokens(): Observable<WebServiceTokenDto[]> {
    return this.api.get<WebServiceTokenDto[]>('/web-services/tokens');
  }

  /** El valor completo del token sólo viaja en esta respuesta. */
  createToken(payload: {
    name: string;
    scopes?: string[];
    expiresAt?: string;
  }): Observable<WebServiceTokenDto & { token: string }> {
    return this.api.post<WebServiceTokenDto & { token: string }>('/web-services/tokens', payload);
  }

  revokeToken(id: string): Observable<{ revoked: boolean }> {
    return this.api.delete<{ revoked: boolean }>(`/web-services/tokens/${id}`);
  }

  webhooks(): Observable<WebhookDto[]> {
    return this.api.get<WebhookDto[]>('/web-services/webhooks');
  }

  createWebhook(payload: {
    name: string;
    url: string;
    events: string[];
    secret?: string;
  }): Observable<WebhookDto> {
    return this.api.post<WebhookDto>('/web-services/webhooks', payload);
  }

  deleteWebhook(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/web-services/webhooks/${id}`);
  }

  /* -------------------------- Tareas programadas ------------------------- */

  scheduledTasks(): Observable<ScheduledTaskDto[]> {
    return this.api.get<ScheduledTaskDto[]>('/analytics/tasks');
  }
}
