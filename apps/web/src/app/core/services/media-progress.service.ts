import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CourseMediaProgressDto,
  MediaHeartbeatInput,
  MediaProgressDto,
  MediaProgressReport,
} from '@maya/shared';
import { ApiService } from './api.service';

/** Registro y consulta del cumplimiento de visualización de los vídeos. */
@Injectable({ providedIn: 'root' })
export class MediaProgressService {
  private readonly api = inject(ApiService);

  play(moduleId: string, payload: Omit<MediaHeartbeatInput, 'positionSeconds' | 'deltaSeconds'>) {
    return this.api.post<MediaProgressDto>(`/media-progress/modules/${moduleId}/play`, {
      ...payload,
      positionSeconds: 0,
      deltaSeconds: 0,
    });
  }

  heartbeat(moduleId: string, payload: MediaHeartbeatInput): Observable<MediaProgressDto> {
    return this.api.post<MediaProgressDto>(
      `/media-progress/modules/${moduleId}/heartbeat`,
      payload,
    );
  }

  ofModule(moduleId: string): Observable<MediaProgressDto[]> {
    return this.api.get<MediaProgressDto[]>(`/media-progress/modules/${moduleId}/me`);
  }

  ofCourse(courseId: string): Observable<CourseMediaProgressDto> {
    return this.api.get<CourseMediaProgressDto>(`/media-progress/courses/${courseId}/me`);
  }

  ofStudent(courseId: string, userId: string): Observable<CourseMediaProgressDto> {
    return this.api.get<CourseMediaProgressDto>(
      `/media-progress/courses/${courseId}/users/${userId}`,
    );
  }

  courseReport(courseId: string): Observable<MediaProgressReport> {
    return this.api.get<MediaProgressReport>(`/media-progress/courses/${courseId}/report`);
  }
}
