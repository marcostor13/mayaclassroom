import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { TenantStatus, UserStatus } from '@maya/shared';
import { AuthService } from './auth.service';
import { RefreshToken } from './schemas/refresh-token.schema';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { RolesService } from '../rbac/roles.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { MailService } from '../mail/mail.service';
import type { ForgotPasswordDto, LoginDto } from './dto/auth.dto';

/** `jest.Mock` no existe como tipo en bun-types: se deriva del propio `jest.fn`. */
type MockFn = ReturnType<typeof jest.fn>;

const CLIENT = { ip: '127.0.0.1', userAgent: 'pruebas' };

function tenantDouble(name: string, status = TenantStatus.Active) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    id: id.toString(),
    slug: name.toLowerCase(),
    name,
    status,
    branding: { logoUrl: null },
    settings: { requireEmailVerification: false },
  };
}

function userDouble(tenant: { _id: Types.ObjectId }, overrides: Record<string, unknown> = {}) {
  const id = new Types.ObjectId();
  return {
    _id: id,
    id: id.toString(),
    tenant: tenant._id,
    email: 'ana@ejemplo.com',
    username: 'ana',
    firstName: 'Ana',
    lastName: 'Pérez',
    passwordHash: 'hash',
    status: UserStatus.Active,
    twoFactorEnabled: false,
    lockedUntil: null,
    passwordResetToken: null as string | null,
    passwordResetExpires: null as Date | null,
    save: jest.fn(async () => undefined),
    ...overrides,
  };
}

/**
 * Monta el servicio con dobles. `verifyPassword` decide qué cuentas aceptan la
 * contraseña: recibe el hash de cada candidata, así que basta con listar los
 * hashes válidos para describir el escenario.
 */
async function build(options: {
  accounts?: ReturnType<typeof userDouble>[];
  tenants?: ReturnType<typeof tenantDouble>[];
  validHashes?: string[];
  registerFailedLogin?: MockFn;
}) {
  const accounts = options.accounts ?? [];
  const tenantsByAccount = options.tenants ?? [];
  const valid = options.validHashes ?? ['hash'];

  const users = {
    findAllByLogin: jest.fn(async () => accounts),
    findByLogin: jest.fn(async () => accounts[0] ?? null),
    findOneWithSecrets: jest.fn(async () => accounts[0] ?? null),
    verifyPassword: jest.fn(async (hash: string) => valid.includes(hash)),
    registerFailedLogin: options.registerFailedLogin ?? jest.fn(async () => undefined),
    touchLogin: jest.fn(async () => undefined),
  };
  const tenants = {
    findById: jest.fn(async (id: Types.ObjectId) => {
      const found = tenantsByAccount.find((t) => t._id.equals(id));
      if (!found) throw new Error('empresa inesperada en la prueba');
      return found;
    }),
    requireBySlug: jest.fn(async () => tenantsByAccount[0]),
  };
  const jwt = { signAsync: jest.fn(async () => 'testigo'), verifyAsync: jest.fn(async () => ({})) };
  const mail = { sendPasswordReset: jest.fn(async () => undefined) };
  const config = {
    getOrThrow: jest.fn((key: string) =>
      key === 'jwt'
        ? { accessSecret: 's', refreshSecret: 'r', accessExpires: '15m', refreshExpires: '30d' }
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
      { provide: TenantsService, useValue: tenants },
      { provide: RolesService, useValue: { rolesOfUserInContext: jest.fn(async () => []) } },
      { provide: AccessService, useValue: { capabilitiesOfUser: jest.fn(async () => []) } },
      { provide: ContextsService, useValue: { requireByInstance: jest.fn() } },
      { provide: JwtService, useValue: jwt },
      { provide: ConfigService, useValue: config },
      { provide: MailService, useValue: mail },
    ],
  }).compile();

  const service = moduleRef.get(AuthService);
  // `buildSessionUser` y `issueTokens` consultan media base de datos; para lo
  // que se prueba aquí —a qué empresa se resuelve la entrada— basta con
  // sustituirlos por marcadores.
  const sessionUser = jest.fn(async (id: Types.ObjectId) => ({ id: id.toString() }));
  Reflect.set(service, 'buildSessionUser', sessionUser);
  Reflect.set(service, 'issueTokens', jest.fn(async () => ({ accessToken: 'a' })));

  return { service, users, tenants, jwt, mail };
}

const credentials = { login: 'ana@ejemplo.com', password: 'Secreta123' } as LoginDto;

describe('AuthService · entrada sin indicar la empresa', () => {
  it('entra directamente cuando las credenciales solo valen en una empresa', async () => {
    const acme = tenantDouble('Acme');
    const { service, users } = await build({
      tenants: [acme],
      accounts: [userDouble(acme)],
    });

    const result = await service.login(credentials, CLIENT);

    expect(result.requiresTenantChoice).toBeUndefined();
    expect(result.tokens.accessToken).toBe('a');
    expect(users.touchLogin).toHaveBeenCalledTimes(1);
  });

  it('pide elegir cuando las mismas credenciales valen en varias empresas', async () => {
    const acme = tenantDouble('Acme');
    const globex = tenantDouble('Globex');
    const { service } = await build({
      tenants: [acme, globex],
      accounts: [userDouble(acme), userDouble(globex)],
    });

    const result = await service.login(credentials, CLIENT);

    expect(result.requiresTenantChoice).toBe(true);
    expect(result.tenantChoiceToken).toBe('testigo');
    expect(result.tenants?.map((t) => t.name)).toEqual(['Acme', 'Globex']);
    // Sin sesión todavía: elegir empresa es un paso previo, no una entrada.
    expect(result.tokens.accessToken).toBe('');
  });

  it('no revela las empresas donde existe el correo si la contraseña no vale', async () => {
    const acme = tenantDouble('Acme');
    const globex = tenantDouble('Globex');
    const { service } = await build({
      tenants: [acme, globex],
      accounts: [userDouble(acme), userDouble(globex)],
      validHashes: [],
    });

    await expect(service.login(credentials, CLIENT)).rejects.toThrow('Credenciales incorrectas.');
  });

  it('solo ofrece las empresas cuya contraseña coincide, no todas donde existe la cuenta', async () => {
    const acme = tenantDouble('Acme');
    const globex = tenantDouble('Globex');
    const { service } = await build({
      tenants: [acme, globex],
      accounts: [
        userDouble(acme, { passwordHash: 'buena' }),
        userDouble(globex, { passwordHash: 'otra' }),
      ],
      validHashes: ['buena'],
    });

    const result = await service.login(credentials, CLIENT);

    // Una sola coincidencia: se entra sin preguntar, y Globex nunca se nombra.
    expect(result.requiresTenantChoice).toBeUndefined();
    expect(result.tenants).toBeUndefined();
  });

  it('descarta las empresas suspendidas antes de comprobar nada', async () => {
    const acme = tenantDouble('Acme');
    const cerrada = tenantDouble('Cerrada', TenantStatus.Suspended);
    const { service } = await build({
      tenants: [acme, cerrada],
      accounts: [userDouble(acme), userDouble(cerrada)],
    });

    const result = await service.login(credentials, CLIENT);

    expect(result.requiresTenantChoice).toBeUndefined();
  });

  it('anota el intento fallido en todas las cuentas con ese correo', async () => {
    const acme = tenantDouble('Acme');
    const globex = tenantDouble('Globex');
    const registerFailedLogin = jest.fn(async () => undefined);
    const { service } = await build({
      tenants: [acme, globex],
      accounts: [userDouble(acme), userDouble(globex)],
      validHashes: [],
      registerFailedLogin,
    });

    await expect(service.login(credentials, CLIENT)).rejects.toThrow();
    expect(registerFailedLogin).toHaveBeenCalledTimes(2);
  });

  it('rechaza la elección de una empresa que no estaba entre las autorizadas', async () => {
    const acme = tenantDouble('Acme');
    const { service, users } = await build({ tenants: [acme], accounts: [userDouble(acme)] });
    users.findOneWithSecrets = jest.fn(async () => null);
    Reflect.set(service, 'jwt', {
      verifyAsync: jest.fn(async () => ({
        type: 'tenant-choice',
        users: [new Types.ObjectId().toString()],
      })),
    });

    await expect(
      service.chooseTenant('testigo', new Types.ObjectId().toString(), undefined, CLIENT),
    ).rejects.toThrow('no está entre las disponibles');
  });
});

describe('AuthService · recuperación de contraseña sin indicar la empresa', () => {
  const peticion = { email: 'ana@ejemplo.com' } as ForgotPasswordDto;

  it('envía un enlace por cada empresa donde exista el correo', async () => {
    const acme = tenantDouble('Acme');
    const globex = tenantDouble('Globex');
    const { service, mail } = await build({
      tenants: [acme, globex],
      accounts: [userDouble(acme), userDouble(globex)],
    });

    await service.forgotPassword(peticion);

    // Uno por empresa: cada enlace lleva dentro su cuenta, así que no hace
    // falta elegir como sí ocurre al entrar.
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(2);
  });

  it('no envía nada, y tampoco falla, cuando el correo no existe', async () => {
    const { service, mail } = await build({ tenants: [], accounts: [] });

    await expect(service.forgotPassword(peticion)).resolves.toBeUndefined();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('se salta las empresas cerradas', async () => {
    const acme = tenantDouble('Acme');
    const cerrada = tenantDouble('Cerrada', TenantStatus.Archived);
    const { service, mail } = await build({
      tenants: [acme, cerrada],
      accounts: [userDouble(acme), userDouble(cerrada)],
    });

    await service.forgotPassword(peticion);

    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
  });
});
