import {
  CertificateAccessMode,
  CompletionState,
  CompletionTracking,
  CourseFormat,
  CourseVisibility,
  EnrolmentMethod,
  EnrolmentStatus,
  GroupMode,
  ModuleType,
} from '../enums';
import type { CourseCatalog } from './site';

export interface CategoryNode {
  id: string;
  name: string;
  idNumber?: string | null;
  description?: string | null;
  parentId: string | null;
  path: string;
  depth: number;
  visible: boolean;
  sortOrder: number;
  courseCount: number;
  children?: CategoryNode[];
}

export interface CourseSummary {
  id: string;
  shortName: string;
  fullName: string;
  summary?: string | null;
  imageUrl?: string | null;
  categoryId: string;
  categoryName?: string;
  format: CourseFormat;
  visibility: CourseVisibility;
  startDate?: string | null;
  endDate?: string | null;
  progress?: number | null;
  enrolledCount?: number;
  teachers?: { id: string; fullName: string; avatarUrl: string | null }[];
  lastAccess?: string | null;
  favourite?: boolean;
  /** Datos de venta. Solo llega a quien administra: fuera se usa `PublicCourseDto`. */
  catalog?: CourseCatalog;
}

export interface CourseDetail extends CourseSummary {
  idNumber?: string | null;
  numSections: number;
  groupMode: GroupMode;
  forceGroupMode: boolean;
  showGradebook: boolean;
  enableCompletion: boolean;
  completionNotify: boolean;
  language?: string | null;
  maxUploadBytes: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  /** Reglas de aprobación y acreditación. Ver `CourseGradeSettings`. */
  gradeSettings?: CourseGradeSettings;
}

export interface SectionDto {
  id: string;
  courseId: string;
  sectionNumber: number;
  name?: string | null;
  summary?: string | null;
  visible: boolean;
  availabilityJson?: string | null;
  modules: CourseModuleDto[];
}

export interface CourseModuleDto {
  id: string;
  courseId: string;
  sectionId: string;
  moduleType: ModuleType;
  instanceId: string;
  name: string;
  description?: string | null;
  visible: boolean;
  stealth: boolean;
  sortOrder: number;
  indent: number;
  groupMode: GroupMode;
  groupingId?: string | null;
  completionTracking: CompletionTracking;
  completionExpected?: string | null;
  availabilityJson?: string | null;
  gradeMax?: number | null;
  /** Estado de finalización del usuario actual. */
  completionState?: CompletionState;
  /** Indica si el usuario actual cumple las restricciones de acceso. */
  available?: boolean;
  availabilityInfo?: string | null;
  url?: string;
}

export interface EnrolmentDto {
  id: string;
  courseId: string;
  userId: string;
  user?: { id: string; fullName: string; email: string; avatarUrl: string | null };
  method: EnrolmentMethod;
  status: EnrolmentStatus;
  roles: { id: string; shortName: string; name: string }[];
  groups: { id: string; name: string }[];
  timeStart?: string | null;
  timeEnd?: string | null;
  lastAccess?: string | null;
  createdAt: string;
}

/** Instancia de un método de matriculación configurado en un curso. */
export interface EnrolmentMethodDto {
  id: string;
  courseId: string;
  method: EnrolmentMethod;
  name: string;
  enabled: boolean;
  roleId?: string | null;
  /** Clave que se pide al automatricularse; nunca se expone a estudiantes. */
  enrolmentKey?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Duración de la matrícula en días; 0 significa ilimitada. */
  enrolPeriodDays: number;
  /** Tope de matriculados; 0 significa sin tope. */
  maxEnrolled: number;
  cohortId?: string | null;
  sendWelcomeMessage: boolean;
  welcomeMessage?: string | null;
  sortOrder: number;
}

export interface GroupDto {
  id: string;
  courseId: string;
  name: string;
  description?: string | null;
  idNumber?: string | null;
  enrolmentKey?: string | null;
  pictureUrl?: string | null;
  memberCount: number;
  /** Integrantes resueltos; los devuelve el listado de grupos del curso. */
  members?: { id: string; fullName: string; email: string; avatarUrl: string | null }[];
  groupingIds: string[];
}

export interface GroupingDto {
  id: string;
  courseId: string;
  name: string;
  description?: string | null;
  groupIds: string[];
}

/* ------------------------- Evaluación y acreditación ---------------------- */

/**
 * Reglas de aprobación del curso.
 *
 * `passingGrade` va en la misma escala que `gradeMax` —la nota sobre 20 que se
 * usa en Perú, o sobre 10, o sobre 100— y no en porcentaje: quien configura el
 * curso piensa en «se aprueba con 14», no en «con el 70 %».
 */
export interface CourseGradeSettings {
  /** Escala del curso. La nota final se expresa siempre sobre esto. */
  gradeMax: number;
  /** Nota mínima para aprobar. `null` deja el curso sin aprobado ni suspenso. */
  passingGrade: number | null;
  /**
   * Además de la nota, exige haber superado todos los exámenes marcados como
   * obligatorios. Sin esto, una media alta podría tapar un examen requerido
   * suspendido.
   */
  requireRequiredExams: boolean;
  /** Además de la nota, exige completar todas las actividades del curso. */
  requireCompletion: boolean;
  /** Porcentaje mínimo de vídeo visto que se exige para aprobar. 0 = no se exige. */
  requiredVideoPercent: number;
  /** Enseña al alumno su nota final y si aprueba. */
  showFinalGrade: boolean;
  /** Emite el certificado en cuanto se cumplen todas las condiciones. */
  autoIssueCertificate: boolean;
  certificateAccess: CertificateAccessMode;
  /** Plantilla de certificado del curso; `null` usa la de la empresa. */
  certificateTemplateId: string | null;
}

/** Por qué alguien aprueba o no. Una fila por condición configurada. */
export interface CourseGradeRequirement {
  key: 'grade' | 'exams' | 'completion' | 'video';
  label: string;
  met: boolean;
  /** Lo conseguido y lo exigido, ya escritos para enseñarlos tal cual. */
  actual: string;
  required: string;
}

/** Situación académica de un alumno en un curso. */
export interface CourseGradeSummaryDto {
  courseId: string;
  userId: string;
  gradeMax: number;
  passingGrade: number | null;
  /** Nota final sobre `gradeMax`, o `null` si aún no hay nada calificado. */
  finalGrade: number | null;
  percentage: number | null;
  letter: string | null;
  passed: boolean | null;
  requirements: CourseGradeRequirement[];
  /** Desglose por ítem calificable, en el orden del libro de notas. */
  items: {
    itemId: string;
    name: string;
    moduleType: string | null;
    moduleId: string | null;
    grade: number | null;
    grademax: number;
    gradepass: number | null;
    weight: number;
    /** Examen marcado como obligatorio para superar el curso. */
    required: boolean;
    passed: boolean | null;
    pendingManualGrading: boolean;
  }[];
  progress: number;
  completedAt: string | null;
  certificate: { code: string; verifyUrl: string; downloadUrl: string | null } | null;
}
