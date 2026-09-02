import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaymentProvider } from '@maya/shared';
import { PaymentsService } from './payments.service';
import { PaymentSettings } from './schemas/payment-settings.schema';
import { TenantsService } from '../tenants/tenants.service';
import { encryptSecret } from '../../common/utils';

const TENANT = new Types.ObjectId();
const CLAVE = 'secreto-de-firma-de-sesion-suficientemente-largo';

function settingsDouble(base: Record<string, unknown> = {}) {
  return {
    tenant: TENANT,
    currency: 'EUR',
    mercadoPago: { enabled: false, publicKey: null, accessToken: null, sandbox: true },
    paypal: { enabled: false, clientId: null, secret: null, sandbox: true },
    manual: { enabled: false, instructions: null },
    save: jest.fn(async () => undefined),
    ...base,
  };
}

async function build(doc: ReturnType<typeof settingsDouble>) {
  const model = {
    findOne: jest.fn(() => ({
      exec: async () => doc,
      select: () => ({ exec: async () => doc }),
    })),
    create: jest.fn(async () => doc),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      PaymentsService,
      { provide: getModelToken(PaymentSettings.name), useValue: model },
      { provide: ConfigService, useValue: { getOrThrow: () => ({ accessSecret: CLAVE }) } },
      { provide: TenantsService, useValue: { requireBySlug: jest.fn(async () => ({ _id: TENANT })) } },
    ],
  }).compile();

  return { service: moduleRef.get(PaymentsService), model, doc };
}

describe('PaymentsService · los secretos no salen', () => {
  it('el DTO dice si la credencial existe pero nunca la enseña', async () => {
    const doc = settingsDouble({
      mercadoPago: {
        enabled: true,
        publicKey: 'APP_USR-publica',
        accessToken: encryptSecret('APP_USR-SECRETA', CLAVE),
        sandbox: false,
      },
    });
    const { service } = await build(doc);

    const dto = service.toDto(doc as never);

    expect(dto.mercadoPago.hasAccessToken).toBe(true);
    expect(JSON.stringify(dto)).not.toContain('SECRETA');
    // La clave pública sí viaja: la usa el navegador del comprador.
    expect(dto.mercadoPago.publicKey).toBe('APP_USR-publica');
  });

  it('guarda el token cifrado, no en claro', async () => {
    const doc = settingsDouble({ mercadoPago: { enabled: true, publicKey: null, accessToken: null, sandbox: true } });
    const { service } = await build(doc);

    await service.update(TENANT, { mercadoPago: { accessToken: 'APP_USR-SECRETA' } });

    expect(doc.mercadoPago.accessToken).not.toBe('APP_USR-SECRETA');
    expect(doc.mercadoPago.accessToken).toContain('enc:v1:');
  });

  it('no toca la credencial guardada cuando el formulario no la envía', async () => {
    const cifrado = encryptSecret('APP_USR-SECRETA', CLAVE);
    const doc = settingsDouble({
      mercadoPago: { enabled: false, publicKey: null, accessToken: cifrado, sandbox: true },
    });
    const { service } = await build(doc);

    await service.update(TENANT, { mercadoPago: { enabled: true } });

    expect(doc.mercadoPago.accessToken).toBe(cifrado);
    expect(doc.mercadoPago.enabled).toBe(true);
  });

  it('una cadena vacía borra la credencial', async () => {
    const doc = settingsDouble({
      mercadoPago: {
        enabled: true,
        publicKey: null,
        accessToken: encryptSecret('APP_USR-SECRETA', CLAVE),
        sandbox: true,
      },
    });
    const { service } = await build(doc);

    await service.update(TENANT, { mercadoPago: { accessToken: '' } });

    expect(doc.mercadoPago.accessToken).toBeNull();
  });
});

describe('PaymentsService · qué formas de pago se ofrecen', () => {
  it('no ofrece una pasarela activada pero sin credenciales', async () => {
    const { service } = await build(
      settingsDouble({ mercadoPago: { enabled: true, publicKey: 'pk', accessToken: null, sandbox: true } }),
    );

    expect(await service.publicMethods(TENANT)).toEqual([]);
  });

  it('ofrece las pasarelas completas y la transferencia', async () => {
    const { service } = await build(
      settingsDouble({
        mercadoPago: {
          enabled: true,
          publicKey: 'pk',
          accessToken: encryptSecret('token', CLAVE),
          sandbox: true,
        },
        paypal: {
          enabled: true,
          clientId: 'cid',
          secret: encryptSecret('sec', CLAVE),
          sandbox: false,
        },
        manual: { enabled: true, instructions: 'Transferencia a ES00' },
      }),
    );

    const metodos = await service.publicMethods(TENANT);

    expect(metodos.map((m) => m.provider)).toEqual([
      PaymentProvider.MercadoPago,
      PaymentProvider.PayPal,
      PaymentProvider.Manual,
    ]);
    expect(JSON.stringify(metodos)).not.toContain('token');
    expect(JSON.stringify(metodos)).not.toContain('sec');
  });

  it('no construye la pasarela si le falta la mitad de las credenciales', async () => {
    const { service } = await build(
      settingsDouble({ paypal: { enabled: true, clientId: 'cid', secret: null, sandbox: true } }),
    );

    expect(await service.gatewayFor(TENANT, PaymentProvider.PayPal)).toBeNull();
  });
});
