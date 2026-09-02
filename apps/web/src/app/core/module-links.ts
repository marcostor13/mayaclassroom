import { CourseModuleDto, ModuleType } from '@maya/shared';

/**
 * Icono y ruta de cada tipo de actividad.
 *
 * Vive aquí y no dentro de una pantalla porque lo necesitan varias: la vista
 * del curso, el editor y cualquier listado que enlace a una actividad. Tenerlo
 * duplicado hacía que añadir un tipo nuevo obligara a recordar todos los sitios.
 */
const MODULE_ICONS: Record<string, string> = {
  [ModuleType.Assign]: 'clipboard-check',
  [ModuleType.Quiz]: 'help-circle',
  [ModuleType.Forum]: 'message-square',
  [ModuleType.Choice]: 'list-checks',
  [ModuleType.Feedback]: 'clipboard-list',
  [ModuleType.Resource]: 'file',
  [ModuleType.Folder]: 'folder',
  [ModuleType.Page]: 'file-text',
  [ModuleType.Url]: 'link',
  [ModuleType.Book]: 'book-open',
  [ModuleType.Label]: 'tag',
  [ModuleType.Lesson]: 'route',
  [ModuleType.Glossary]: 'book-a',
  [ModuleType.Wiki]: 'network',
  [ModuleType.Workshop]: 'users-round',
  [ModuleType.Database]: 'database',
  [ModuleType.Chat]: 'messages-square',
  [ModuleType.Scorm]: 'package',
  [ModuleType.Lti]: 'plug',
  [ModuleType.H5p]: 'puzzle',
  [ModuleType.Survey]: 'bar-chart-3',
  [ModuleType.Attendance]: 'user-check',
};

/** Tipos con pantalla propia. El resto cae en el visor de recursos o el avanzado. */
const MODULE_ROUTES: Record<string, string> = {
  [ModuleType.Assign]: '/mod/assign',
  [ModuleType.Quiz]: '/mod/quiz',
  [ModuleType.Forum]: '/mod/forum',
  [ModuleType.Choice]: '/mod/choice',
  [ModuleType.Feedback]: '/mod/feedback',
};

const ADVANCED: readonly ModuleType[] = [
  ModuleType.Lesson,
  ModuleType.Glossary,
  ModuleType.Wiki,
  ModuleType.Workshop,
  ModuleType.Database,
  ModuleType.Chat,
  ModuleType.Scorm,
  ModuleType.Lti,
  ModuleType.H5p,
  ModuleType.Survey,
  ModuleType.Attendance,
];

export function moduleIcon(module: CourseModuleDto): string {
  return MODULE_ICONS[module.moduleType] ?? 'file';
}

export function moduleLink(module: CourseModuleDto): string[] {
  const base = MODULE_ROUTES[module.moduleType];
  if (base) return [base, module.id];
  return ADVANCED.includes(module.moduleType)
    ? ['/mod/advanced', module.id]
    : ['/mod/resource', module.id];
}
