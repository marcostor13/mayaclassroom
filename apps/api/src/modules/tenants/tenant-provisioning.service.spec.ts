import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UserStatus } from '@maya/shared';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantsService } from './tenants.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import type { CreateTenantDto } from './dto/tenant.dto';

/** `jest.Mock` no existe como tipo en bun-types: se deriva del propio `jest.fn`. */
type MockFn = ReturnType<typeof jest.fn>;

const TENANT_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();

const defaultPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: false,
  expiryDays: 0,
};

/** Empresa recién creada tal como la devuelve `TenantsService.create`. */
function tenantDouble(policy: Partial<typeof defaultPolicy> = {}) {
  return {
    _id: TENANT_ID,
    id: TENANT_ID.toString(),
    slug: 'acme',
    name: 'ACME Formación',
    contactEmail: 'contacto@acme.com',
    settings: {
      defaultLanguage: 'es',
      timezone: 'Europe/Madrid',
      passwordPolicy: { ...defaultPolicy, ...policy },
    },
    toJSON: () => ({ id: TENANT_ID.toString(), slug: 'acme', name: 'ACME Formación' }),
  };
}

function userDouble(dto: { email: string; username: string }) {
  return {
    _id: USER_ID,
    id: USER_ID.toString(),
    email: dto.email,
    username: dto.username,
    emailVerified: false,
    save: jest.fn(async () => undefined),
  };
}

async function build(options: {
  tenant?: ReturnType<typeof tenantDouble>;
  createUser?: MockFn;
  sendMail?: MockFn;
  purge?: MockFn;
}) {
  const tenant = options.tenant ?? tenantDouble();
  const tenants = {
    create: jest.fn(async () => tenant),
    purge: options.purge ?? jest.fn(async () => undefined),
  };
  const users = {
    create:
      options.createUser ??
      jest.fn(async (_tenantId: unknown, dto: { email: string; username: string }) =>
        userDouble(dto),
      ),
  };
  const mail = { sendTenantAdminWelcome: options.sendMail ?? jest.fn(async () => undefined) };

  const moduleRef = await Test.createTestingModule({
    providers: [
      TenantProvisioningService,
      { provide: TenantsService, useValue: tenants },
      { provide: UsersService, useValue: users },
      { provide: MailService, useValue: mail },
    ],
  }).compile();

  return {
    service: moduleRef.get(TenantProvisioningService),
    tenants,
    users,
    mail,
  };
}

const baseDto = {
  slug: 'acme',
  name: 'ACME Formación',
  contactEmail: 'contacto@acme.com',
} as CreateTenantDto;

describe('TenantProvisioningService · alta de empresa con administrador', () => {
  it('crea la cuenta de administración a partir del correo de contacto', async () => {
    const { service, users } = await build({});

    const result = await service.createTenantWithAdmin(baseDto);

    expect(users.create).toHaveBeenCalledTimes(1);
    const [tenantId, dto] = users.create.mock.calls[0] as [Types.ObjectId, Record<string, unknown>];
    expect(tenantId).toBe(TENANT_ID);
    expect(dto.email).toBe('contacto@acme.com');
    expect(dto.username).toBe('contacto');
    expect(dto.initialRole).toBe('manager');
    expect(dto.status).toBe(UserStatus.Active);
    expect(dto.mustChangePassword).toBe(true);

    expect(result.admin.email).toBe('contacto@acme.com');
    expect(result.admin.emailSent).toBe(true);
  });

  it('prefiere los datos explícitos del administrador cuando se envían', async () => {
    const { service, users } = await build({});

    await service.createTenantWithAdmin({
      ...baseDto,
      adminEmail: 'Ana.Perez@ACME.com',
      adminUsername: 'ana.perez',
      adminFirstName: 'Ana',
      adminLastName: 'Pérez',
    } as CreateTenantDto);

    const [, dto] = users.create.mock.calls[0] as [Types.ObjectId, Record<string, unknown>];
    expect(dto.email).toBe('ana.perez@acme.com');
    expect(dto.username).toBe('ana.perez');
    expect(dto.firstName).toBe('Ana');
    expect(dto.lastName).toBe('Pérez');
  });

  it('la contraseña temporal cumple la política de la empresa', async () => {
    const { service, users } = await build({
      tenant: tenantDouble({ minLength: 20, requireSymbol: true }),
    });

    await service.createTenantWithAdmin(baseDto);

    const [, dto] = users.create.mock.calls[0] as [Types.ObjectId, { password: string }];
    expect(dto.password.length).toBeGreaterThanOrEqual(20);
    expect(dto.password).toMatch(/[A-Z]/);
    expect(dto.password).toMatch(/[0-9]/);
    expect(dto.password).toMatch(/[^A-Za-z0-9]/);
  });

  it('la contraseña temporal no se repite entre altas', async () => {
    const { service, users } = await build({});

    await service.createTenantWithAdmin(baseDto);
    await service.createTenantWithAdmin(baseDto);

    const [, first] = users.create.mock.calls[0] as [Types.ObjectId, { password: string }];
    const [, second] = users.create.mock.calls[1] as [Types.ObjectId, { password: string }];
    expect(first.password).not.toBe(second.password);
  });

  it('devuelve la contraseña temporal para poder entregarla', async () => {
    const { service, users } = await build({});

    const result = await service.createTenantWithAdmin(baseDto);

    const [, dto] = users.create.mock.calls[0] as [Types.ObjectId, { password: string }];
    expect(result.admin.temporaryPassword).toBe(dto.password);
  });

  it('deshace el alta si la cuenta de administración no se puede crear', async () => {
    const purge = jest.fn(async () => undefined);
    const { service, tenants } = await build({
      purge,
      createUser: jest.fn(async () => {
        throw new Error('correo duplicado');
      }),
    });

    await expect(service.createTenantWithAdmin(baseDto)).rejects.toThrow('correo duplicado');
    expect(tenants.purge).toHaveBeenCalledWith(TENANT_ID);
  });

  it('mantiene el alta aunque falle el correo de bienvenida, avisando de ello', async () => {
    const { service, tenants } = await build({
      sendMail: jest.fn(async () => {
        throw new Error('SMTP caído');
      }),
    });

    const result = await service.createTenantWithAdmin(baseDto);

    expect(result.admin.emailSent).toBe(false);
    expect(result.admin.temporaryPassword).toHaveLength(14);
    expect(tenants.purge).not.toHaveBeenCalled();
  });
});
