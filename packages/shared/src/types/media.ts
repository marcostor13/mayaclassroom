import { MediaSourceKind } from '../enums';

/* -------------------------------------------------------------------------- */
/*  Seguimiento de reproducción                                                */
/* -------------------------------------------------------------------------- */

/**
 * Avance de una persona sobre un vídeo concreto.
 *
 * `watchedSeconds` no es la posición del cursor sino el tiempo **distinto**
 * realmente reproducido: se acumula por tramos, de modo que arrastrar la barra
 * hasta el final no da el vídeo por visto. `percent` se calcula sobre él.
 */
export interface MediaProgressDto {
  id: string;
  courseId: string;
  moduleId: string;
  /** Identificador del bloque de lección o de la grabación. */
  mediaId: string;
  kind: MediaSourceKind;
  title: string | null;
  durationSeconds: number;
  watchedSeconds: number;
  lastPositionSeconds: number;
  percent: number;
  completed: boolean;
  completedAt: string | null;
  firstPlayedAt: string;
  lastPlayedAt: string;
  playCount: number;
}

/** Avance de un alumno en todos los vídeos de un curso. */
export interface CourseMediaProgressDto {
  courseId: string;
  /** Vídeos medibles del curso (los incrustados no cuentan). */
  totalVideos: number;
  completedVideos: number;
  /** Porcentaje medio ponderado por duración. */
  percent: number;
  watchedSeconds: number;
  totalSeconds: number;
  items: MediaProgressDto[];
}

/** Fila del informe de visualización que ve el profesorado. */
export interface MediaProgressReportRow {
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
  completedVideos: number;
  totalVideos: number;
  percent: number;
  watchedSeconds: number;
  lastPlayedAt: string | null;
}

export interface MediaProgressReport {
  courseId: string;
  totalVideos: number;
  totalSeconds: number;
  rows: MediaProgressReportRow[];
  /** Media de avance de todo el grupo, para comparar cada fila con ella. */
  averagePercent: number;
}

/** Latido que envía el reproductor mientras se ve un vídeo. */
export interface MediaHeartbeatInput {
  mediaId: string;
  kind: MediaSourceKind;
  title?: string | null;
  durationSeconds: number;
  positionSeconds: number;
  /** Segundos reproducidos desde el latido anterior. */
  deltaSeconds: number;
}
