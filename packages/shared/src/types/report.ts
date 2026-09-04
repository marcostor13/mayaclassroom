import { CompletionState, QuizAttemptState } from '../enums';
import type { UserSignatureDto } from './signature';

/* -------------------------------------------------------------------------- */
/*  Expediente del alumno                                                      */
/* -------------------------------------------------------------------------- */

/** Indicador de cabecera del expediente. */
export interface StudentKpi {
  key: string;
  label: string;
  value: number;
  /** `percent`, `hours`, `count` o `grade`: decide cómo se escribe. */
  unit: 'percent' | 'hours' | 'count' | 'grade';
  hint?: string | null;
}

export interface StudentCourseRow {
  courseId: string;
  shortName: string;
  fullName: string;
  enrolledAt: string | null;
  lastAccessAt: string | null;
  progress: number;
  completedModules: number;
  totalModules: number;
  completedAt: string | null;
  finalGrade: number | null;
  passingGrade: number | null;
  passed: boolean | null;
  videoPercent: number | null;
  /** Horas de vídeo efectivamente reproducidas en el curso. */
  videoHours: number;
  attendanceSessions: number;
  attendanceHours: number;
  certificateCode: string | null;
}

export interface StudentActivityRow {
  courseId: string;
  courseName: string;
  moduleId: string;
  moduleName: string;
  moduleType: string;
  completionState: CompletionState;
  completedAt: string | null;
  grade: number | null;
  gradeMax: number | null;
}

export interface StudentExamRow {
  courseId: string;
  courseName: string;
  quizName: string;
  attempt: number;
  state: QuizAttemptState;
  startedAt: string;
  finishedAt: string | null;
  grade: number | null;
  maxGrade: number;
  passingGrade: number | null;
  passed: boolean | null;
  pendingManualGrading: boolean;
}

export interface StudentAttendanceRow {
  courseId: string | null;
  courseName: string | null;
  sessionTitle: string;
  startedAt: string;
  minutes: number;
  signed: boolean;
  signedAt: string | null;
}

/** Informe completo de un alumno: lo que se ve en pantalla y lo que se exporta. */
export interface StudentReportDto {
  generatedAt: string;
  tenant: { id: string; name: string; logoUrl: string | null; primaryColor: string | null };
  student: {
    id: string;
    fullName: string;
    email: string;
    idNumber: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    department: string | null;
    institution: string | null;
    avatarUrl: string | null;
    status: string;
    createdAt: string;
    lastAccessAt: string | null;
  };
  kpis: StudentKpi[];
  courses: StudentCourseRow[];
  activities: StudentActivityRow[];
  exams: StudentExamRow[];
  attendance: StudentAttendanceRow[];
  signature: UserSignatureDto | null;
}
