import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { TenantPlan, TenantStatus } from '@maya/shared';
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
