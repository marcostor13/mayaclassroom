import { ModuleType } from '@maya/shared';
import { SearchService } from './search.service';

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const CURSO_MATRICULADO = 'bbbbbbbbbbbbbbbbbbbbbbbb';

/** Doble de modelo de Mongoose que devuelve siempre la misma lista. */
function model(items: unknown[], onFilter?: (filter: unknown) => void) {
  const chain = {
    populate: () => chain,
    select: () => chain,
    limit: () => chain,
    sort: () => chain,
    lean: () => chain,
    exec: async () => items,
  };
  return {
    find: (filter: unknown) => {
      onFilter?.(filter);
      return chain;
    },
  };
}

function build(
  overrides: {
    courses?: unknown[];
    modules?: unknown[];
    categories?: unknown[];
    users?: unknown[];
    enrolled?: string[];
    onCourseFilter?: (filter: unknown) => void;
    onModuleFilter?: (filter: unknown) => void;
  } = {},
): SearchService {
  return new SearchService(
    model(overrides.courses ?? [], overrides.onCourseFilter) as never,
    model(overrides.modules ?? [], overrides.onModuleFilter) as never,
    model(overrides.categories ?? []) as never,
    model(overrides.users ?? []) as never,
    { courseIdsOfUser: async () => overrides.enrolled ?? [] } as never,
  );
}

const user = { _id: 'u1', id: 'u1', _tenantId: TENANT, tenantId: TENANT } as never;

describe('SearchService · búsqueda global', () => {
  it('no consulta nada con menos de dos caracteres', async () => {
    let consultado = false;
    const service = build({ onCourseFilter: () => (consultado = true) });
    const result = await service.search(user, 'a');
    expect(result.total).toBe(0);
    expect(result.groups).toHaveLength(0);
    expect(consultado).toBe(false);
  });

  it('agrupa los resultados por tipo y en el orden esperado', async () => {
    const service = build({
      courses: [{ _id: 'c1', fullName: 'Angular', shortName: 'ANG', category: { name: 'Web' } }],
      enrolled: [CURSO_MATRICULADO],
      modules: [
        {
          _id: 'm1',
          name: 'Tarea de Angular',
          moduleType: ModuleType.Assign,
          course: { _id: CURSO_MATRICULADO, fullName: 'Angular' },
        },
      ],
      users: [{ _id: 'u2', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@maya.test' }],
      categories: [{ _id: 'cat1', name: 'Angular avanzado' }],
    });

    const result = await service.search(user, 'angular', { canSeeUsers: true });

    expect(result.total).toBe(4);
    expect(result.groups.map((group) => group.kind)).toEqual([
      'course',
      'activity',
      'user',
      'category',
    ]);
  });

  it('lleva cada tipo de actividad a su ruta del cliente', async () => {
    const service = build({
      enrolled: [CURSO_MATRICULADO],
      modules: [
        { _id: 'm1', name: 'Tarea', moduleType: ModuleType.Assign, course: { _id: CURSO_MATRICULADO } },
        { _id: 'm2', name: 'Página', moduleType: ModuleType.Page, course: { _id: CURSO_MATRICULADO } },
        { _id: 'm3', name: 'Wiki', moduleType: ModuleType.Wiki, course: { _id: CURSO_MATRICULADO } },
      ],
    });

    const result = await service.search(user, 'algo');
    const rutas = result.groups[0].items.map((item) => item.route);

    expect(rutas).toEqual(['/mod/assign/m1', '/mod/resource/m2', '/mod/advanced/m3']);
  });

  it('omite a las personas si no se tiene permiso para verlas', async () => {
    const service = build({
      users: [{ _id: 'u2', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@maya.test' }],
    });
    const result = await service.search(user, 'ada');
    expect(result.total).toBe(0);
  });

  it('restringe las actividades a los cursos accesibles', async () => {
    let filtroModulos: Record<string, unknown> | null = null;
    const service = build({
      enrolled: [CURSO_MATRICULADO],
      modules: [],
      onModuleFilter: (filter) => (filtroModulos = filter as Record<string, unknown>),
    });

    await service.search(user, 'algo');

    expect(filtroModulos).not.toBeNull();
    expect(filtroModulos!['course']).toEqual({ $in: [CURSO_MATRICULADO] });
  });

  it('no busca actividades cuando no hay ningún curso accesible', async () => {
    let consultado = false;
    const service = build({ enrolled: [], onModuleFilter: () => (consultado = true) });
    await service.search(user, 'algo');
    expect(consultado).toBe(false);
  });

  it('siempre acota la búsqueda de cursos a la empresa activa', async () => {
    let filtroCursos: Record<string, unknown> | null = null;
    const service = build({ onCourseFilter: (filter) => (filtroCursos = filter as Record<string, unknown>) });

    await service.search(user, 'algo');

    expect(String(filtroCursos!['tenant'])).toBe(TENANT);
  });
});
