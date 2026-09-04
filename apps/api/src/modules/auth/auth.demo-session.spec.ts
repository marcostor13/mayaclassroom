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
const TENANT = { _id: new Types.ObjectId(), slug: 'demo', name: 'Dulce Lima' };

const gestora = {
  _id: new Types.ObjectId(),
  id: '',
  tenant: TENANT._id,
  email: 'gestora@dulcelima.pe',
  status: UserStatus.Active,
  isPlatformAdmin: false,
  mustChangePassword: false,
};
gestora.id = gestora._id.toString();

/**
 * Monta el servicio con `issueTokens` **de verdad**: lo que se comprueba aquí
 * es justo lo que ese método escribe en el testigo y en la base.
 */
async function build() {
  /** Payloads firmados, en orden. */
  const firmados: Record<string, unknown>[] = [];
  /** Documentos de refresco creados, en orden. */
  const refrescos: Record<string, unknown>[] = [];
  /** El documento que `refresh()` encontrará. */
  let guardado: Record<string, unknown> | null = null;

  const refreshModel = {
    create: async (doc: Record<string, unknown>) => {
      refrescos.push(doc);
      return doc;
    },
    findOne: () => ({ exec: async () => guardado }),
    updateMany: () => ({ exec: async () => undefined }),
  };

  const config = {
    getOrThrow: (key: string) =>
      key === 'jwt'
        ? {
            accessSecret: 's',
            refreshSecret: 'r',
            accessExpiresIn: '15m',
            refreshExpiresIn: '30d',
            issuer: 'maya',
            audience: 'maya',
          }
        : key === 'demo'
          ? { enabled: true, tenantSlug: 'demo' }
          : key === 'security'
            ? { refreshTokenRotation: true, loginMaxAttempts: 5, loginLockMinutes: 15 }
            : { url: 'http://localhost' },
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: getModelToken(RefreshToken.name), useValue: refreshModel },
      {
        provide: UsersService,
        useValue: {
          findById: async () => gestora,
          touchLogin: async () => undefined,
        },
      },
      {
        provide: TenantsService,
        useValue: {
          requireBySlug: async () => TENANT,
          findById: async () => TENANT,
        },
      },
      {
        provide: RolesService,
        useValue: { assigneesByShortName: async () => [gestora._id] },
      },
      { provide: AccessService, useValue: {} },
      {
        provide: ContextsService,
        useValue: { requireByInstance: async () => ({ _id: new Types.ObjectId() }) },
      },
      {
        provide: JwtService,
        useValue: {
          signAsync: async (payload: Record<string, unknown>) => {
            firmados.push(payload);
            return `firmado-${firmados.length}`;
          },
        },
      },
      { provide: ConfigService, useValue: config },
      { provide: MailService, useValue: {} },
    ],
  }).compile();

  const service = moduleRef.get(AuthService);
  Reflect.set(service, 'buildSessionUser', async () => ({ id: gestora.id }));

  return {
    service,
    firmados,
    refrescos,
    /** Deja preparado el documento con el que se pedirá la renovación. */
    prepararRefresco(doc: Record<string, unknown>) {
      guardado = { revokedAt: null, expiresAt: new Date(Date.now() + 60_000), save: async () => undefined, ...doc };
    },
  };
}

describe('AuthService · la marca de demostración en la sesión', () => {
  it('marca el testigo y el refresco al entrar en la demostración', async () => {
    const { service, firmados, refrescos } = await build();

    await service.demoLogin(DemoRole.Admin, CLIENT);

    expect(firmados[0]).toMatchObject({ demo: true, type: 'access' });
    expect(refrescos[0]).toMatchObject({ demo: true });
  });

  it('una entrada normal no queda marcada', async () => {
    // La marca es de la sesión, no de la cuenta: la misma gestora entrando con
    // su contraseña no debe salir limitada.
    const { service, firmados, refrescos } = await build();

    await service.issueTokens(gestora as never, CLIENT, 'familia-1');

    expect(firmados[0].demo).toBeUndefined();
    expect(refrescos[0]).toMatchObject({ demo: false });
  });

  it('renovar conserva la marca', async () => {
    // Sin esto, esperar a que caduque el testigo de acceso convertía una
    // sesión de demostración en una de gestión con todas las capacidades:
    // la forma más silenciosa de saltarse el guard.
    const { service, firmados, refrescos, prepararRefresco } = await build();
    prepararRefresco({ user: gestora._id, familyId: 'familia-1', demo: true });

    await service.refresh('el-testigo', CLIENT);

    expect(firmados[0]).toMatchObject({ demo: true });
    expect(refrescos[0]).toMatchObject({ demo: true });
  });

  it('renovar una sesión normal sigue sin marcarla', async () => {
    const { service, firmados, refrescos, prepararRefresco } = await build();
    prepararRefresco({ user: gestora._id, familyId: 'familia-1', demo: false });

    await service.refresh('el-testigo', CLIENT);

    expect(firmados[0].demo).toBeUndefined();
    expect(refrescos[0]).toMatchObject({ demo: false });
  });
});
