import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ContextLevel } from '@maya/shared';
import { RolesService } from './roles.service';
import { Role } from './schemas/role.schema';
import { RoleCapability } from './schemas/role-capability.schema';
import { RoleAssignment } from './schemas/role-assignment.schema';
import { ContextsService } from '../contexts/contexts.service';

const TENANT = new Types.ObjectId();
const OTRA_EMPRESA = new Types.ObjectId();

/** Doble de rol: solo los campos que mira el servicio. */
function roleDouble(base: {
  shortName: string;
  tenant: Types.ObjectId | null;
  assignableAt?: ContextLevel[];
  isSystem?: boolean;
}) {
  const _id = new Types.ObjectId();
  return {
    _id,
    id: _id.toString(),
    name: base.shortName,
    description: '',
    sortOrder: 10,
    isSystem: base.isSystem ?? true,
    assignableAt: base.assignableAt ?? [ContextLevel.Tenant, ContextLevel.Course],
    save: jest.fn(async () => undefined),
    deleteOne: jest.fn(async () => undefined),
    ...base,
  };
}

type Rol = ReturnType<typeof roleDouble>;

async function build(roles: Rol[], contexto?: { tenant: Types.ObjectId | null }) {
  const roleModel = {
    find: jest.fn(() => ({
      sort: () => ({ exec: async () => roles }),
      select: () => ({ exec: async () => roles }),
      exec: async () => roles,
    })),
    findById: jest.fn((id: Types.ObjectId) => ({
      exec: async () => roles.find((role) => String(role._id) === String(id)) ?? null,
    })),
    findOne: jest.fn(() => ({ exec: async () => null })),
  };
  const capabilityModel = {
    find: jest.fn(() => ({
      lean: () => ({ exec: async () => [] }),
      select: () => ({ lean: () => ({ exec: async () => [] }) }),
      exec: async () => [],
    })),
    bulkWrite: jest.fn(async () => undefined),
    deleteMany: jest.fn(() => ({ exec: async () => undefined })),
    findOneAndUpdate: jest.fn(() => ({ exec: async () => undefined })),
    deleteOne: jest.fn(() => ({ exec: async () => undefined })),
  };
  const assignmentModel = {
    countDocuments: jest.fn(() => ({ exec: async () => 0 })),
    findOne: jest.fn(() => ({ exec: async () => null })),
    create: jest.fn(async (doc: Record<string, unknown>) => doc),
    find: jest.fn(() => ({
      populate: () => ({ populate: () => ({ exec: async () => [] }) }),
    })),
    deleteOne: jest.fn(() => ({ exec: async () => undefined })),
  };
  const contexts = {
    findById: jest.fn(async () => ({
      _id: new Types.ObjectId(),
      level: ContextLevel.Tenant,
      path: '/x/',
      tenant: contexto === undefined ? TENANT : contexto.tenant,
    })),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      RolesService,
      { provide: getModelToken(Role.name), useValue: roleModel },
      { provide: getModelToken(RoleCapability.name), useValue: capabilityModel },
      { provide: getModelToken(RoleAssignment.name), useValue: assignmentModel },
      { provide: ContextsService, useValue: contexts },
    ],
  }).compile();

  return { service: moduleRef.get(RolesService), assignmentModel, capabilityModel };
}

describe('RolesService · listado de roles', () => {
  it('no repite un rol que existe a la vez en la empresa y en la plataforma', async () => {
    // Es lo que pasa siempre: al dar de alta una empresa se clonan los roles
    // predefinidos, y la copia global sigue existiendo.
    const global = roleDouble({ shortName: 'manager', tenant: null });
    const propio = roleDouble({ shortName: 'manager', tenant: TENANT });
    const { service } = await build([global, propio]);

    const lista = await service.list(TENANT);

    expect(lista).toHaveLength(1);
    expect(String(lista[0].tenant)).toBe(String(TENANT));
  });

  it('se queda con el de la empresa aunque la global venga después', async () => {
    const propio = roleDouble({ shortName: 'student', tenant: TENANT });
    const global = roleDouble({ shortName: 'student', tenant: null });
    const { service } = await build([propio, global]);

    const lista = await service.list(TENANT);

    expect(lista).toHaveLength(1);
    expect(String(lista[0].tenant)).toBe(String(TENANT));
  });

  it('mantiene el rol global cuando la empresa todavía no tiene el suyo', async () => {
    // Un rol añadido a la plataforma después de dar de alta la empresa.
    const global = roleDouble({ shortName: 'coursecreator', tenant: null });
    const { service } = await build([global]);

    expect(await service.list(TENANT)).toHaveLength(1);
  });

  it('oculta el rol de administración de plataforma en la lista de una empresa', async () => {
    const platform = roleDouble({
      shortName: 'platformadmin',
      tenant: null,
      assignableAt: [ContextLevel.System],
    });
    const { service } = await build([platform]);

    expect(await service.list(TENANT)).toHaveLength(0);
    // A nivel de plataforma sí sale.
    expect(await service.list(null)).toHaveLength(1);
  });

  it('sí lo enseña a quien administra la plataforma', async () => {
    const platform = roleDouble({
      shortName: 'platformadmin',
      tenant: null,
      assignableAt: [ContextLevel.System],
    });
    const { service } = await build([platform]);

    expect(await service.list(TENANT, { isPlatformAdmin: true })).toHaveLength(1);
  });
});

describe('RolesService · aislamiento entre empresas', () => {
  it('no deja editar el rol de otra empresa', async () => {
    const ajeno = roleDouble({ shortName: 'manager', tenant: OTRA_EMPRESA });
    const { service } = await build([ajeno]);

    await expect(
      service.update(ajeno._id, { name: 'Secuestrado' }, { tenantId: TENANT }),
    ).rejects.toThrow(/no encontrado/i);
  });

  it('no deja editar un rol global desde una empresa', async () => {
    // Editarlo cambiaría el rol de todas las demás empresas.
    const global = roleDouble({ shortName: 'manager', tenant: null });
    const { service } = await build([global]);

    await expect(
      service.update(global._id, { name: 'Para todos' }, { tenantId: TENANT }),
    ).rejects.toThrow(/plataforma/i);
  });

  it('deja editar el rol global a la administración de plataforma', async () => {
    const global = roleDouble({ shortName: 'manager', tenant: null });
    const { service } = await build([global]);

    const resultado = await service.update(
      global._id,
      { name: 'Gestor' },
      { tenantId: TENANT, isPlatformAdmin: true },
    );

    expect(resultado.name).toBe('Gestor');
  });

  it('no deja leer la matriz de capacidades de otra empresa', async () => {
    const ajeno = roleDouble({ shortName: 'manager', tenant: OTRA_EMPRESA });
    const { service } = await build([ajeno]);

    await expect(service.capabilitiesOf(ajeno._id, { tenantId: TENANT })).rejects.toThrow(
      /no encontrado/i,
    );
  });

  it('no deja cambiar un permiso de otra empresa', async () => {
    const ajeno = roleDouble({ shortName: 'manager', tenant: OTRA_EMPRESA });
    const { service } = await build([ajeno]);

    await expect(
      service.setCapability(
        ajeno._id,
        { capability: 'moodle/course:update', permission: 1 },
        { tenantId: TENANT },
      ),
    ).rejects.toThrow(/no encontrado/i);
  });

  it('no deja asignar un rol en un contexto de otra empresa', async () => {
    const propio = roleDouble({ shortName: 'student', tenant: TENANT });
    const { service } = await build([propio], { tenant: OTRA_EMPRESA });

    await expect(
      service.assign(
        {
          userId: new Types.ObjectId().toString(),
          roleId: propio._id.toString(),
          contextId: new Types.ObjectId().toString(),
        },
        { tenantId: TENANT },
      ),
    ).rejects.toThrow(/contexto no encontrado/i);
  });

  it('sí deja asignar un rol global, que es el que usa quien no tiene copia propia', async () => {
    const global = roleDouble({ shortName: 'student', tenant: null });
    const { service, assignmentModel } = await build([global]);

    await service.assign(
      {
        userId: new Types.ObjectId().toString(),
        roleId: global._id.toString(),
        contextId: new Types.ObjectId().toString(),
      },
      { tenantId: TENANT },
    );

    expect(assignmentModel.create).toHaveBeenCalled();
  });

  it('no deja leer las asignaciones de un contexto de otra empresa', async () => {
    const { service } = await build([], { tenant: OTRA_EMPRESA });

    await expect(
      service.assignmentsInContext(new Types.ObjectId(), { tenantId: TENANT }),
    ).rejects.toThrow(/contexto no encontrado/i);
  });
});
