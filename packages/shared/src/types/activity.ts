import {
  ForumSubscriptionMode,
  ForumType,
  GradeType,
  QuestionType,
  QuizAttemptState,
  QuizGradeMethod,
  SubmissionStatus,
} from '../enums';

/* ------------------------------- Tarea ----------------------------------- */

export interface AssignDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  allowSubmissionsFrom?: string | null;
  dueDate?: string | null;
  cutOffDate?: string | null;
  gradingDueDate?: string | null;
  maxGrade: number;
  gradeType: GradeType;
  submissionTypes: ('online' | 'file' | 'url')[];
  maxFiles: number;
  maxFileSize: number;
  allowedFileTypes: string[];
  blindMarking: boolean;
  teamSubmission: boolean;
  requireSubmissionStatement: boolean;
  submissionStatement?: string | null;
  attemptReopenMethod: 'none' | 'manual' | 'untilpass';
  maxAttempts: number;
  latePolicy: 'allow' | 'block' | 'penalise';
  latePenaltyPercentPerDay: number;
  attachments: FileRef[];
}

export interface AssignSubmissionDto {
  id: string;
  assignId: string;
  userId: string;
  user?: { id: string; fullName: string; avatarUrl: string | null };
  groupId?: string | null;
  attempt: number;
  status: SubmissionStatus;
  onlineText?: string | null;
  url?: string | null;
  files: FileRef[];
  submittedAt?: string | null;
  late: boolean;
  grade?: number | null;
  gradedAt?: string | null;
  graderId?: string | null;
  feedbackText?: string | null;
  feedbackFiles: FileRef[];
  extensionDueDate?: string | null;
}

/* --------------------------- Banco de preguntas --------------------------- */

export interface QuestionAnswerDto {
  id: string;
  text: string;
  fraction: number;
  feedback?: string | null;
}

export interface QuestionDto {
  id: string;
  categoryId: string;
  courseId?: string | null;
  type: QuestionType;
  name: string;
  questionText: string;
  generalFeedback?: string | null;
  defaultMark: number;
  penalty: number;
  shuffleAnswers: boolean;
  single: boolean;
  answers: QuestionAnswerDto[];
  /** Emparejamiento: pares pregunta/respuesta. */
  subquestions?: { text: string; answer: string }[];
  tolerance?: number;
  tags: string[];
}

export interface QuestionCategoryDto {
  id: string;
  name: string;
  parentId: string | null;
  contextId: string;
  description?: string | null;
  questionCount: number;
}

/* ----------------------------- Cuestionario ------------------------------- */

export interface QuizDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  timeOpen?: string | null;
  timeClose?: string | null;
  timeLimitSeconds: number;
  attemptsAllowed: number;
  gradeMethod: QuizGradeMethod;
  maxGrade: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  questionsPerPage: number;
  navMethod: 'free' | 'sequential';
  reviewAfterClose: boolean;
  showCorrectAnswers: boolean;
  passingGrade?: number | null;
  questions: QuizQuestionRef[];
  totalMarks: number;
}

export interface QuizQuestionRef {
  questionId: string;
  slot: number;
  page: number;
  maxMark: number;
  question?: QuestionDto;
}

export interface QuizAttemptDto {
  id: string;
  quizId: string;
  userId: string;
  attempt: number;
  state: QuizAttemptState;
  startedAt: string;
  finishedAt?: string | null;
  dueAt?: string | null;
  sumGrades?: number | null;
  grade?: number | null;
  responses: QuizResponseDto[];
  layout: string[];
}

export interface QuizResponseDto {
  questionId: string;
  answer: unknown;
  mark?: number | null;
  maxMark: number;
  correct?: boolean | null;
  feedback?: string | null;
  needsManualGrading?: boolean;
}

/* --------------------------------- Foro ----------------------------------- */

export interface ForumDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  type: ForumType;
  subscriptionMode: ForumSubscriptionMode;
  maxAttachments: number;
  maxBytes: number;
  allowRating: boolean;
  blockAfter: number;
  blockPeriodSeconds: number;
  discussionCount: number;
}

export interface DiscussionDto {
  id: string;
  forumId: string;
  name: string;
  userId: string;
  author?: { id: string; fullName: string; avatarUrl: string | null };
  groupId?: string | null;
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  lastPostAt?: string | null;
  createdAt: string;
  firstPost?: PostDto;
}

export interface PostDto {
  id: string;
  discussionId: string;
  parentId: string | null;
  userId: string;
  author?: { id: string; fullName: string; avatarUrl: string | null };
  subject: string;
  message: string;
  attachments: FileRef[];
  rating?: number | null;
  ratingCount?: number;
  edited: boolean;
  createdAt: string;
  updatedAt: string;
  children?: PostDto[];
}

/* --------------------------- Consulta / Encuesta -------------------------- */

export interface ChoiceDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  allowMultiple: boolean;
  allowUpdate: boolean;
  limitAnswers: boolean;
  showResults: 'always' | 'afteranswer' | 'afterclose' | 'never';
  publishAnonymous: boolean;
  timeOpen?: string | null;
  timeClose?: string | null;
  options: { id: string; text: string; maxAnswers: number; count?: number }[];
}

export interface FeedbackDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  anonymous: boolean;
  multipleSubmit: boolean;
  timeOpen?: string | null;
  timeClose?: string | null;
  items: FeedbackItemDto[];
  responseCount: number;
}

export interface FeedbackItemDto {
  id: string;
  type: 'textfield' | 'textarea' | 'multichoice' | 'numeric' | 'info' | 'label';
  label: string;
  required: boolean;
  position: number;
  options?: string[];
}

/* ------------------------------- Recursos --------------------------------- */

export interface FileRef {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string | null;
  createdAt?: string;
}

export interface PageResourceDto {
  id: string;
  courseId: string;
  name: string;
  content: string;
  intro?: string | null;
}

export interface UrlResourceDto {
  id: string;
  courseId: string;
  name: string;
  externalUrl: string;
  intro?: string | null;
  display: 'auto' | 'embed' | 'new' | 'open';
}

export interface FileResourceDto {
  id: string;
  courseId: string;
  name: string;
  intro?: string | null;
  files: FileRef[];
  display: 'auto' | 'embed' | 'download';
}

export interface BookChapterDto {
  id: string;
  bookId: string;
  title: string;
  content: string;
  subChapter: boolean;
  hidden: boolean;
  sortOrder: number;
}
