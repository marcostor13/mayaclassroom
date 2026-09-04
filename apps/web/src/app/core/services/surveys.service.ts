import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { SurveyDto, SurveyQuestionType, SurveyResultsDto, SurveyTrigger } from '@maya/shared';
import { ApiService } from './api.service';

/** Una pregunta tal como se manda al crear o actualizar una encuesta. */
export interface SurveyQuestionPayload {
  type: SurveyQuestionType;
  text: string;
  help?: string;
  required?: boolean;
  options?: string[];
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
}

export interface SurveyPayload {
  title: string;
  description?: string;
  trigger?: SurveyTrigger;
  anonymous?: boolean;
  questions?: SurveyQuestionPayload[];
  opensAt?: string;
  closesAt?: string;
}

/** Encuestas de curso: gestión, respuesta y resultados. */
@Injectable({ providedIn: 'root' })
export class SurveysService {
  private readonly api = inject(ApiService);

  forCourse(courseId: string): Observable<SurveyDto[]> {
    return this.api.get<SurveyDto[]>(`/surveys/courses/${courseId}`);
  }

  mineInCourse(courseId: string): Observable<SurveyDto[]> {
    return this.api.get<SurveyDto[]>(`/surveys/courses/${courseId}/me`);
  }

  create(courseId: string, payload: SurveyPayload): Observable<SurveyDto> {
    return this.api.post<SurveyDto>(`/surveys/courses/${courseId}`, payload);
  }

  update(id: string, payload: Partial<SurveyPayload>): Observable<SurveyDto> {
    return this.api.patch<SurveyDto>(`/surveys/${id}`, payload);
  }

  publish(id: string): Observable<SurveyDto> {
    return this.api.post<SurveyDto>(`/surveys/${id}/publish`);
  }

  close(id: string): Observable<SurveyDto> {
    return this.api.post<SurveyDto>(`/surveys/${id}/close`);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/surveys/${id}`);
  }

  /** Encuesta para responderla, con si esta persona ya lo hizo. */
  respond(id: string): Observable<SurveyDto & { answered: boolean }> {
    return this.api.get<SurveyDto & { answered: boolean }>(`/surveys/${id}/respond`);
  }

  submit(id: string, answers: Record<string, unknown>): Observable<{ submitted: boolean }> {
    return this.api.post<{ submitted: boolean }>(`/surveys/${id}/responses`, { answers });
  }

  results(id: string): Observable<SurveyResultsDto> {
    return this.api.get<SurveyResultsDto>(`/surveys/${id}/results`);
  }

  /** Las descargas pasan por el cliente HTTP para llevar el testigo. */
  excel(id: string): Observable<Blob> {
    return this.api.download(`/surveys/${id}/export.xlsx`);
  }

  csv(id: string): Observable<Blob> {
    return this.api.download(`/surveys/${id}/export.csv`);
  }
}
