import { CAP } from '@maya/shared';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  /** Basta con una de estas capacidades para ver el elemento. */
  capabilities?: string[];
  /** Sección del menú lateral. */
  group: 'principal' | 'docencia' | 'administración';
  /** Se muestra también en la barra inferior móvil. */
  mobile?: boolean;
  exact?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Panel', icon: 'home', route: '/dashboard', group: 'principal', mobile: true, exact: true },
  { label: 'Mis cursos', icon: 'book', route: '/courses', group: 'principal', mobile: true },
  { label: 'Calendario', icon: 'calendar', route: '/calendar', group: 'principal', mobile: true },
  { label: 'Mensajes', icon: 'message-square', route: '/messages', group: 'principal', mobile: true },
  { label: 'Notificaciones', icon: 'bell', route: '/notifications', group: 'principal' },
  { label: 'Mis insignias', icon: 'award', route: '/badges', group: 'principal' },
  { label: 'Competencias', icon: 'target', route: '/competencies', group: 'principal' },

  {
    label: 'Catálogo de cursos',
    icon: 'layers',
    route: '/catalogue',
    group: 'docencia',
  },
  {
    label: 'Banco de preguntas',
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
];
