import { CAP } from '@maya/shared';

export interface NavItem {
  label: string;
  /** Etiqueta corta para la barra inferior, donde solo caben ~10 caracteres. */
  shortLabel?: string;
  icon: string;
  route: string;
  /** Basta con una de estas capacidades para ver el elemento. */
  capabilities?: string[];
  /** Sección del menú lateral. */
  group: 'principal' | 'docencia' | 'administración';
  /** Solo visible para administradores de plataforma. */
  platformAdmin?: boolean;
  /**
   * Candidato a la barra inferior móvil. Solo los cuatro primeros visibles
   * llegan a ella; el resto vive en la hoja «Más».
   */
  mobile?: boolean;
  exact?: boolean;
}

/** Orden de las secciones en el menú lateral. */
export const NAV_GROUPS: NavItem['group'][] = ['principal', 'docencia', 'administración'];

export const NAV_ITEMS: NavItem[] = [
  { label: 'Panel', shortLabel: 'Inicio', icon: 'home', route: '/dashboard', group: 'principal', mobile: true, exact: true },
  { label: 'Mis cursos', shortLabel: 'Cursos', icon: 'book', route: '/courses', group: 'principal', mobile: true },
  { label: 'Calendario', shortLabel: 'Agenda', icon: 'calendar', route: '/calendar', group: 'principal', mobile: true },
  { label: 'Mensajes', shortLabel: 'Chats', icon: 'message-square', route: '/messages', group: 'principal', mobile: true },
  { label: 'Notificaciones', shortLabel: 'Avisos', icon: 'bell', route: '/notifications', group: 'principal' },
  { label: 'Insignias', shortLabel: 'Logros', icon: 'award', route: '/badges', group: 'principal' },
  { label: 'Competencias', shortLabel: 'Metas', icon: 'target', route: '/competencies', group: 'principal' },
  { label: 'Certificados', shortLabel: 'Títulos', icon: 'graduation-cap', route: '/certificates', group: 'principal' },
  { label: 'Mis ficheros', shortLabel: 'Ficheros', icon: 'folder', route: '/files', group: 'principal' },

  {
    label: 'Catálogo de cursos',
    shortLabel: 'Catálogo',
    icon: 'layers',
    route: '/catalogue',
    group: 'docencia',
  },
  {
    label: 'Banco de preguntas',
    shortLabel: 'Preguntas',
    icon: 'help-circle',
    route: '/question-bank',
    group: 'docencia',
    capabilities: [CAP.QUESTION_VIEW_ALL, CAP.QUESTION_ADD],
  },
  {
    label: 'Analíticas',
    icon: 'chart',
    route: '/analytics',
    group: 'docencia',
    capabilities: [CAP.REPORT_VIEW_COURSE, CAP.TENANT_VIEW_REPORTS],
  },

  {
    label: 'Usuarios',
    icon: 'users',
    route: '/admin/users',
    group: 'administración',
    capabilities: [CAP.TENANT_MANAGE_USERS, CAP.USER_CREATE, CAP.USER_UPDATE],
  },
  {
    label: 'Roles y permisos',
    shortLabel: 'Roles',
    icon: 'shield',
    route: '/admin/roles',
    group: 'administración',
    capabilities: [CAP.ROLE_MANAGE, CAP.ROLE_ASSIGN],
  },
  {
    label: 'Categorías',
    icon: 'grid',
    route: '/admin/categories',
    group: 'administración',
    capabilities: [CAP.CATEGORY_MANAGE, CAP.CATEGORY_CREATE],
  },
  {
    label: 'Cohortes',
    icon: 'users-round',
    route: '/admin/cohorts',
    group: 'administración',
    capabilities: [CAP.COHORT_VIEW, CAP.COHORT_MANAGE],
  },
  {
    label: 'Empresa',
    icon: 'building',
    route: '/admin/tenant',
    group: 'administración',
    capabilities: [CAP.TENANT_UPDATE, CAP.TENANT_MANAGE_BRANDING],
  },
  {
    label: 'Página pública',
    icon: 'globe',
    route: '/admin/storefront',
    group: 'administración',
    capabilities: [CAP.SITE_MANAGE, CAP.SITE_MANAGE_REQUESTS],
  },
  {
    label: 'Sitio',
    icon: 'sliders',
    route: '/admin/site',
    group: 'administración',
    capabilities: [
      CAP.REPORT_VIEW_LOGS,
      CAP.SITE_VIEW_AUDIT,
      CAP.BACKUP_COURSE,
      CAP.TAG_MANAGE,
      CAP.CUSTOMFIELD_MANAGE,
      CAP.GDPR_MANAGE_REQUESTS,
      CAP.TENANT_MANAGE_WEBSERVICES,
    ],
  },
  {
    label: 'Empresas',
    icon: 'building',
    route: '/admin/tenants',
    group: 'administración',
    platformAdmin: true,
  },
];
