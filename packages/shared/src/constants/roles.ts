import { CAP } from './capabilities';
import { ContextLevel, PermissionValue, RoleArchetype } from '../enums';

/* -------------------------------------------------------------------------- */
/*  Roles predefinidos — Maya Classroom                                        */
/*  Cada arquetipo declara el conjunto de capacidades que se le concede por     */
/*  defecto y los niveles de contexto donde puede asignarse.                   */
/* -------------------------------------------------------------------------- */

export interface RolePreset {
  readonly archetype: RoleArchetype;
  readonly shortName: string;
  readonly name: string;
  readonly description: string;
  /** Niveles de contexto donde el rol puede asignarse. */
  readonly assignableAt: readonly ContextLevel[];
  /** Orden de presentación. */
  readonly sortOrder: number;
  /** Capacidades concedidas (ALLOW). */
  readonly allow: readonly string[];
  /** Capacidades explícitamente denegadas (PREVENT). */
  readonly prevent?: readonly string[];
}

/** Capacidades que todo usuario autenticado posee. */
const AUTHENTICATED: readonly string[] = [
  CAP.USER_EDIT_OWN_PROFILE,
  CAP.USER_CHANGE_OWN_PASSWORD,
  CAP.USER_MANAGE_OWN_FILES,
  CAP.FILE_UPLOAD,
  CAP.MESSAGE_SEND,
  CAP.CALENDAR_MANAGE_OWN,
  CAP.BADGE_EARN,
  CAP.GDPR_REQUEST_OWN,
  CAP.COMMENT_VIEW,
  CAP.COMPETENCY_PLAN_VIEW,
];

const STUDENT: readonly string[] = [
  CAP.COURSE_VIEW,
  CAP.COURSE_VIEW_PARTICIPANTS,
  CAP.COURSE_ISINCOMPLETIONREPORTS,
  CAP.USER_VIEW_DETAILS,
  CAP.GRADE_VIEW,
  CAP.ENROL_SELF_UNENROL,
  CAP.MOD_VIEW,
  CAP.ASSIGN_VIEW,
  CAP.ASSIGN_SUBMIT,
  CAP.QUIZ_VIEW,
  CAP.QUIZ_ATTEMPT,
  CAP.QUIZ_REVIEW_MY_ATTEMPTS,
  CAP.FORUM_VIEW_DISCUSSION,
  CAP.FORUM_START_DISCUSSION,
  CAP.FORUM_REPLY,
  CAP.FORUM_DELETE_OWN_POST,
  CAP.FORUM_RATE,
  CAP.CHOICE_CHOOSE,
  CAP.FEEDBACK_COMPLETE,
  CAP.GLOSSARY_WRITE,
  CAP.WIKI_EDIT_PAGE,
  CAP.WORKSHOP_SUBMIT,
  CAP.WORKSHOP_PEER_ASSESS,
  CAP.LESSON_VIEW,
  CAP.DATABASE_WRITE_ENTRY,
  CAP.COMMENT_POST,
  CAP.COMMENT_VIEW,
  CAP.RATING_RATE,
  CAP.BADGE_VIEW_AWARDED,
];

const NON_EDITING_TEACHER: readonly string[] = [
  ...STUDENT.filter(
    (c) => c !== CAP.ASSIGN_SUBMIT && c !== CAP.QUIZ_ATTEMPT && c !== CAP.WORKSHOP_SUBMIT,
  ),
  CAP.COURSE_VIEW_HIDDEN,
  CAP.COURSE_VIEW_HIDDEN_SECTIONS,
  CAP.COURSE_VIEW_HIDDEN_ACTIVITIES,
  CAP.COURSE_BULK_MESSAGING,
  CAP.COURSE_MARK_COMPLETE,
  CAP.USER_VIEW_ALL_DETAILS,
  CAP.GRADE_VIEW_ALL,
  CAP.GRADE_VIEW_HIDDEN,
  CAP.GRADE_EDIT,
  CAP.GRADE_EXPORT,
  CAP.ASSIGN_GRADE,
  CAP.ASSIGN_VIEW_GRADES,
  CAP.ASSIGN_GRANT_EXTENSION,
  CAP.QUIZ_GRADE,
  CAP.QUIZ_PREVIEW,
  CAP.QUIZ_VIEW_REPORTS,
  CAP.CHOICE_READ_RESPONSES,
  CAP.FEEDBACK_VIEW_REPORTS,
  CAP.GLOSSARY_APPROVE,
  CAP.FORUM_DELETE_ANY_POST,
  CAP.FORUM_EDIT_ANY_POST,
  CAP.FORUM_PIN_DISCUSSION,
  CAP.SCORM_VIEW_REPORT,
  CAP.H5P_VIEW_RESULTS,
  CAP.GROUP_VIEW_ALL,
  CAP.RATING_VIEW_ALL,
  CAP.COMMENT_DELETE,
  CAP.REPORT_VIEW_COURSE,
  CAP.REPORT_VIEW_LOGS,
  CAP.REPORT_VIEW_PARTICIPATION,
  CAP.REPORT_VIEW_COMPLETION,
  CAP.REPORT_VIEW_OUTLINE,
  CAP.BADGE_VIEW_AWARDED,
  CAP.COMPETENCY_VIEW,
  CAP.COMPETENCY_GRADE,
];

const EDITING_TEACHER: readonly string[] = [
  ...NON_EDITING_TEACHER,
  CAP.COURSE_UPDATE,
  CAP.COURSE_CHANGE_SUMMARY,
  CAP.COURSE_MANAGE_ACTIVITIES,
  CAP.COURSE_ACTIVITY_VISIBILITY,
  CAP.COURSE_MANAGE_FILES,
  CAP.COURSE_MANAGE_GROUPS,
  CAP.COURSE_RESET,
  CAP.COURSE_TAG,
  CAP.COURSE_IGNORE_AVAILABILITY,
  CAP.COURSE_IMPORT,
  CAP.ENROL_CONFIG,
  CAP.ENROL_ENROL_USERS,
  CAP.ENROL_UNENROL_USERS,
  CAP.ENROL_MANAGE,
  CAP.ENROL_SELF_CONFIG,
  CAP.GROUP_MANAGE,
  CAP.GRADE_MANAGE,
  CAP.GRADE_MANAGE_LETTERS,
  CAP.GRADE_MANAGE_OUTCOMES,
  CAP.GRADE_IMPORT,
  CAP.GRADE_HIDE,
  CAP.GRADE_LOCK,
  CAP.MOD_ADD_INSTANCE,
  CAP.ASSIGN_ADD_INSTANCE,
  CAP.ASSIGN_MANAGE_OVERRIDES,
  CAP.ASSIGN_REVEAL_IDENTITIES,
  CAP.QUIZ_ADD_INSTANCE,
  CAP.QUIZ_MANAGE,
  CAP.QUIZ_DELETE_ATTEMPTS,
  CAP.FORUM_ADD_INSTANCE,
  CAP.FORUM_MANAGE_SUBSCRIPTIONS,
  CAP.WIKI_MANAGE,
  CAP.WORKSHOP_MANAGE,
  CAP.LESSON_EDIT,
  CAP.DATABASE_MANAGE_ENTRIES,
  CAP.QUESTION_ADD,
  CAP.QUESTION_EDIT_ALL,
  CAP.QUESTION_VIEW_ALL,
  CAP.QUESTION_USE_ALL,
  CAP.QUESTION_MANAGE_CATEGORY,
  CAP.CALENDAR_MANAGE_COURSE,
  CAP.CALENDAR_MANAGE_GROUP,
  CAP.ROLE_ASSIGN,
  CAP.ROLE_REVIEW,
  CAP.ROLE_SAFE_OVERRIDE,
  CAP.BADGE_CREATE,
  CAP.BADGE_AWARD,
  CAP.BACKUP_COURSE,
  CAP.RESTORE_COURSE,
  CAP.BACKUP_DOWNLOAD,
];

const COURSE_CREATOR: readonly string[] = [
  CAP.COURSE_CREATE,
  CAP.COURSE_VIEW,
  CAP.COURSE_VIEW_HIDDEN,
  CAP.CATEGORY_VIEW_HIDDEN,
  CAP.RESTORE_COURSE,
  CAP.BACKUP_COURSE,
  CAP.ROLE_ASSIGN,
];

const MANAGER: readonly string[] = [
  ...EDITING_TEACHER,
  ...COURSE_CREATOR,
  CAP.TENANT_UPDATE,
  CAP.TENANT_MANAGE_BRANDING,
  CAP.TENANT_MANAGE_USERS,
  CAP.TENANT_VIEW_REPORTS,
  CAP.TENANT_MANAGE_WEBSERVICES,
  CAP.TENANT_MANAGE_POLICIES,
  CAP.SITE_MANAGE,
  CAP.SITE_MANAGE_REQUESTS,
  CAP.PAYMENT_MANAGE,
  CAP.ORDER_MANAGE,
  CAP.USER_CREATE,
  CAP.USER_UPDATE,
  CAP.USER_DELETE,
  CAP.USER_VIEW_ALL_DETAILS,
  CAP.USER_VIEW_HIDDEN_DETAILS,
  CAP.USER_LOGIN_AS,
  CAP.ROLE_MANAGE,
  CAP.ROLE_OVERRIDE,
  CAP.CATEGORY_CREATE,
  CAP.CATEGORY_UPDATE,
  CAP.CATEGORY_DELETE,
  CAP.CATEGORY_MANAGE,
  CAP.COURSE_DELETE,
  CAP.COHORT_VIEW,
  CAP.COHORT_MANAGE,
  CAP.COHORT_ASSIGN,
  CAP.COMPETENCY_MANAGE,
  CAP.COMPETENCY_PLAN_MANAGE,
  CAP.COMPETENCY_TEMPLATE_MANAGE,
  CAP.BADGE_MANAGE,
  CAP.CUSTOMFIELD_MANAGE,
  CAP.TAG_MANAGE,
  CAP.TAG_EDIT,
  CAP.FILE_VIEW_ALL,
  CAP.FILE_DELETE_ANY,
  CAP.MESSAGE_READ_ALL,
  CAP.NOTIFICATION_MANAGE,
  CAP.REPORT_BUILD,
  CAP.GDPR_MANAGE_REQUESTS,
];

const PLATFORM_ADMIN: readonly string[] = [
  ...MANAGER,
  CAP.SITE_CONFIG,
  CAP.SITE_MANAGE_TENANTS,
  CAP.SITE_VIEW_REPORTS,
  CAP.SITE_MANAGE_TASKS,
  CAP.SITE_VIEW_AUDIT,
];

const uniq = (list: readonly string[]): readonly string[] => Array.from(new Set(list));

export const ROLE_PRESETS: readonly RolePreset[] = [
  {
    archetype: RoleArchetype.PlatformAdmin,
    shortName: 'platformadmin',
    name: 'Administrador de plataforma',
    description:
      'Control total sobre Maya Classroom, incluidas todas las empresas, la configuración global y la auditoría.',
    assignableAt: [ContextLevel.System],
    sortOrder: 0,
    allow: uniq(PLATFORM_ADMIN),
  },
  {
    archetype: RoleArchetype.Manager,
    shortName: 'manager',
    name: 'Gestor',
    description:
      'Administra una empresa completa: usuarios, categorías, cursos, roles, cohortes e informes.',
    assignableAt: [ContextLevel.Tenant, ContextLevel.Category, ContextLevel.Course],
    sortOrder: 1,
    allow: uniq(MANAGER),
  },
  {
    archetype: RoleArchetype.CourseCreator,
    shortName: 'coursecreator',
    name: 'Creador de cursos',
    description: 'Puede crear cursos nuevos dentro de las categorías asignadas.',
    assignableAt: [ContextLevel.Tenant, ContextLevel.Category],
    sortOrder: 2,
    allow: uniq(COURSE_CREATOR),
  },
  {
    archetype: RoleArchetype.EditingTeacher,
    shortName: 'editingteacher',
    name: 'Profesor',
    description:
      'Puede editar el curso, añadir actividades, matricular, calificar y gestionar grupos.',
    assignableAt: [ContextLevel.Course, ContextLevel.Module, ContextLevel.Category],
    sortOrder: 3,
    allow: uniq(EDITING_TEACHER),
  },
  {
    archetype: RoleArchetype.Teacher,
    shortName: 'teacher',
    name: 'Profesor sin permiso de edición',
    description: 'Puede calificar y participar, pero no modificar la estructura del curso.',
    assignableAt: [ContextLevel.Course, ContextLevel.Module],
    sortOrder: 4,
    allow: uniq(NON_EDITING_TEACHER),
  },
  {
    archetype: RoleArchetype.Student,
    shortName: 'student',
    name: 'Estudiante',
    description: 'Participa en el curso: entrega tareas, hace cuestionarios y usa los foros.',
    assignableAt: [ContextLevel.Course, ContextLevel.Module],
    sortOrder: 5,
    allow: uniq(STUDENT),
  },
  {
    archetype: RoleArchetype.AuthenticatedUser,
    shortName: 'user',
    name: 'Usuario autenticado',
    description: 'Rol implícito de cualquier usuario con sesión iniciada.',
    assignableAt: [ContextLevel.System],
    sortOrder: 6,
    allow: uniq(AUTHENTICATED),
  },
  {
    archetype: RoleArchetype.Guest,
    shortName: 'guest',
    name: 'Invitado',
    description: 'Acceso de solo lectura a los cursos que permiten acceso de invitados.',
    assignableAt: [ContextLevel.Course],
    sortOrder: 7,
    allow: [CAP.COURSE_VIEW, CAP.MOD_VIEW, CAP.FORUM_VIEW_DISCUSSION, CAP.COMMENT_VIEW],
    prevent: [
      CAP.ASSIGN_SUBMIT,
      CAP.QUIZ_ATTEMPT,
      CAP.FORUM_START_DISCUSSION,
      CAP.FORUM_REPLY,
      CAP.COMMENT_POST,
    ],
  },
  {
    archetype: RoleArchetype.FrontPage,
    shortName: 'frontpage',
    name: 'Portada',
    description: 'Rol aplicado a los usuarios en la portada de la empresa.',
    assignableAt: [ContextLevel.Tenant],
    sortOrder: 8,
    allow: [CAP.COURSE_VIEW, CAP.FORUM_VIEW_DISCUSSION],
  },
];

/** Capacidades por defecto para un arquetipo, en formato mapa. */
export function presetPermissionMap(preset: RolePreset): Record<string, PermissionValue> {
  const map: Record<string, PermissionValue> = {};
  for (const c of preset.allow) map[c] = PermissionValue.Allow;
  for (const c of preset.prevent ?? []) map[c] = PermissionValue.Prevent;
  return map;
}

export const ROLE_PRESET_BY_ARCHETYPE = new Map(ROLE_PRESETS.map((r) => [r.archetype, r]));
