import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DemoRole, UserStatus } from '@maya/shared';
import { AuthService } from './auth.service';
import { RefreshToken } from './schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../rbac/roles.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { MailService } from '../mail/mail.service';

const CLIENT = { ip: '127.0.0.1', userAgent: 'pruebas' };
const TENANT = { _id: new Types.ObjectId(), slug: 'demo', name: 'Academia Maya' };

function userDouble(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  return {
    _id,
    id: _id.toString(),
    email: 'gestora@demo.example',
    status: UserStatus.Active,
    isPlatformAdmin: false,
    mustChangePassword: false,
    ...overrides,
  };
}

async function build(options: {
  enabled?: boolean;
  /** Usuarios devueltos por rol, en el orden en que los da la base. */
  porRol?: Record<string, ReturnType<typeof userDouble>[]>;
}) {
  const porRol = options.porRol ?? {};
  const todos = Object.values(porRol).flat();

  const users = {
    findById: jest.fn(async (id: Types.ObjectId) => {
      const found = todos.find((user) => user._id.equals(id));
      if (!found) throw new Error('usuario no encontrado');
      return found;
    }),
    touchLogin: jest.fn(async () => undefined),
  };
  const roles = {
    assigneesByShortName: jest.fn(async (shortName: string) =>
      (porRol[shortName] ?? []).map((user) => user._id),
    ),
    rolesOfUserInContext: jest.fn(async () => []),
  };
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'demo'
        ? { enabled: options.enabled ?? true, tenantSlug: 'demo' }
        : key === 'jwt'
          ? { accessSecret: 's', refreshSecret: 'r' }
          : key === 'security'
            ? { loginMaxAttempts: 5, loginLockMinutes: 15 }
            : { url: 'http://localhost' },
    ),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getModelToken(RefreshToken.name), useValue: { create: jest.fn() } },
      { provide: UsersService, useValue: users },
      {
        provide: TenantsService,
        useValue: { requireBySlug: jest.fn(async () => TENANT), findById: jest.fn(async () => TENANT) },
      },
      { provide: RolesService, useValue: roles },
      { provide: AccessService, useValue: { capabilitiesOfUser: jest.fn(async () => []) } },
      {
        provide: ContextsService,
        useValue: { requireByInstance: jest.fn(async () => ({ _id: new Types.ObjectId() })) },
      },
      { provide: JwtService, useValue: { signAsync: jest.fn(async () => 't') } },
      { provide: ConfigService, useValue: config },
      { provide: MailService, useValue: {} },
    ],
  }).compile();

  const service = moduleRef.get(AuthService);
  Reflect.set(service, 'buildSessionUser', jest.fn(async (id: Types.ObjectId) => ({ id: id.toString() })));
  Reflect.set(service, 'issueTokens', jest.fn(async () => ({ accessToken: 'a' })));

  return { service, users, roles };
}

describe('AuthService · disponibilidad de la demostración', () => {
  it('no ofrece nada si el despliegue la tiene apagada', async () => {
    const { service } = await build({ enabled: false, porRol: { manager: [userDouble()] } });

    const acceso = await service.demoAccess();

    expect(acceso.enabled).toBe(false);
    expect(acceso.roles).toEqual([]);
  });

  it('solo ofrece los papeles que tienen una cuenta detrás', async () => {
    // La empresa de demostración tiene gestora pero ningún estudiante.
    const { service } = await build({ porRol: { manager: [userDouble()] } });

    const acceso = await service.demoAccess();

    expect(acceso.roles).toEqual([DemoRole.Admin]);
    expect(acceso.tenantSlug).toBe('demo');
  });

  it('se apaga si no hay ninguna cuenta utilizable', async () => {
    const { service } = await build({ porRol: {} });

    expect((await service.demoAccess()).enabled).toBe(false);
  });
});

describe('AuthService · entrada en la demostración', () => {
  it('entra sin credenciales y devuelve una sesión', async () => {
    const gestora = userDouble();
    const { service, users } = await build({ porRol: { manager: [gestora] } });

    const resultado = await service.demoLogin(DemoRole.Admin, CLIENT);

    expect(resultado.tokens.accessToken).toBe('a');
    expect(users.touchLogin).toHaveBeenCalledTimes(1);
  });

  it('no deja entrar si el despliegue la tiene apagada', async () => {
    const { service } = await build({ enabled: false, porRol: { manager: [userDouble()] } });

    await expect(service.demoLogin(DemoRole.Admin, CLIENT)).rejects.toThrow(/no está disponible/i);
  });

  it('rechaza un papel inventado en lugar de caer en el de estudiante', async () => {
    const { service } = await build({ porRol: { student: [userDouble()] } });

    await expect(service.demoLogin('gestor' as DemoRole, CLIENT)).rejects.toThrow(/no existe/i);
  });

  it('nunca entra como una cuenta de administración de plataforma', async () => {
    // Sería dar a un visitante anónimo el control de todas las empresas del
    // despliegue, no solo de la de demostración.
    const plataforma = userDouble({ isPlatformAdmin: true });
    const gestora = userDouble({ email: 'gestora@demo.example' });
    const { service } = await build({ porRol: { manager: [plataforma, gestora] } });

    const resultado = await service.demoLogin(DemoRole.Admin, CLIENT);

    expect(resultado.user.id).toBe(gestora._id.toString());
  });

  it('descarta las cuentas suspendidas o con contraseña temporal', async () => {
    const suspendida = userDouble({ status: UserStatus.Suspended });
    const temporal = userDouble({ mustChangePassword: true });
    const buena = userDouble();
    const { service } = await build({ porRol: { student: [suspendida, temporal, buena] } });

    const resultado = await service.demoLogin(DemoRole.Student, CLIENT);

    expect(resultado.user.id).toBe(buena._id.toString());
  });

  it('avisa cuando la empresa de demostración no tiene esa cuenta', async () => {
    const { service } = await build({ porRol: { manager: [userDouble({ isPlatformAdmin: true })] } });

    await expect(service.demoLogin(DemoRole.Admin, CLIENT)).rejects.toThrow(/no tiene ninguna/i);
  });
});
