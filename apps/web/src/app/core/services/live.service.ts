import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LiveAttendanceRowDto,
  LiveChatMessageDto,
  LiveIceConfigDto,
  LiveParticipantDto,
  LiveRecordingDto,
  LiveSessionDto,
  LiveSessionStatus,
  WhiteboardStateDto,
} from '../models';
import { ApiService } from './api.service';

/** Datos de una convocatoria nueva o editada. */
export interface LiveSessionInput {
  title: string;
  description?: string | null;
  mode?: string;
  courseId?: string | null;
  groupId?: string | null;
  scheduledStart: string;
  scheduledEnd?: string | null;
  coHostIds?: string[];
  openToTenant?: boolean;
  settings?: Partial<LiveSessionDto['settings']>;
  reminderMinutes?: number;
  notify?: boolean;
}

/**
 * Cara REST de las aulas en vivo: convocar, listar, informes y grabaciones.
 * Todo lo que pasa *dentro* de la sala —señalización, chat, pizarra— viaja por
 * el socket y vive en `LiveRoomService`.
 */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly api = inject(ApiService);

  /* -------------------------------- Sesiones ------------------------------ */

  sessions(query: {
    status?: LiveSessionStatus;
    courseId?: string;
    upcoming?: boolean;
    from?: string;
    to?: string;
    limit?: number;
  } = {}): Observable<LiveSessionDto[]> {
    return this.api.get<LiveSessionDto[]>('/live/sessions', { ...query });
  }

  session(ref: string): Observable<LiveSessionDto> {
    return this.api.get<LiveSessionDto>(`/live/sessions/${ref}`);
  }

  participants(ref: string): Observable<LiveParticipantDto[]> {
    return this.api.get<LiveParticipantDto[]>(`/live/sessions/${ref}/participants`);
  }

  attendance(ref: string): Observable<LiveAttendanceRowDto[]> {
    return this.api.get<LiveAttendanceRowDto[]>(`/live/sessions/${ref}/attendance`);
  }

  chatHistory(ref: string): Observable<LiveChatMessageDto[]> {
    return this.api.get<LiveChatMessageDto[]>(`/live/sessions/${ref}/chat`);
  }

  boardState(ref: string): Observable<WhiteboardStateDto> {
    return this.api.get<WhiteboardStateDto>(`/live/sessions/${ref}/board`);
  }

  /**
   * Convoca. La ruta cambia según haya curso porque el permiso se evalúa donde
   * el profesorado lo tiene: en el curso si la clase es de uno, y en la empresa
   * si es una reunión suelta.
   */
  create(input: LiveSessionInput): Observable<LiveSessionDto> {
    const { courseId, ...resto } = input;
    return courseId
      ? this.api.post<LiveSessionDto>(`/live/courses/${courseId}/sessions`, resto)
      : this.api.post<LiveSessionDto>('/live/sessions', resto);
  }

  update(id: string, input: Partial<LiveSessionInput>): Observable<LiveSessionDto> {
    return this.api.patch<LiveSessionDto>(`/live/sessions/${id}`, input);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/live/sessions/${id}`);
  }

  end(id: string): Observable<LiveSessionDto> {
    return this.api.post<LiveSessionDto>(`/live/sessions/${id}/end`);
  }

  resetBoard(id: string): Observable<WhiteboardStateDto> {
    return this.api.post<WhiteboardStateDto>(`/live/sessions/${id}/board/reset`);
  }

  iceServers(): Observable<LiveIceConfigDto> {
    return this.api.get<LiveIceConfigDto>('/live/ice-servers');
  }

  /* ------------------------------ Grabaciones ----------------------------- */

  library(): Observable<LiveRecordingDto[]> {
    return this.api.get<LiveRecordingDto[]>('/live/recordings');
  }

  recordings(ref: string): Observable<LiveRecordingDto[]> {
    return this.api.get<LiveRecordingDto[]>(`/live/sessions/${ref}/recordings`);
  }

  startRecording(
    sessionId: string,
    body: { title?: string; mimeType?: string },
  ): Observable<LiveRecordingDto> {
    return this.api.post<LiveRecordingDto>(`/live/sessions/${sessionId}/recordings`, body);
  }

  uploadChunk(recordingId: string, index: number, blob: Blob): Observable<{ received: number }> {
    const form = new FormData();
    form.append('index', String(index));
    form.append('chunk', blob, `${index}.part`);
    return this.api.upload<{ received: number }>(`/live/recordings/${recordingId}/chunks`, form);
  }

  finishRecording(
    recordingId: string,
    body: { durationSeconds: number; chunkCount: number },
  ): Observable<LiveRecordingDto> {
    return this.api.post<LiveRecordingDto>(`/live/recordings/${recordingId}/finish`, body);
  }

  abortRecording(recordingId: string): Observable<{ aborted: boolean }> {
    return this.api.post<{ aborted: boolean }>(`/live/recordings/${recordingId}/abort`);
  }

  updateRecording(
    recordingId: string,
    body: { title?: string; visibleToStudents?: boolean },
  ): Observable<LiveRecordingDto> {
    return this.api.patch<LiveRecordingDto>(`/live/recordings/${recordingId}`, body);
  }

  removeRecording(recordingId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/live/recordings/${recordingId}`);
  }

  /** Descarga el vídeo con el testigo de sesión, que un `src` no enviaría. */
  media(recordingId: string): Observable<Blob> {
    return this.api.download(`/live/recordings/${recordingId}/media`);
  }
}
