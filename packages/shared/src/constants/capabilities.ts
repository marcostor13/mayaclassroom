import { ContextLevel } from '../enums';

/* -------------------------------------------------------------------------- */
/*  Catálogo de capacidades — Maya Classroom                                   */
/*                                                                            */
/*  Réplica del modelo de capacidades de Moodle: cada permiso es atómico,      */
/*  tiene un nivel de contexto mínimo donde puede asignarse y un nivel de      */
/*  riesgo informativo.                                                       */
/* -------------------------------------------------------------------------- */

export enum RiskLevel {
  /** Puede enviar spam o contenido a otros usuarios. */
  Spam = 'spam',
  /** Puede ver datos personales de otros usuarios. */
  PersonalData = 'personal',
  /** Puede publicar HTML/XSS. */
  Xss = 'xss',
  /** Puede modificar la configuración del sitio. */
  Config = 'config',
  /** Puede gestionar cuentas de usuario. */
  ManageTrust = 'managetrust',
  /** Sin riesgo destacable. */
  None = 'none',
}

export interface CapabilityDefinition {
  /** Nombre jerárquico, p. ej. `moodle/course:update`. */
  readonly name: string;
  /** Descripción legible en español. */
  readonly title: string;
  /** Nivel de contexto mínimo en el que la capacidad tiene sentido. */
  readonly contextLevel: ContextLevel;
  readonly risk: RiskLevel;
  /** Componente que la declara (`core`, `mod/quiz`, …). */
  readonly component: string;
}

const cap = (
  name: string,
  title: string,
  contextLevel: ContextLevel,
  component = 'core',
  risk: RiskLevel = RiskLevel.None,
): CapabilityDefinition => ({ name, title, contextLevel, component, risk });

/** Constantes de capacidad, tipadas, para usarlas en guards y decoradores. */
export const CAP = {
  // --- Sitio / plataforma --------------------------------------------------
  SITE_CONFIG: 'maya/site:config',
  SITE_MANAGE_TENANTS: 'maya/site:managetenants',
  SITE_VIEW_REPORTS: 'maya/site:viewreports',
  SITE_MANAGE_TASKS: 'maya/site:managetasks',
  SITE_VIEW_AUDIT: 'maya/site:viewaudit',

  // --- Empresa (tenant) ----------------------------------------------------
  TENANT_UPDATE: 'maya/tenant:update',
  TENANT_MANAGE_BRANDING: 'maya/tenant:managebranding',
  TENANT_MANAGE_USERS: 'maya/tenant:manageusers',
  TENANT_VIEW_REPORTS: 'maya/tenant:viewreports',
  TENANT_MANAGE_WEBSERVICES: 'maya/tenant:managewebservices',
  TENANT_MANAGE_POLICIES: 'maya/tenant:managepolicies',

  // --- Usuarios ------------------------------------------------------------
  USER_CREATE: 'moodle/user:create',
  USER_UPDATE: 'moodle/user:update',
  USER_DELETE: 'moodle/user:delete',
  USER_VIEW_DETAILS: 'moodle/user:viewdetails',
  USER_VIEW_ALL_DETAILS: 'moodle/user:viewalldetails',
  USER_VIEW_HIDDEN_DETAILS: 'moodle/user:viewhiddendetails',
  USER_EDIT_OWN_PROFILE: 'moodle/user:editownprofile',
  USER_CHANGE_OWN_PASSWORD: 'moodle/user:changeownpassword',
  USER_LOGIN_AS: 'moodle/user:loginas',
  USER_MANAGE_OWN_FILES: 'moodle/user:manageownfiles',

  // --- Roles ---------------------------------------------------------------
  ROLE_MANAGE: 'moodle/role:manage',
  ROLE_ASSIGN: 'moodle/role:assign',
  ROLE_OVERRIDE: 'moodle/role:override',
  ROLE_REVIEW: 'moodle/role:review',
  ROLE_SAFE_OVERRIDE: 'moodle/role:safeoverride',

  // --- Categorías ----------------------------------------------------------
  CATEGORY_CREATE: 'moodle/category:create',
  CATEGORY_UPDATE: 'moodle/category:update',
  CATEGORY_DELETE: 'moodle/category:delete',
  CATEGORY_MANAGE: 'moodle/category:manage',
  CATEGORY_VIEW_HIDDEN: 'moodle/category:viewhiddencategories',

  // --- Cursos --------------------------------------------------------------
  COURSE_CREATE: 'moodle/course:create',
  COURSE_UPDATE: 'moodle/course:update',
  COURSE_DELETE: 'moodle/course:delete',
  COURSE_VIEW: 'moodle/course:view',
  COURSE_VIEW_HIDDEN: 'moodle/course:viewhiddencourses',
  COURSE_VIEW_PARTICIPANTS: 'moodle/course:viewparticipants',
  COURSE_MANAGE_ACTIVITIES: 'moodle/course:manageactivities',
  COURSE_ACTIVITY_VISIBILITY: 'moodle/course:activityvisibility',
  COURSE_MANAGE_FILES: 'moodle/course:managefiles',
  COURSE_MANAGE_GROUPS: 'moodle/course:managegroups',
  COURSE_CHANGE_SUMMARY: 'moodle/course:changesummary',
  COURSE_VIEW_HIDDEN_SECTIONS: 'moodle/course:viewhiddensections',
  COURSE_VIEW_HIDDEN_ACTIVITIES: 'moodle/course:viewhiddenactivities',
  COURSE_RESET: 'moodle/course:reset',
  COURSE_TAG: 'moodle/course:tag',
  COURSE_BULK_MESSAGING: 'moodle/course:bulkmessaging',
  COURSE_MARK_COMPLETE: 'moodle/course:markcomplete',
  COURSE_IGNORE_AVAILABILITY: 'moodle/course:ignoreavailabilityrestrictions',
  COURSE_ISINCOMPLETIONREPORTS: 'moodle/course:isincompletionreports',

  // --- Matriculación -------------------------------------------------------
  ENROL_CONFIG: 'moodle/course:enrolconfig',
  ENROL_ENROL_USERS: 'enrol/manual:enrol',
  ENROL_UNENROL_USERS: 'enrol/manual:unenrol',
  ENROL_MANAGE: 'enrol/manual:manage',
  ENROL_SELF_UNENROL: 'enrol/self:unenrolself',
  ENROL_SELF_CONFIG: 'enrol/self:config',
  ENROL_COHORT_CONFIG: 'enrol/cohort:config',

  // --- Grupos --------------------------------------------------------------
  GROUP_MANAGE: 'moodle/group:manage',
  GROUP_VIEW_ALL: 'moodle/site:accessallgroups',

  // --- Calificaciones ------------------------------------------------------
  GRADE_VIEW_ALL: 'moodle/grade:viewall',
  GRADE_VIEW: 'moodle/grade:view',
  GRADE_VIEW_HIDDEN: 'moodle/grade:viewhidden',
  GRADE_MANAGE: 'moodle/grade:manage',
  GRADE_EDIT: 'moodle/grade:edit',
  GRADE_MANAGE_LETTERS: 'moodle/grade:manageletters',
  GRADE_EXPORT: 'moodle/grade:export',
  GRADE_IMPORT: 'moodle/grade:import',
  GRADE_MANAGE_OUTCOMES: 'moodle/grade:manageoutcomes',
  GRADE_HIDE: 'moodle/grade:hide',
  GRADE_LOCK: 'moodle/grade:lock',

  // --- Actividades: comunes ------------------------------------------------
  MOD_VIEW: 'mod/common:view',
  MOD_ADD_INSTANCE: 'mod/common:addinstance',

  // --- Tarea ---------------------------------------------------------------
  ASSIGN_ADD_INSTANCE: 'mod/assign:addinstance',
  ASSIGN_SUBMIT: 'mod/assign:submit',
  ASSIGN_VIEW: 'mod/assign:view',
  ASSIGN_GRADE: 'mod/assign:grade',
  ASSIGN_VIEW_GRADES: 'mod/assign:viewgrades',
  ASSIGN_GRANT_EXTENSION: 'mod/assign:grantextension',
  ASSIGN_MANAGE_OVERRIDES: 'mod/assign:manageoverrides',
  ASSIGN_REVEAL_IDENTITIES: 'mod/assign:revealidentities',

  // --- Cuestionario --------------------------------------------------------
  QUIZ_ADD_INSTANCE: 'mod/quiz:addinstance',
  QUIZ_ATTEMPT: 'mod/quiz:attempt',
  QUIZ_VIEW: 'mod/quiz:view',
  QUIZ_MANAGE: 'mod/quiz:manage',
  QUIZ_GRADE: 'mod/quiz:grade',
  QUIZ_PREVIEW: 'mod/quiz:preview',
  QUIZ_REVIEW_MY_ATTEMPTS: 'mod/quiz:reviewmyattempts',
  QUIZ_VIEW_REPORTS: 'mod/quiz:viewreports',
  QUIZ_DELETE_ATTEMPTS: 'mod/quiz:deleteattempts',

  // --- Banco de preguntas --------------------------------------------------
  QUESTION_ADD: 'moodle/question:add',
  QUESTION_EDIT_ALL: 'moodle/question:editall',
  QUESTION_VIEW_ALL: 'moodle/question:viewall',
  QUESTION_USE_ALL: 'moodle/question:useall',
  QUESTION_MANAGE_CATEGORY: 'moodle/question:managecategory',

  // --- Foro ----------------------------------------------------------------
  FORUM_ADD_INSTANCE: 'mod/forum:addinstance',
  FORUM_VIEW_DISCUSSION: 'mod/forum:viewdiscussion',
  FORUM_START_DISCUSSION: 'mod/forum:startdiscussion',
  FORUM_REPLY: 'mod/forum:replypost',
  FORUM_DELETE_OWN_POST: 'mod/forum:deleteownpost',
  FORUM_DELETE_ANY_POST: 'mod/forum:deleteanypost',
  FORUM_EDIT_ANY_POST: 'mod/forum:editanypost',
  FORUM_PIN_DISCUSSION: 'mod/forum:pindiscussions',
  FORUM_MANAGE_SUBSCRIPTIONS: 'mod/forum:managesubscriptions',
  FORUM_RATE: 'mod/forum:rate',

  // --- Otros módulos -------------------------------------------------------
  CHOICE_CHOOSE: 'mod/choice:choose',
  CHOICE_READ_RESPONSES: 'mod/choice:readresponses',
  FEEDBACK_COMPLETE: 'mod/feedback:complete',
  FEEDBACK_VIEW_REPORTS: 'mod/feedback:viewreports',
  GLOSSARY_WRITE: 'mod/glossary:write',
  GLOSSARY_APPROVE: 'mod/glossary:approve',
  WIKI_EDIT_PAGE: 'mod/wiki:editpage',
  WIKI_MANAGE: 'mod/wiki:managewiki',
  WORKSHOP_SUBMIT: 'mod/workshop:submit',
  WORKSHOP_PEER_ASSESS: 'mod/workshop:peerassess',
  WORKSHOP_MANAGE: 'mod/workshop:manage',
  LESSON_VIEW: 'mod/lesson:view',
  LESSON_EDIT: 'mod/lesson:edit',
  DATABASE_WRITE_ENTRY: 'mod/data:writeentry',
  DATABASE_MANAGE_ENTRIES: 'mod/data:manageentries',
  SCORM_VIEW_REPORT: 'mod/scorm:viewreport',
  H5P_VIEW_RESULTS: 'mod/h5pactivity:reviewattempts',

  // --- Ficheros ------------------------------------------------------------
  FILE_UPLOAD: 'maya/file:upload',
  FILE_DELETE_ANY: 'maya/file:deleteany',
  FILE_VIEW_ALL: 'maya/file:viewall',

  // --- Comunicación --------------------------------------------------------
  MESSAGE_SEND: 'moodle/site:sendmessage',
  MESSAGE_READ_ALL: 'moodle/site:readallmessages',
  NOTIFICATION_MANAGE: 'maya/notification:manage',
  CALENDAR_MANAGE_OWN: 'moodle/calendar:manageownentries',
  CALENDAR_MANAGE_GROUP: 'moodle/calendar:managegroupentries',
  CALENDAR_MANAGE_COURSE: 'moodle/calendar:manageentries',

  // --- Informes ------------------------------------------------------------
  REPORT_VIEW_COURSE: 'moodle/site:viewreports',
  REPORT_VIEW_LOGS: 'report/log:view',
  REPORT_VIEW_PARTICIPATION: 'report/participation:view',
  REPORT_VIEW_COMPLETION: 'report/completion:view',
  REPORT_VIEW_OUTLINE: 'report/outline:view',
  REPORT_BUILD: 'maya/report:build',

  // --- Cohortes ------------------------------------------------------------
  COHORT_VIEW: 'moodle/cohort:view',
  COHORT_MANAGE: 'moodle/cohort:manage',
  COHORT_ASSIGN: 'moodle/cohort:assign',

  // --- Competencias --------------------------------------------------------
  COMPETENCY_MANAGE: 'moodle/competency:competencymanage',
  COMPETENCY_VIEW: 'moodle/competency:competencyview',
  COMPETENCY_GRADE: 'moodle/competency:competencygrade',
  COMPETENCY_PLAN_MANAGE: 'moodle/competency:planmanage',
  COMPETENCY_PLAN_VIEW: 'moodle/competency:planview',
  COMPETENCY_TEMPLATE_MANAGE: 'moodle/competency:templatemanage',

  // --- Insignias -----------------------------------------------------------
  BADGE_MANAGE: 'moodle/badges:manageglobalsettings',
  BADGE_CREATE: 'moodle/badges:createbadge',
  BADGE_AWARD: 'moodle/badges:awardbadge',
  BADGE_VIEW_AWARDED: 'moodle/badges:viewawarded',
  BADGE_EARN: 'moodle/badges:earnbadge',

  // --- Copias de seguridad -------------------------------------------------
  BACKUP_COURSE: 'moodle/backup:backupcourse',
  RESTORE_COURSE: 'moodle/restore:restorecourse',
  BACKUP_DOWNLOAD: 'moodle/backup:downloadfile',
  COURSE_IMPORT: 'moodle/restore:restoretargetimport',

  // --- Etiquetas / comentarios / valoraciones ------------------------------
  TAG_MANAGE: 'moodle/tag:manage',
  TAG_EDIT: 'moodle/tag:edit',
  COMMENT_POST: 'moodle/comment:post',
  COMMENT_DELETE: 'moodle/comment:delete',
  COMMENT_VIEW: 'moodle/comment:view',
  RATING_RATE: 'moodle/rating:rate',
  RATING_VIEW_ALL: 'moodle/rating:viewall',

  // --- Campos personalizados / RGPD ---------------------------------------
  CUSTOMFIELD_MANAGE: 'maya/customfield:manage',
  GDPR_MANAGE_REQUESTS: 'tool/dataprivacy:managedatarequests',
  GDPR_REQUEST_OWN: 'tool/dataprivacy:requestdelete',
} as const;

export type CapabilityName = (typeof CAP)[keyof typeof CAP];

const L = ContextLevel;
const R = RiskLevel;

/** Definición completa del catálogo, usada por el seed y el editor de roles. */
export const CAPABILITY_CATALOG: readonly CapabilityDefinition[] = [
  // Sitio
  cap(CAP.SITE_CONFIG, 'Configurar la plataforma', L.System, 'core', R.Config),
  cap(CAP.SITE_MANAGE_TENANTS, 'Gestionar empresas', L.System, 'core', R.Config),
  cap(CAP.SITE_VIEW_REPORTS, 'Ver informes de plataforma', L.System, 'core', R.PersonalData),
  cap(CAP.SITE_MANAGE_TASKS, 'Gestionar tareas programadas', L.System, 'core', R.Config),
  cap(CAP.SITE_VIEW_AUDIT, 'Ver el registro de auditoría', L.System, 'core', R.PersonalData),

  // Empresa
  cap(CAP.TENANT_UPDATE, 'Editar la empresa', L.Tenant, 'core', R.Config),
  cap(CAP.TENANT_MANAGE_BRANDING, 'Gestionar la marca de la empresa', L.Tenant, 'core', R.Xss),
  cap(CAP.TENANT_MANAGE_USERS, 'Gestionar usuarios de la empresa', L.Tenant, 'core', R.ManageTrust),
  cap(CAP.TENANT_VIEW_REPORTS, 'Ver informes de la empresa', L.Tenant, 'core', R.PersonalData),
  cap(CAP.TENANT_MANAGE_WEBSERVICES, 'Gestionar servicios web', L.Tenant, 'core', R.Config),
  cap(CAP.TENANT_MANAGE_POLICIES, 'Gestionar políticas del sitio', L.Tenant, 'core', R.Config),

  // Usuarios
  cap(CAP.USER_CREATE, 'Crear usuarios', L.Tenant, 'core', R.ManageTrust),
  cap(CAP.USER_UPDATE, 'Editar usuarios', L.Tenant, 'core', R.ManageTrust),
  cap(CAP.USER_DELETE, 'Eliminar usuarios', L.Tenant, 'core', R.ManageTrust),
  cap(CAP.USER_VIEW_DETAILS, 'Ver el perfil de otros usuarios', L.Course),
  cap(CAP.USER_VIEW_ALL_DETAILS, 'Ver todos los datos de perfil', L.Tenant, 'core', R.PersonalData),
  cap(CAP.USER_VIEW_HIDDEN_DETAILS, 'Ver campos ocultos del perfil', L.Tenant, 'core', R.PersonalData),
  cap(CAP.USER_EDIT_OWN_PROFILE, 'Editar el perfil propio', L.System, 'core', R.Xss),
  cap(CAP.USER_CHANGE_OWN_PASSWORD, 'Cambiar la contraseña propia', L.System),
  cap(CAP.USER_LOGIN_AS, 'Entrar como otro usuario', L.Tenant, 'core', R.PersonalData),
  cap(CAP.USER_MANAGE_OWN_FILES, 'Gestionar ficheros privados propios', L.System),

  // Roles
  cap(CAP.ROLE_MANAGE, 'Crear y editar roles', L.Tenant, 'core', R.ManageTrust),
  cap(CAP.ROLE_ASSIGN, 'Asignar roles a usuarios', L.Course, 'core', R.ManageTrust),
  cap(CAP.ROLE_OVERRIDE, 'Anular permisos de roles', L.Course, 'core', R.ManageTrust),
  cap(CAP.ROLE_REVIEW, 'Revisar permisos', L.Course),
  cap(CAP.ROLE_SAFE_OVERRIDE, 'Anular permisos sin riesgo', L.Course),

  // Categorías
  cap(CAP.CATEGORY_CREATE, 'Crear categorías', L.Category),
  cap(CAP.CATEGORY_UPDATE, 'Editar categorías', L.Category),
  cap(CAP.CATEGORY_DELETE, 'Eliminar categorías', L.Category),
  cap(CAP.CATEGORY_MANAGE, 'Gestionar el árbol de categorías', L.Category),
  cap(CAP.CATEGORY_VIEW_HIDDEN, 'Ver categorías ocultas', L.Category),

  // Cursos
  cap(CAP.COURSE_CREATE, 'Crear cursos', L.Category),
  cap(CAP.COURSE_UPDATE, 'Editar la configuración del curso', L.Course),
  cap(CAP.COURSE_DELETE, 'Eliminar cursos', L.Course),
  cap(CAP.COURSE_VIEW, 'Acceder a cursos', L.Course),
  cap(CAP.COURSE_VIEW_HIDDEN, 'Ver cursos ocultos', L.Course),
  cap(CAP.COURSE_VIEW_PARTICIPANTS, 'Ver participantes', L.Course),
  cap(CAP.COURSE_MANAGE_ACTIVITIES, 'Gestionar actividades', L.Course),
  cap(CAP.COURSE_ACTIVITY_VISIBILITY, 'Mostrar u ocultar actividades', L.Course),
  cap(CAP.COURSE_MANAGE_FILES, 'Gestionar ficheros del curso', L.Course),
  cap(CAP.COURSE_MANAGE_GROUPS, 'Gestionar grupos', L.Course),
  cap(CAP.COURSE_CHANGE_SUMMARY, 'Editar el resumen del curso', L.Course, 'core', R.Xss),
  cap(CAP.COURSE_VIEW_HIDDEN_SECTIONS, 'Ver secciones ocultas', L.Course),
  cap(CAP.COURSE_VIEW_HIDDEN_ACTIVITIES, 'Ver actividades ocultas', L.Course),
  cap(CAP.COURSE_RESET, 'Reiniciar un curso', L.Course),
  cap(CAP.COURSE_TAG, 'Etiquetar cursos', L.Course),
  cap(CAP.COURSE_BULK_MESSAGING, 'Enviar mensajes masivos', L.Course, 'core', R.Spam),
  cap(CAP.COURSE_MARK_COMPLETE, 'Marcar la finalización de otros', L.Course),
  cap(CAP.COURSE_IGNORE_AVAILABILITY, 'Ignorar restricciones de acceso', L.Course),
  cap(CAP.COURSE_ISINCOMPLETIONREPORTS, 'Aparecer en informes de finalización', L.Course),

  // Matriculación
  cap(CAP.ENROL_CONFIG, 'Configurar métodos de matriculación', L.Course),
  cap(CAP.ENROL_ENROL_USERS, 'Matricular usuarios', L.Course),
  cap(CAP.ENROL_UNENROL_USERS, 'Desmatricular usuarios', L.Course),
  cap(CAP.ENROL_MANAGE, 'Gestionar matrículas manuales', L.Course),
  cap(CAP.ENROL_SELF_UNENROL, 'Desmatricularse a sí mismo', L.Course),
  cap(CAP.ENROL_SELF_CONFIG, 'Configurar la automatriculación', L.Course),
  cap(CAP.ENROL_COHORT_CONFIG, 'Configurar la matriculación por cohorte', L.Course),

  // Grupos
  cap(CAP.GROUP_MANAGE, 'Gestionar grupos y agrupamientos', L.Course),
  cap(CAP.GROUP_VIEW_ALL, 'Acceder a todos los grupos', L.Course),

  // Calificaciones
  cap(CAP.GRADE_VIEW_ALL, 'Ver todas las calificaciones', L.Course, 'core', R.PersonalData),
  cap(CAP.GRADE_VIEW, 'Ver las calificaciones propias', L.Course),
  cap(CAP.GRADE_VIEW_HIDDEN, 'Ver calificaciones ocultas', L.Course, 'core', R.PersonalData),
  cap(CAP.GRADE_MANAGE, 'Gestionar el libro de calificaciones', L.Course),
  cap(CAP.GRADE_EDIT, 'Editar calificaciones', L.Course),
  cap(CAP.GRADE_MANAGE_LETTERS, 'Gestionar letras de calificación', L.Course),
  cap(CAP.GRADE_EXPORT, 'Exportar calificaciones', L.Course, 'core', R.PersonalData),
  cap(CAP.GRADE_IMPORT, 'Importar calificaciones', L.Course),
  cap(CAP.GRADE_MANAGE_OUTCOMES, 'Gestionar resultados', L.Course),
  cap(CAP.GRADE_HIDE, 'Ocultar calificaciones', L.Course),
  cap(CAP.GRADE_LOCK, 'Bloquear calificaciones', L.Course),

  // Actividades comunes
  cap(CAP.MOD_VIEW, 'Ver actividades', L.Module),
  cap(CAP.MOD_ADD_INSTANCE, 'Añadir actividades', L.Course),

  // Tarea
  cap(CAP.ASSIGN_ADD_INSTANCE, 'Añadir una tarea', L.Course, 'mod/assign'),
  cap(CAP.ASSIGN_SUBMIT, 'Entregar una tarea', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_VIEW, 'Ver una tarea', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_GRADE, 'Calificar tareas', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_VIEW_GRADES, 'Ver las calificaciones de la tarea', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_GRANT_EXTENSION, 'Conceder prórrogas', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_MANAGE_OVERRIDES, 'Gestionar excepciones', L.Module, 'mod/assign'),
  cap(CAP.ASSIGN_REVEAL_IDENTITIES, 'Revelar identidades en entregas anónimas', L.Module, 'mod/assign', R.PersonalData),

  // Cuestionario
  cap(CAP.QUIZ_ADD_INSTANCE, 'Añadir un cuestionario', L.Course, 'mod/quiz'),
  cap(CAP.QUIZ_ATTEMPT, 'Intentar un cuestionario', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_VIEW, 'Ver un cuestionario', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_MANAGE, 'Gestionar un cuestionario', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_GRADE, 'Calificar manualmente', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_PREVIEW, 'Previsualizar un cuestionario', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_REVIEW_MY_ATTEMPTS, 'Revisar los intentos propios', L.Module, 'mod/quiz'),
  cap(CAP.QUIZ_VIEW_REPORTS, 'Ver informes del cuestionario', L.Module, 'mod/quiz', R.PersonalData),
  cap(CAP.QUIZ_DELETE_ATTEMPTS, 'Eliminar intentos', L.Module, 'mod/quiz'),

  // Banco de preguntas
  cap(CAP.QUESTION_ADD, 'Añadir preguntas', L.Course),
  cap(CAP.QUESTION_EDIT_ALL, 'Editar todas las preguntas', L.Course),
  cap(CAP.QUESTION_VIEW_ALL, 'Ver todas las preguntas', L.Course),
  cap(CAP.QUESTION_USE_ALL, 'Usar todas las preguntas', L.Course),
  cap(CAP.QUESTION_MANAGE_CATEGORY, 'Gestionar categorías de preguntas', L.Course),

  // Foro
  cap(CAP.FORUM_ADD_INSTANCE, 'Añadir un foro', L.Course, 'mod/forum'),
  cap(CAP.FORUM_VIEW_DISCUSSION, 'Ver debates', L.Module, 'mod/forum'),
  cap(CAP.FORUM_START_DISCUSSION, 'Iniciar debates', L.Module, 'mod/forum', R.Xss),
  cap(CAP.FORUM_REPLY, 'Responder en debates', L.Module, 'mod/forum', R.Xss),
  cap(CAP.FORUM_DELETE_OWN_POST, 'Eliminar mensajes propios', L.Module, 'mod/forum'),
  cap(CAP.FORUM_DELETE_ANY_POST, 'Eliminar cualquier mensaje', L.Module, 'mod/forum'),
  cap(CAP.FORUM_EDIT_ANY_POST, 'Editar cualquier mensaje', L.Module, 'mod/forum', R.Xss),
  cap(CAP.FORUM_PIN_DISCUSSION, 'Fijar debates', L.Module, 'mod/forum'),
  cap(CAP.FORUM_MANAGE_SUBSCRIPTIONS, 'Gestionar suscripciones', L.Module, 'mod/forum'),
  cap(CAP.FORUM_RATE, 'Valorar mensajes', L.Module, 'mod/forum'),

  // Otros módulos
  cap(CAP.CHOICE_CHOOSE, 'Responder una consulta', L.Module, 'mod/choice'),
  cap(CAP.CHOICE_READ_RESPONSES, 'Ver las respuestas de la consulta', L.Module, 'mod/choice'),
  cap(CAP.FEEDBACK_COMPLETE, 'Completar una encuesta', L.Module, 'mod/feedback'),
  cap(CAP.FEEDBACK_VIEW_REPORTS, 'Ver informes de la encuesta', L.Module, 'mod/feedback'),
  cap(CAP.GLOSSARY_WRITE, 'Crear entradas de glosario', L.Module, 'mod/glossary', R.Xss),
  cap(CAP.GLOSSARY_APPROVE, 'Aprobar entradas de glosario', L.Module, 'mod/glossary'),
  cap(CAP.WIKI_EDIT_PAGE, 'Editar páginas del wiki', L.Module, 'mod/wiki', R.Xss),
  cap(CAP.WIKI_MANAGE, 'Gestionar el wiki', L.Module, 'mod/wiki'),
  cap(CAP.WORKSHOP_SUBMIT, 'Entregar en el taller', L.Module, 'mod/workshop'),
  cap(CAP.WORKSHOP_PEER_ASSESS, 'Evaluar entre pares', L.Module, 'mod/workshop'),
  cap(CAP.WORKSHOP_MANAGE, 'Gestionar el taller', L.Module, 'mod/workshop'),
  cap(CAP.LESSON_VIEW, 'Ver una lección', L.Module, 'mod/lesson'),
  cap(CAP.LESSON_EDIT, 'Editar una lección', L.Module, 'mod/lesson'),
  cap(CAP.DATABASE_WRITE_ENTRY, 'Escribir entradas en la base de datos', L.Module, 'mod/data', R.Xss),
  cap(CAP.DATABASE_MANAGE_ENTRIES, 'Gestionar entradas de la base de datos', L.Module, 'mod/data'),
  cap(CAP.SCORM_VIEW_REPORT, 'Ver informes SCORM', L.Module, 'mod/scorm'),
  cap(CAP.H5P_VIEW_RESULTS, 'Revisar intentos H5P', L.Module, 'mod/h5pactivity'),

  // Ficheros
  cap(CAP.FILE_UPLOAD, 'Subir ficheros', L.System),
  cap(CAP.FILE_DELETE_ANY, 'Eliminar cualquier fichero', L.Tenant),
  cap(CAP.FILE_VIEW_ALL, 'Ver todos los ficheros', L.Tenant, 'core', R.PersonalData),

  // Comunicación
  cap(CAP.MESSAGE_SEND, 'Enviar mensajes', L.System, 'core', R.Spam),
  cap(CAP.MESSAGE_READ_ALL, 'Leer todos los mensajes', L.Tenant, 'core', R.PersonalData),
  cap(CAP.NOTIFICATION_MANAGE, 'Gestionar notificaciones', L.Tenant),
  cap(CAP.CALENDAR_MANAGE_OWN, 'Gestionar eventos propios', L.System),
  cap(CAP.CALENDAR_MANAGE_GROUP, 'Gestionar eventos de grupo', L.Course),
  cap(CAP.CALENDAR_MANAGE_COURSE, 'Gestionar eventos del curso', L.Course),

  // Informes
  cap(CAP.REPORT_VIEW_COURSE, 'Ver informes del curso', L.Course, 'core', R.PersonalData),
  cap(CAP.REPORT_VIEW_LOGS, 'Ver registros', L.Course, 'report/log', R.PersonalData),
  cap(CAP.REPORT_VIEW_PARTICIPATION, 'Ver participación', L.Course, 'report/participation', R.PersonalData),
  cap(CAP.REPORT_VIEW_COMPLETION, 'Ver finalización', L.Course, 'report/completion', R.PersonalData),
  cap(CAP.REPORT_VIEW_OUTLINE, 'Ver el informe de esquema', L.Course, 'report/outline', R.PersonalData),
  cap(CAP.REPORT_BUILD, 'Construir informes personalizados', L.Tenant, 'core', R.PersonalData),

  // Cohortes
  cap(CAP.COHORT_VIEW, 'Ver cohortes', L.Tenant),
  cap(CAP.COHORT_MANAGE, 'Gestionar cohortes', L.Tenant),
  cap(CAP.COHORT_ASSIGN, 'Asignar miembros a cohortes', L.Tenant),

  // Competencias
  cap(CAP.COMPETENCY_MANAGE, 'Gestionar competencias', L.Tenant),
  cap(CAP.COMPETENCY_VIEW, 'Ver competencias', L.Tenant),
  cap(CAP.COMPETENCY_GRADE, 'Calificar competencias', L.Course),
  cap(CAP.COMPETENCY_PLAN_MANAGE, 'Gestionar planes de aprendizaje', L.Tenant),
  cap(CAP.COMPETENCY_PLAN_VIEW, 'Ver planes de aprendizaje', L.User),
  cap(CAP.COMPETENCY_TEMPLATE_MANAGE, 'Gestionar plantillas de plan', L.Tenant),

  // Insignias
  cap(CAP.BADGE_MANAGE, 'Gestionar ajustes de insignias', L.Tenant),
  cap(CAP.BADGE_CREATE, 'Crear insignias', L.Course),
  cap(CAP.BADGE_AWARD, 'Otorgar insignias', L.Course),
  cap(CAP.BADGE_VIEW_AWARDED, 'Ver insignias otorgadas', L.Course),
  cap(CAP.BADGE_EARN, 'Obtener insignias', L.System),

  // Copias de seguridad
  cap(CAP.BACKUP_COURSE, 'Hacer copia de seguridad de un curso', L.Course, 'core', R.PersonalData),
  cap(CAP.RESTORE_COURSE, 'Restaurar un curso', L.Course, 'core', R.PersonalData),
  cap(CAP.BACKUP_DOWNLOAD, 'Descargar copias de seguridad', L.Course, 'core', R.PersonalData),
  cap(CAP.COURSE_IMPORT, 'Importar datos de otro curso', L.Course),

  // Etiquetas / comentarios / valoraciones
  cap(CAP.TAG_MANAGE, 'Gestionar etiquetas', L.Tenant),
  cap(CAP.TAG_EDIT, 'Editar etiquetas', L.System),
  cap(CAP.COMMENT_POST, 'Publicar comentarios', L.Module, 'core', R.Spam),
  cap(CAP.COMMENT_DELETE, 'Eliminar comentarios', L.Module),
  cap(CAP.COMMENT_VIEW, 'Ver comentarios', L.Module),
  cap(CAP.RATING_RATE, 'Valorar contenidos', L.Module),
  cap(CAP.RATING_VIEW_ALL, 'Ver todas las valoraciones', L.Module),

  // Campos personalizados / RGPD
  cap(CAP.CUSTOMFIELD_MANAGE, 'Gestionar campos personalizados', L.Tenant),
  cap(CAP.GDPR_MANAGE_REQUESTS, 'Gestionar solicitudes de datos', L.Tenant, 'core', R.PersonalData),
  cap(CAP.GDPR_REQUEST_OWN, 'Solicitar los datos propios', L.System),
];

export const ALL_CAPABILITY_NAMES: readonly string[] = CAPABILITY_CATALOG.map((c) => c.name);

const CATALOG_BY_NAME = new Map(CAPABILITY_CATALOG.map((c) => [c.name, c]));

export function getCapability(name: string): CapabilityDefinition | undefined {
  return CATALOG_BY_NAME.get(name);
}

/** Agrupa el catálogo por componente para el editor de roles de la UI. */
export function groupCapabilitiesByComponent(): Record<string, CapabilityDefinition[]> {
  return CAPABILITY_CATALOG.reduce<Record<string, CapabilityDefinition[]>>((acc, c) => {
    (acc[c.component] ??= []).push(c);
    return acc;
  }, {});
}
