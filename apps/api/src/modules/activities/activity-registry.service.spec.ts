import { Types } from 'mongoose';
import { ModuleType, RESOURCE_MODULES } from '@maya/shared';
import { ActivityRegistry } from './activity-registry.service';
import type { ActivityHandler } from './activity-registry.service';

function handlerDouble(overrides: Partial<ActivityHandler> & { type: ModuleType }): ActivityHandler {
  return {
    label: 'Sin nombre',
    icon: 'circle',
    gradable: false,
    description: 'Descripción de prueba.',
    create: async () => ({ id: new Types.ObjectId(), gradeMax: null }),
    update: async () => ({ id: new Types.ObjectId(), gradeMax: null }),
    remove: async () => undefined,
    get: async () => null,
    ...overrides,
  };
}

describe('ActivityRegistry · catálogo', () => {
  function registry(): ActivityRegistry {
    const registro = new ActivityRegistry();
    registro.register(
      handlerDouble({ type: ModuleType.Page, label: 'Página', description: 'Contenido escrito.' }),
    );
    registro.register(
      handlerDouble({
        type: ModuleType.Quiz,
        label: 'Cuestionario',
        gradable: true,
        description: 'Preguntas con corrección automática.',
        tags: ['Se corrige sola'],
      }),
    );
    registro.register(
      handlerDouble({ type: ModuleType.Assign, label: 'Tarea', description: 'Entrega de trabajos.' }),
    );
    return registro;
  }

  it('separa actividades de recursos según RESOURCE_MODULES', () => {
    const catalogo = registry().catalog();
    const pagina = catalogo.find((item) => item.type === ModuleType.Page);
    const tarea = catalogo.find((item) => item.type === ModuleType.Assign);

    expect(RESOURCE_MODULES).toContain(ModuleType.Page);
    expect(pagina?.group).toBe('resource');
    expect(tarea?.group).toBe('activity');
  });

  it('coloca las actividades antes que los recursos y ordena por etiqueta', () => {
    expect(registry().catalog().map((item) => item.type)).toEqual([
      ModuleType.Quiz, // «Cuestionario» antes que «Tarea»
      ModuleType.Assign,
      ModuleType.Page, // el recurso, al final
    ]);
  });

  it('lleva la descripción y las etiquetas de cada tipo', () => {
    const cuestionario = registry()
      .catalog()
      .find((item) => item.type === ModuleType.Quiz);

    expect(cuestionario?.description).toBe('Preguntas con corrección automática.');
    expect(cuestionario?.tags).toEqual(['Se corrige sola']);
    expect(cuestionario?.gradable).toBe(true);
  });

  it('devuelve una lista de etiquetas vacía cuando el tipo no declara ninguna', () => {
    const pagina = registry()
      .catalog()
      .find((item) => item.type === ModuleType.Page);

    expect(pagina?.tags).toEqual([]);
  });
});
