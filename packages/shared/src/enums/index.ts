/* -------------------------------------------------------------------------- */
/*  Enumeraciones de dominio — Maya Classroom                                  */
/*  Replican la semántica de Moodle adaptada a un modelo multiempresa.         */
/* -------------------------------------------------------------------------- */

/** Niveles de contexto jerárquico (equivalente a CONTEXT_* de Moodle). */
export enum ContextLevel {
  System = 'system',
  Tenant = 'tenant',
  Category = 'category',
  Course = 'course',
  Module = 'module',
  Block = 'block',
  User = 'user',
}

/** Profundidad nominal de cada nivel de contexto. */
export const CONTEXT_DEPTH: Record<ContextLevel, number> = {
  [ContextLevel.System]: 0,
  [ContextLevel.Tenant]: 1,
  [ContextLevel.Category]: 2,
  [ContextLevel.Course]: 3,
  [ContextLevel.Module]: 4,
  [ContextLevel.Block]: 5,
  [ContextLevel.User]: 2,
};

/**
 * Valores de permiso de Moodle. Precedencia: PROHIBIT gana siempre; si no,
 * el valor definido en el contexto más profundo.
 */
export enum PermissionValue {
  NotSet = 0,
  Allow = 1,
  Prevent = -1,
  Prohibit = -1000,
}

/** Arquetipos de rol del sistema. */
export enum RoleArchetype {
  PlatformAdmin = 'platformadmin',
  Manager = 'manager',
  CourseCreator = 'coursecreator',
  EditingTeacher = 'editingteacher',
  Teacher = 'teacher',
  Student = 'student',
  Guest = 'guest',
  AuthenticatedUser = 'user',
  FrontPage = 'frontpage',
}

export enum UserStatus {
  Active = 'active',
  Pending = 'pending',
  Suspended = 'suspended',
  Deleted = 'deleted',
}

export enum TenantStatus {
  Active = 'active',
  Trial = 'trial',
  Suspended = 'suspended',
  Archived = 'archived',
}

export enum TenantPlan {
  Free = 'free',
  Starter = 'starter',
  Business = 'business',
  Enterprise = 'enterprise',
}

export enum AuthProvider {
  Local = 'local',
  Google = 'google',
  Microsoft = 'microsoft',
  Saml = 'saml',
  Ldap = 'ldap',
}

/** Formatos de curso (course formats de Moodle). */
export enum CourseFormat {
  Topics = 'topics',
  Weekly = 'weekly',
  SingleActivity = 'singleactivity',
  Social = 'social',
}

export enum CourseVisibility {
  Visible = 'visible',
  Hidden = 'hidden',
}

/** Modo de grupo de un curso o actividad. */
export enum GroupMode {
  NoGroups = 0,
  SeparateGroups = 1,
  VisibleGroups = 2,
}

/** Tipos de módulo de curso (actividades y recursos). */
export enum ModuleType {
  Assign = 'assign',
  Quiz = 'quiz',
  Forum = 'forum',
  Choice = 'choice',
  Feedback = 'feedback',
  Lesson = 'lesson',
  Glossary = 'glossary',
  Wiki = 'wiki',
  Workshop = 'workshop',
  Database = 'data',
  Chat = 'chat',
  Scorm = 'scorm',
  Lti = 'lti',
  H5p = 'h5pactivity',
  Survey = 'survey',
  Attendance = 'attendance',
  Resource = 'resource',
  Folder = 'folder',
  Page = 'page',
  Url = 'url',
  Book = 'book',
  Label = 'label',
}

/** Módulos considerados «recursos» (no calificables por defecto). */
export const RESOURCE_MODULES: ModuleType[] = [
  ModuleType.Resource,
  ModuleType.Folder,
  ModuleType.Page,
  ModuleType.Url,
  ModuleType.Book,
  ModuleType.Label,
];

export enum CompletionTracking {
  None = 0,
  Manual = 1,
  Automatic = 2,
}

export enum CompletionState {
  Incomplete = 0,
  Complete = 1,
  CompletePass = 2,
  CompleteFail = 3,
}

/** Operadores del árbol de restricción de acceso. */
export enum AvailabilityOperator {
  And = '&',
  Or = '|',
  NotAnd = '!&',
  NotOr = '!|',
}

export enum AvailabilityConditionType {
  Date = 'date',
  Grade = 'grade',
  Completion = 'completion',
  Group = 'group',
  Grouping = 'grouping',
  Profile = 'profile',
  Role = 'role',
}

export enum EnrolmentMethod {
  Manual = 'manual',
  Self = 'self',
  Guest = 'guest',
  Cohort = 'cohort',
  Invitation = 'invitation',
}

export enum EnrolmentStatus {
  Active = 'active',
  Suspended = 'suspended',
}

/** Métodos de agregación del libro de calificaciones. */
export enum GradeAggregation {
  Mean = 'mean',
  WeightedMean = 'weightedmean',
  SimpleWeightedMean = 'simpleweightedmean',
  Natural = 'natural',
  Median = 'median',
  Min = 'min',
  Max = 'max',
  Mode = 'mode',
  Sum = 'sum',
}

export enum GradeType {
  None = 'none',
  Value = 'value',
  Scale = 'scale',
  Text = 'text',
}

export enum GradeItemType {
  Course = 'course',
  Category = 'category',
  Module = 'mod',
  Manual = 'manual',
}

export enum SubmissionStatus {
  New = 'new',
  Draft = 'draft',
  Submitted = 'submitted',
  Reopened = 'reopened',
  Graded = 'graded',
}

export enum QuestionType {
  MultiChoice = 'multichoice',
  TrueFalse = 'truefalse',
  ShortAnswer = 'shortanswer',
  Numerical = 'numerical',
  Matching = 'match',
  Essay = 'essay',
  Cloze = 'multianswer',
  DragDropText = 'ddwtos',
  Ordering = 'ordering',
  Description = 'description',
}

export enum QuizAttemptState {
  InProgress = 'inprogress',
  Overdue = 'overdue',
  Finished = 'finished',
  Abandoned = 'abandoned',
}

export enum QuizGradeMethod {
  Highest = 'highest',
  Average = 'average',
  First = 'first',
  Last = 'last',
}

export enum ForumType {
  General = 'general',
  EachUser = 'eachuser',
  SingleDiscussion = 'single',
  QAndA = 'qanda',
  BlogLike = 'blog',
}

export enum ForumSubscriptionMode {
  Optional = 'optional',
  Forced = 'forced',
  Auto = 'auto',
  Disabled = 'disabled',
}

export enum CalendarEventType {
  Site = 'site',
  Tenant = 'tenant',
  Category = 'category',
  Course = 'course',
  Group = 'group',
  User = 'user',
}

export enum NotificationChannel {
  Web = 'web',
  Email = 'email',
  Push = 'push',
}

export enum NotificationStatus {
  Unread = 'unread',
  Read = 'read',
}

export enum MessageConversationType {
  Individual = 'individual',
  Group = 'group',
}

export enum BadgeType {
  Site = 'site',
  Course = 'course',
}

export enum BadgeStatus {
  Draft = 'draft',
  Active = 'active',
  Archived = 'archived',
}

export enum BadgeCriteriaType {
  Manual = 'manual',
  ActivityCompletion = 'activity',
  CourseCompletion = 'course',
  Grade = 'grade',
  Competency = 'competency',
}

export enum CompetencyProficiency {
  NotRated = 'notrated',
  InProgress = 'inprogress',
  Proficient = 'proficient',
}

export enum LearningPlanStatus {
  Draft = 'draft',
  Active = 'active',
  Complete = 'complete',
}

export enum FileStorageDriver {
  Local = 'local',
  S3 = 's3',
}

export enum CustomFieldType {
  Text = 'text',
  Textarea = 'textarea',
  Checkbox = 'checkbox',
  Select = 'select',
  Date = 'date',
  Number = 'number',
  Url = 'url',
}

export enum CustomFieldScope {
  User = 'user',
  Course = 'course',
  Category = 'category',
}

export enum LogAction {
  Created = 'created',
  Updated = 'updated',
  Deleted = 'deleted',
  Viewed = 'viewed',
  Submitted = 'submitted',
  Graded = 'graded',
  Enrolled = 'enrolled',
  Unenrolled = 'unenrolled',
  LoggedIn = 'loggedin',
  LoggedOut = 'loggedout',
  Failed = 'failed',
}

export enum ScheduledTaskStatus {
  Idle = 'idle',
  Running = 'running',
  Failed = 'failed',
}
