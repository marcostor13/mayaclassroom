import {
  CompletionState,
  CompletionTracking,
  CourseFormat,
  CourseVisibility,
  EnrolmentMethod,
  EnrolmentStatus,
  GroupMode,
  ModuleType,
} from '../enums';

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
