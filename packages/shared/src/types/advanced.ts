import {
  BadgeCriteriaType,
  BadgeStatus,
  BadgeType,
  CompetencyProficiency,
  CustomFieldScope,
  CustomFieldType,
  LearningPlanStatus,
  ScheduledTaskStatus,
} from '../enums';

export interface CompetencyFrameworkDto {
  id: string;
  shortName: string;
  name: string;
  description?: string | null;
  idNumber?: string | null;
  scaleId?: string | null;
  visible: boolean;
  competencyCount: number;
}

export interface CompetencyDto {
  id: string;
  frameworkId: string;
  parentId: string | null;
  shortName: string;
  description?: string | null;
  idNumber?: string | null;
  path: string;
  depth: number;
  sortOrder: number;
  ruleType?: string | null;
  children?: CompetencyDto[];
}

export interface UserCompetencyDto {
  id: string;
  userId: string;
  competencyId: string;
  competency?: CompetencyDto;
  proficiency: CompetencyProficiency;
  grade?: number | null;
  reviewerId?: string | null;
  evidenceCount: number;
  updatedAt: string;
}

export interface LearningPlanDto {
  id: string;
  userId: string;
  templateId?: string | null;
  name: string;
  description?: string | null;
  status: LearningPlanStatus;
  dueDate?: string | null;
  competencies: UserCompetencyDto[];
  progress: number;
}

export interface BadgeDto {
  id: string;
  tenantId: string;
  courseId?: string | null;
  name: string;
  description: string;
  imageUrl?: string | null;
  type: BadgeType;
  status: BadgeStatus;
  issuerName: string;
  issuerEmail: string;
  expiryDate?: string | null;
  criteria: BadgeCriterionDto[];
  criteriaAggregation: 'all' | 'any';
  awardedCount: number;
}

export interface BadgeCriterionDto {
  id: string;
  type: BadgeCriteriaType;
  description?: string | null;
  moduleIds?: string[];
  courseIds?: string[];
  competencyIds?: string[];
  minGrade?: number | null;
}

export interface IssuedBadgeDto {
  id: string;
  badgeId: string;
  badge?: BadgeDto;
  userId: string;
  uniqueHash: string;
  issuedAt: string;
  expiresAt?: string | null;
  verifyUrl: string;
}

export interface CohortDto {
  id: string;
  tenantId: string;
  contextId: string;
  name: string;
  idNumber?: string | null;
  description?: string | null;
  visible: boolean;
  memberCount: number;
}

export interface CustomFieldDto {
  id: string;
  scope: CustomFieldScope;
  categoryName: string;
  shortName: string;
  name: string;
  type: CustomFieldType;
  description?: string | null;
  required: boolean;
  uniqueValues: boolean;
  visibility: 'all' | 'teachers' | 'none';
  defaultValue?: string | null;
  options?: string[];
  sortOrder: number;
}

export interface TagDto {
  id: string;
  name: string;
  rawName: string;
  description?: string | null;
  isStandard: boolean;
  usageCount: number;
}

export interface CommentDto {
  id: string;
  contextId: string;
  component: string;
  itemId: string;
  userId: string;
  author?: { id: string; fullName: string; avatarUrl: string | null };
  content: string;
  createdAt: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  userRating?: number | null;
}

export interface CertificateTemplateDto {
  id: string;
  tenantId: string;
  name: string;
  backgroundUrl?: string | null;
  bodyHtml: string;
  orientation: 'landscape' | 'portrait';
  showGrade: boolean;
  showDate: boolean;
  showQr: boolean;
}

export interface IssuedCertificateDto {
  id: string;
  templateId: string;
  courseId: string;
  userId: string;
  code: string;
  issuedAt: string;
  grade?: number | null;
  verifyUrl: string;
  downloadUrl: string;
}

export interface WebServiceTokenDto {
  id: string;
  name: string;
  tokenPreview: string;
  scopes: string[];
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  enabled: boolean;
}

export interface WebhookDto {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastStatus?: number | null;
  lastDeliveredAt?: string | null;
}

export interface CourseBackupDto {
  id: string;
  courseId: string;
  courseName: string;
  filename: string;
  size: number;
  includeUsers: boolean;
  createdAt: string;
  createdBy: string;
  downloadUrl: string;
}

export interface AnalyticsCourseOverview {
  courseId: string;
  courseName: string;
  enrolled: number;
  active7d: number;
  completionRate: number;
  averageGrade: number | null;
  submissionsPending: number;
  atRiskUsers: { id: string; fullName: string; risk: number; reasons: string[] }[];
  activityByDay: { date: string; views: number; posts: number; submissions: number }[];
}

/** Solicitud de exportación o eliminación de datos personales (RGPD). */
export interface DataRequestDto {
  id: string;
  userId: string;
  user?: { id: string; fullName: string; email: string };
  requestType: 'export' | 'delete';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  comment?: string | null;
  handledBy?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

/** Estado de una tarea programada del cron. */
export interface ScheduledTaskDto {
  id: string;
  taskName: string;
  description: string;
  status: ScheduledTaskStatus;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastDurationMs: number;
  lastError?: string | null;
  enabled: boolean;
}
