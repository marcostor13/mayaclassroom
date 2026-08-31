import { GradeAggregation, GradeItemType, GradeType } from '../enums';

export interface GradeItemDto {
  id: string;
  courseId: string;
  categoryId?: string | null;
  itemType: GradeItemType;
  itemModule?: string | null;
  itemInstance?: string | null;
  name: string;
  gradeType: GradeType;
  scaleId?: string | null;
  grademax: number;
  grademin: number;
  gradepass?: number | null;
  weight: number;
  multiplicator: number;
  offset: number;
  hidden: boolean;
  locked: boolean;
  sortOrder: number;
  decimals: number;
}

export interface GradeCategoryDto {
  id: string;
  courseId: string;
  parentId: string | null;
  name: string;
  aggregation: GradeAggregation;
  aggregateOnlyGraded: boolean;
  dropLowest: number;
  keepHighest: number;
  depth: number;
  path: string;
  gradeItemId?: string | null;
}

export interface GradeDto {
  id: string;
  gradeItemId: string;
  userId: string;
  rawGrade?: number | null;
  finalGrade?: number | null;
  percentage?: number | null;
  letter?: string | null;
  feedback?: string | null;
  hidden: boolean;
  locked: boolean;
  excluded: boolean;
  overridden: boolean;
  graderId?: string | null;
  gradedAt?: string | null;
}

export interface GradeScaleDto {
  id: string;
  name: string;
  items: string[];
  description?: string | null;
  courseId?: string | null;
}

export interface GradeLetterDto {
  id: string;
  contextId: string;
  letter: string;
  lowerBoundary: number;
}

/** Fila del informe del calificador. */
export interface GraderReportRow {
  user: { id: string; fullName: string; email: string; avatarUrl: string | null };
  grades: Record<string, { grade: number | null; percentage: number | null; letter: string | null }>;
  courseTotal: { grade: number | null; percentage: number | null; letter: string | null };
}

export interface GraderReport {
  items: GradeItemDto[];
  rows: GraderReportRow[];
  total: number;
}

/** Informe de calificaciones de un alumno. */
export interface UserGradeReport {
  courseId: string;
  courseName: string;
  items: (GradeItemDto & {
    grade: number | null;
    percentage: number | null;
    letter: string | null;
    feedback: string | null;
    rangeLabel: string;
    weightLabel: string;
  })[];
  courseTotal: { grade: number | null; percentage: number | null; letter: string | null };
}
