import { Types } from 'mongoose';
import { DemoResetService } from './demo-reset.service';

const DEMO = new Types.ObjectId();

/** Un modelo de mentira: dice si tiene `tenant` y apunta lo que le borran. */
function modelo(nombre: string, conTenant: boolean, cuantos = 0) {
  const borrados: Record<string, unknown>[] = [];
  return {
    nombre,
    borrados,
    schema: { path: (campo: string) => (campo === 'tenant' && conTenant ? {} : undefined) },
    collection: { collectionName: nombre },
    deleteMany: (filtro: Record<string, unknown>) => ({
      exec: async () => {
        borrados.push(filtro);
        return { deletedCount: cuantos };
      },
    }),
  };
}

interface Entorno {
  service: DemoResetService;
  modelos: ReturnType<typeof modelo>[];
  /** Filtros con los que se llamó a `deleteOne` sobre la colección de empresas. */
  empresasBorradas: Record<string, unknown>[];
}

function construir(options: { empresa?: Record<string, unknown> | null; slug?: string } = {}): Entorno {
  const modelos = [
    modelo('courses', true, 4),
    modelo('users', true, 12),
    // Sin `tenant`: es global y no debe mirarse siquiera.
    modelo('roles_globales', false, 99),
  ];
  const empresasBorradas: Record<string, unknown>[] = [];

  const connection = {
    modelNames: () => modelos.map((m) => m.nombre),
    model: (nombre: string) => modelos.find((m) => m.nombre === nombre),
    collection: () => ({
      findOne: async () =>
        options.empresa === undefined ? { _id: DEMO, slug: options.slug ?? 'demo' } : options.empresa,
      deleteOne: async (filtro: Record<string, unknown>) => {
        empresasBorradas.push(filtro);
        return { deletedCount: 1 };
      },
    }),
  };

  const config = { getOrThrow: () => ({ enabled: true, tenantSlug: options.slug ?? 'demo' }) };
  const moduleRef = { get: () => undefined };

  const service = new DemoResetService(
    connection as never,
    moduleRef as never,
    config as never,
  );

  // El trabajo de fondo se sustituye por uno que nunca termina: aquí se
  // comprueba lo que decide `start`, no la siembra, y dejarlo arrancar de
  // verdad convertía la prueba en una carrera contra un fallo asíncrono.
  Reflect.set(service, 'ejecutar', () => new Promise<void>(() => undefined));

  return { service, modelos, empresasBorradas };
}

describe('DemoResetService · antes de borrar nada', () => {
  it('exige escribir el identificador de la empresa', async () => {
    // Esto borra una empresa entera: si algún día DEMO_TENANT_SLUG apuntara a
    // la de un cliente, escribir su nombre a mano es lo único que se interpone.
    const { service } = construir();

    await expect(service.start('')).rejects.toThrow(/escriba el identificador/i);
    await expect(service.start('otra-cosa')).rejects.toThrow(/escriba el identificador/i);
  });

  it('acepta el identificador con otras mayúsculas y espacios', async () => {
    const { service } = construir();

    const estado = await service.start('  DEMO  ');

    expect(estado.running).toBe(true);
  });

  it('avisa si la empresa configurada no existe', async () => {
    const { service } = construir({ empresa: null });

    await expect(service.start('demo')).rejects.toThrow(/DEMO_TENANT_SLUG/);
  });

  it('no arranca un segundo reinicio encima del primero', async () => {
    const { service } = construir();
    await service.start('demo');

    await expect(service.start('demo')).rejects.toThrow(/ya hay un reinicio/i);
  });

  it('el estado inicial dice que nunca se ha reiniciado', () => {
    const { service } = construir();

    expect(service.status()).toMatchObject({
      tenantSlug: 'demo',
      running: false,
      ok: null,
      summary: null,
    });
  });
});

describe('DemoResetService · el borrado', () => {
  /** El borrado es privado a propósito; se llama por aquí para observarlo. */
  const borrar = (service: DemoResetService, id: Types.ObjectId) =>
    (
      Reflect.get(service, 'borrarEmpresa') as (i: Types.ObjectId) => Promise<Record<string, number>>
    ).call(service, id);

  it('solo toca las colecciones que pertenecen a una empresa', async () => {
    // El filtro es siempre `tenant`, así que lo global —los roles arquetípicos,
    // el contexto de sistema— ni se mira.
    const { service, modelos } = construir();

    await borrar(service, DEMO);

    expect(modelos.find((m) => m.nombre === 'courses')!.borrados).toEqual([{ tenant: DEMO }]);
    expect(modelos.find((m) => m.nombre === 'users')!.borrados).toEqual([{ tenant: DEMO }]);
    expect(modelos.find((m) => m.nombre === 'roles_globales')!.borrados).toEqual([]);
  });

  it('cuenta lo borrado por colección y se lleva la empresa al final', async () => {
    const { service, empresasBorradas } = construir();

    const removed = await borrar(service, DEMO);

    expect(removed).toEqual({ courses: 4, users: 12, tenants: 1 });
    expect(empresasBorradas).toEqual([{ _id: DEMO }]);
  });
});
