import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PLAN_LIMITS, TenantPlan, TenantStatus } from '@maya/shared';
import type { PlanLimits } from '@maya/shared';
import { TenantsService } from './tenants.service';
import { Tenant } from './schemas/tenant.schema';
import { User } from '../users/schemas/user.schema';
import { ContextsService } from '../contexts/contexts.service';
import { RolesService } from '../rbac/roles.service';
import { TenantQueryDto } from './dto/tenant.dto';

const ACME = new Types.ObjectId();
const GLOBEX = new Types.ObjectId();

function tenantRow(id: Types.ObjectId, name: string, status: TenantStatus) {
  return {
    _id: id,
    id: id.toString(),
    name,
    status,
    toJSON: () => ({ id: id.toString(), name, status }),
  };
}

/** Doble del modelo de empresas que registra el filtro con el que se consulta. */
function tenantModelStub(rows: unknown[]) {
  const calls: Record<string, unknown>[] = [];
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    exec: async () => rows,
  };
  return {
    calls,
    find: jest.fn((filter: Record<string, unknown>) => {
      calls.push(filter);
      return chain;
    }),
    countDocuments: jest.fn(() => ({ exec: async () => rows.length })),
  };
}

function userModelStub(counts: { _id: Types.ObjectId; count: number }[]) {
  return {
    aggregate: jest.fn(() => ({ exec: async () => counts })),
  };
}

async function build(rows: unknown[], counts: { _id: Types.ObjectId; count: number }[] = []) {
  const model = tenantModelStub(rows);
  const users = userModelStub(counts);
  const moduleRef = await Test.createTestingModule({
    providers: [
      TenantsService,
      { provide: getModelToken(Tenant.name), useValue: model },
      { provide: getModelToken(User.name), useValue: users },
      { provide: ContextsService, useValue: {} },
      { provide: RolesService, useValue: {} },
    ],
  }).compile();

  return { service: moduleRef.get(TenantsService), model, users };
}

function query(extra: Partial<TenantQueryDto> = {}): TenantQueryDto {
  return Object.assign(new TenantQueryDto(), extra);
}

describe('TenantsService · listado de empresas', () => {
  it('filtra por estado y por plan cuando se piden', async () => {
    const { service, model } = await build([tenantRow(ACME, 'ACME', TenantStatus.Active)]);

    await service.paginate(query({ status: TenantStatus.Suspended, plan: TenantPlan.Business }));

    expect(model.calls[0]).toMatchObject({
      status: TenantStatus.Suspended,
      plan: TenantPlan.Business,
      deletedAt: null,
    });
  });

  it('no impone filtro de estado si no se pide', async () => {
    const { service, model } = await build([tenantRow(ACME, 'ACME', TenantStatus.Active)]);

    await service.paginate(query());

    expect(model.calls[0]).not.toHaveProperty('status');
  });

  it('busca por nombre, identificador y correo a la vez', async () => {
    const { service, model } = await build([]);

    await service.paginate(query({ search: 'acme' }));

    expect(model.calls[0].$or).toHaveLength(3);
  });

  it('adjunta el número de usuarios de cada empresa', async () => {
    const { service } = await build(
      [
        tenantRow(ACME, 'ACME', TenantStatus.Active),
        tenantRow(GLOBEX, 'Globex', TenantStatus.Trial),
      ],
      [{ _id: ACME, count: 7 }],
    );

    const result = await service.paginate(query());

    expect(result.items[0].userCount).toBe(7);
    // Sin usuarios contados, cero: nunca `undefined`, que la tabla mostraría
    // como un hueco indistinguible de «no se ha podido calcular».
    expect(result.items[1].userCount).toBe(0);
  });

  it('no consulta usuarios si la página está vacía', async () => {
    const { service, users } = await build([]);

    const result = await service.paginate(query());

    expect(result.items).toHaveLength(0);
    expect(users.aggregate).not.toHaveBeenCalled();
  });
});

/* -------------------------- Topes del plan ------------------------------- */

type Limites = PlanLimits & { usedStorageBytes: number };

/** Empresa con topes mutables, para ver qué le hace la reconciliación. */
function tenantConLimites(plan: TenantPlan, limits: PlanLimits & { usedStorageBytes?: number }) {
  return {
    _id: ACME,
    id: ACME.toString(),
    plan,
    limits: { usedStorageBytes: 0, ...limits } as Limites,
    save: jest.fn(async function (this: unknown) {
      return this;
    }),
  };
}

async function buildConEmpresas(rows: unknown[]) {
  const model = {
    find: jest.fn(() => ({ exec: async () => rows })),
    findById: jest.fn(() => ({ exec: async () => rows[0] })),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      TenantsService,
      { provide: getModelToken(Tenant.name), useValue: model },
      { provide: getModelToken(User.name), useValue: {} },
      { provide: ContextsService, useValue: {} },
      { provide: RolesService, useValue: {} },
    ],
  }).compile();
  return { service: moduleRef.get(TenantsService) as TenantsService, model };
}

describe('TenantsService · topes del plan', () => {
  it('sube al valor del plan los topes que se quedaron cortos', async () => {
    // Los 10 GiB del esquema anterior, que toda empresa arrastraba.
    const acme = tenantConLimites(TenantPlan.Business, {
      maxUsers: 500,
      maxCourses: 100,
      maxStorageBytes: 10 * 1024 * 1024 * 1024,
    });
    const { service } = await buildConEmpresas([acme]);

    expect(await service.reconcilePlanLimits()).toBe(1);
    expect(acme.limits.maxStorageBytes).toBe(PLAN_LIMITS[TenantPlan.Business].maxStorageBytes);
    expect(acme.limits.maxUsers).toBe(PLAN_LIMITS[TenantPlan.Business].maxUsers);
    expect(acme.save).toHaveBeenCalled();
  });

  it('respeta un tope pactado por encima del de su plan', async () => {
    const acuerdo = 4 * 1024 * 1024 * 1024 * 1024;
    const acme = tenantConLimites(TenantPlan.Business, {
      maxUsers: PLAN_LIMITS[TenantPlan.Business].maxUsers,
      maxCourses: PLAN_LIMITS[TenantPlan.Business].maxCourses,
      maxStorageBytes: acuerdo,
    });
    const { service } = await buildConEmpresas([acme]);

    expect(await service.reconcilePlanLimits()).toBe(0);
    expect(acme.limits.maxStorageBytes).toBe(acuerdo);
    expect(acme.save).not.toHaveBeenCalled();
  });

  it('no escribe nada cuando los topes ya son los del plan', async () => {
    const acme = tenantConLimites(TenantPlan.Starter, PLAN_LIMITS[TenantPlan.Starter]);
    const { service } = await buildConEmpresas([acme]);

    expect(await service.reconcilePlanLimits()).toBe(0);
    expect(acme.save).not.toHaveBeenCalled();
  });

  it('dice cuánto espacio queda y si cabe lo que se quiere subir', async () => {
    const acme = tenantConLimites(TenantPlan.Starter, {
      ...PLAN_LIMITS[TenantPlan.Starter],
      usedStorageBytes: PLAN_LIMITS[TenantPlan.Starter].maxStorageBytes - 100,
    });
    const { service } = await buildConEmpresas([acme]);

    expect(await service.storageAllowance(ACME, 50)).toMatchObject({ free: 100, fits: true });
    expect(await service.storageAllowance(ACME, 200)).toMatchObject({ free: 100, fits: false });
  });

  it('no deja el hueco justo en el límite fuera del tope', async () => {
    const acme = tenantConLimites(TenantPlan.Starter, {
      ...PLAN_LIMITS[TenantPlan.Starter],
      usedStorageBytes: PLAN_LIMITS[TenantPlan.Starter].maxStorageBytes - 100,
    });
    const { service } = await buildConEmpresas([acme]);

    // Exactamente lo que queda sí cabe: el tope es el último byte admitido,
    // no el primero rechazado.
    expect((await service.storageAllowance(ACME, 100)).fits).toBe(true);
  });
});
