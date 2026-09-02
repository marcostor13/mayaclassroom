import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { OrderStatus, PaymentProvider } from '@maya/shared';
import { OrdersService } from './orders.service';
import { Order } from './schemas/order.schema';
import { PaymentsService } from './payments.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { MailService } from '../mail/mail.service';
import { SiteService } from '../site/site.service';
import type { CreateCheckoutDto } from './dto/commerce.dto';

type MockFn = ReturnType<typeof jest.fn>;

const TENANT = new Types.ObjectId();
const COURSE = new Types.ObjectId();
const USER = new Types.ObjectId();

const tenantDouble = {
  _id: TENANT,
  id: TENANT.toString(),
  slug: 'acme',
  name: 'Acme',
};

function courseDouble(priceCents: number) {
  return {
    _id: COURSE,
    id: COURSE.toString(),
    fullName: 'Curso de prueba',
    summary: null,
    catalog: { priceCents, currency: 'EUR', headline: null },
  };
}

/**
 * Doble de pedido: se comporta como un documento de Mongoose al guardarse.
 * Los valores por defecto del esquema se replican aquí; sin ellos el doble
 * devuelve `undefined` donde la base devolvería `false`.
 */
function orderDouble(base: Record<string, unknown>): Record<string, unknown> & {
  save: MockFn;
  get: () => Date;
} {
  return {
    enrolled: false,
    providerReference: null,
    providerPaymentId: null,
    paidAt: null,
    note: null,
    user: null,
    ...base,
    id: 'order-1',
    tenant: TENANT,
    course: COURSE,
    save: jest.fn(async () => undefined) as MockFn,
    get: () => new Date(),
  };
}

async function build(options: {
  priceCents: number;
  manualEnabled?: boolean;
  simulationEnabled?: boolean;
  gateway?: unknown;
  existingUser?: unknown;
}) {
  let creado: ReturnType<typeof orderDouble> | null = null;

  const model = {
    create: jest.fn(async (doc: Record<string, unknown>) => {
      creado = orderDouble(doc);
      return creado;
    }),
    findOne: jest.fn(() => ({ exec: async () => creado })),
    find: jest.fn(() => ({
      sort: () => ({ limit: () => ({ exec: async () => [] }) }),
    })),
    countDocuments: jest.fn(() => ({ exec: async () => 0 })),
  };

  const users = {
    findByEmail: jest.fn(async () => options.existingUser ?? null),
    create: jest.fn(async () => ({ _id: USER, id: USER.toString(), email: 'ana@ejemplo.com' })),
    setTemporaryPassword: jest.fn(async () => undefined),
  };
  const enrolments = { enrol: jest.fn(async () => ({})) };
  const mail = { sendCourseAccess: jest.fn(async () => undefined) };
  const tenants = {
    requireBySlug: jest.fn(async () => tenantDouble),
    findById: jest.fn(async () => tenantDouble),
  };
  const site = { findListedCourse: jest.fn(async () => courseDouble(options.priceCents)) };
  const payments = {
    currencyOf: jest.fn(async () => 'EUR'),
    forTenant: jest.fn(async () => ({ manual: { enabled: options.manualEnabled ?? false, instructions: null } })),
    gatewayFor: jest.fn(async () => options.gateway ?? null),
    simulationEnabled: jest.fn(async () => options.simulationEnabled ?? false),
  };
  const config = {
    getOrThrow: jest.fn(() => ({ webUrl: 'https://maya.test', url: 'https://api.maya.test' })),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: getModelToken(Order.name), useValue: model },
      { provide: TenantsService, useValue: tenants },
      { provide: UsersService, useValue: users },
      { provide: EnrolmentsService, useValue: enrolments },
      { provide: PaymentsService, useValue: payments },
      { provide: SiteService, useValue: site },
      { provide: MailService, useValue: mail },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  return {
    service: moduleRef.get(OrdersService),
    model,
    users,
    enrolments,
    mail,
    payments,
    pedido: () => creado,
  };
}

const compra = {
  courseId: COURSE.toString(),
  provider: PaymentProvider.MercadoPago,
  firstName: 'Ana',
  lastName: 'Ruiz',
  email: 'Ana@Ejemplo.com',
} as CreateCheckoutDto;

describe('OrdersService · compra', () => {
  it('matricula al momento cuando el curso es gratuito, sin pasar por la pasarela', async () => {
    const { service, users, enrolments, payments, pedido } = await build({ priceCents: 0 });

    const session = await service.checkout('acme', compra);

    expect(session.status).toBe(OrderStatus.Paid);
    expect(session.redirectUrl).toBeNull();
    expect(payments.gatewayFor).not.toHaveBeenCalled();
    expect(users.create).toHaveBeenCalled();
    expect(enrolments.enrol).toHaveBeenCalled();
    expect(pedido()?.provider).toBe(PaymentProvider.Free);
  });

  it('normaliza el correo del comprador a minúsculas', async () => {
    const { service, pedido } = await build({ priceCents: 0 });
    await service.checkout('acme', compra);
    expect((pedido()?.buyer as { email: string }).email).toBe('ana@ejemplo.com');
  });

  it('reutiliza la cuenta existente en lugar de crear una segunda', async () => {
    const { service, users, enrolments } = await build({
      priceCents: 0,
      existingUser: { _id: USER, id: USER.toString(), email: 'ana@ejemplo.com' },
    });

    await service.checkout('acme', compra);

    expect(users.create).not.toHaveBeenCalled();
    expect(enrolments.enrol).toHaveBeenCalled();
  });

  it('rechaza el pago manual si la empresa no lo tiene activado', async () => {
    const { service } = await build({ priceCents: 4900, manualEnabled: false });

    await expect(
      service.checkout('acme', { ...compra, provider: PaymentProvider.Manual }),
    ).rejects.toThrow(/no está disponible/i);
  });

  it('deja el pedido pendiente y sin matrícula con el pago por transferencia', async () => {
    const { service, enrolments, pedido } = await build({ priceCents: 4900, manualEnabled: true });

    const session = await service.checkout('acme', { ...compra, provider: PaymentProvider.Manual });

    expect(session.status).toBe(OrderStatus.Pending);
    expect(enrolments.enrol).not.toHaveBeenCalled();
    expect(pedido()?.enrolled).toBeFalsy();
  });

  it('rechaza la compra cuando la pasarela elegida no está configurada', async () => {
    const { service } = await build({ priceCents: 4900, gateway: null });
    await expect(service.checkout('acme', compra)).rejects.toThrow(/no está disponible/i);
  });

  it('manda a la pasarela y guarda su referencia cuando el curso es de pago', async () => {
    const createCharge: MockFn = jest.fn(async () => ({
      reference: 'pref-123',
      redirectUrl: 'https://pasarela.test/pagar',
    }));
    const { service, pedido } = await build({
      priceCents: 4900,
      gateway: { provider: PaymentProvider.MercadoPago, sandbox: true, gateway: { createCharge } },
    });

    const session = await service.checkout('acme', compra);

    expect(session.redirectUrl).toBe('https://pasarela.test/pagar');
    expect(pedido()?.providerReference).toBe('pref-123');
    expect(createCharge).toHaveBeenCalled();
  });

  it('marca el pedido como fallido si la pasarela no responde', async () => {
    const createCharge: MockFn = jest.fn(async () => {
      throw new Error('502 desde la pasarela');
    });
    const { service, pedido } = await build({
      priceCents: 4900,
      gateway: { provider: PaymentProvider.MercadoPago, sandbox: true, gateway: { createCharge } },
    });

    await expect(service.checkout('acme', compra)).rejects.toThrow(/no se ha podido iniciar/i);
    expect(pedido()?.status).toBe(OrderStatus.Failed);
  });
});

describe('OrdersService · confirmación', () => {
  it('no vuelve a matricular ni a avisar un pedido ya servido', async () => {
    const { service, enrolments, mail } = await build({ priceCents: 0 });
    await service.checkout('acme', compra);

    enrolments.enrol.mockClear();
    mail.sendCourseAccess.mockClear();

    // El mismo pedido llega otra vez: por la vuelta del comprador y por el
    // aviso automático de la pasarela.
    await service.resolveReturn('acme', 'MC-XXXXXX');

    expect(enrolments.enrol).not.toHaveBeenCalled();
    expect(mail.sendCourseAccess).not.toHaveBeenCalled();
  });

  it('solo da por pagado lo que confirma la pasarela, no la vuelta del navegador', async () => {
    const confirm: MockFn = jest.fn(async () => ({ paid: false, failed: false, paymentId: null }));
    const { service, enrolments } = await build({
      priceCents: 4900,
      gateway: {
        provider: PaymentProvider.MercadoPago,
        sandbox: true,
        gateway: {
          createCharge: jest.fn(async () => ({ reference: 'pref-1', redirectUrl: 'https://x.test' })),
          confirm,
        },
      },
    });
    await service.checkout('acme', compra);

    const resultado = await service.resolveReturn('acme', 'MC-XXXXXX');

    expect(confirm).toHaveBeenCalledWith('pref-1');
    expect(resultado.enrolled).toBe(false);
    expect(enrolments.enrol).not.toHaveBeenCalled();
  });

  it('matricula cuando la pasarela confirma el cobro', async () => {
    const confirm: MockFn = jest.fn(async () => ({ paid: true, failed: false, paymentId: 'pay-9' }));
    const { service, enrolments, mail } = await build({
      priceCents: 4900,
      gateway: {
        provider: PaymentProvider.MercadoPago,
        sandbox: true,
        gateway: {
          createCharge: jest.fn(async () => ({ reference: 'pref-1', redirectUrl: 'https://x.test' })),
          confirm,
        },
      },
    });
    await service.checkout('acme', compra);

    const resultado = await service.resolveReturn('acme', 'MC-XXXXXX');

    expect(resultado.enrolled).toBe(true);
    expect(resultado.order.status).toBe(OrderStatus.Paid);
    expect(enrolments.enrol).toHaveBeenCalled();
    expect(mail.sendCourseAccess).toHaveBeenCalled();
  });
});


describe('OrdersService · pasarela de prueba', () => {
  const compraSimulada = { ...compra, provider: PaymentProvider.Simulated };

  it('no la ofrece si la empresa no la ha activado', async () => {
    const { service } = await build({ priceCents: 4900, simulationEnabled: false });

    await expect(service.checkout('acme', compraSimulada)).rejects.toThrow(/no está disponible/i);
  });

  it('manda a la pantalla de prueba en vez de matricular al comprar', async () => {
    const { service, enrolments, pedido } = await build({
      priceCents: 4900,
      simulationEnabled: true,
    });

    const session = await service.checkout('acme', compraSimulada);

    expect(session.redirectUrl).toContain('/pago-prueba/');
    expect(session.status).toBe(OrderStatus.Pending);
    // El circuito entero es la gracia: matricular aquí sería un atajo.
    expect(enrolments.enrol).not.toHaveBeenCalled();
    expect(pedido()?.enrolled).toBe(false);
  });

  it('matricula al aprobar el pago simulado', async () => {
    const { service, enrolments, mail } = await build({
      priceCents: 4900,
      simulationEnabled: true,
    });
    await service.checkout('acme', compraSimulada);

    const resultado = await service.simulate('acme', 'MC-XXXXXX', true);

    expect(resultado.enrolled).toBe(true);
    expect(resultado.order.status).toBe(OrderStatus.Paid);
    expect(enrolments.enrol).toHaveBeenCalled();
    expect(mail.sendCourseAccess).toHaveBeenCalled();
  });

  it('deja el pedido fallido al rechazar el pago simulado', async () => {
    const { service, enrolments } = await build({ priceCents: 4900, simulationEnabled: true });
    await service.checkout('acme', compraSimulada);

    const resultado = await service.simulate('acme', 'MC-XXXXXX', false);

    expect(resultado.order.status).toBe(OrderStatus.Failed);
    expect(resultado.enrolled).toBe(false);
    expect(enrolments.enrol).not.toHaveBeenCalled();
  });

  it('rechaza simular un pedido que no es de la pasarela de prueba', async () => {
    // El caso que convertiría esta ruta en una matrícula gratis: un pedido
    // creado contra una pasarela real y resuelto por la vía simulada.
    const { service } = await build({
      priceCents: 4900,
      simulationEnabled: true,
      manualEnabled: true,
    });
    await service.checkout('acme', { ...compra, provider: PaymentProvider.Manual });

    await expect(service.simulate('acme', 'MC-XXXXXX', true)).rejects.toThrow(
      /no es de la pasarela de prueba/i,
    );
  });

  it('rechaza simular si la empresa apagó la pasarela después de crear el pedido', async () => {
    const { service, payments } = await build({ priceCents: 4900, simulationEnabled: true });
    await service.checkout('acme', compraSimulada);

    payments.simulationEnabled.mockImplementation(async () => false);

    await expect(service.simulate('acme', 'MC-XXXXXX', true)).rejects.toThrow(/no está activada/i);
  });

  it('no vuelve a matricular un pedido simulado ya resuelto', async () => {
    const { service, enrolments } = await build({ priceCents: 4900, simulationEnabled: true });
    await service.checkout('acme', compraSimulada);
    await service.simulate('acme', 'MC-XXXXXX', true);

    enrolments.enrol.mockClear();
    await service.simulate('acme', 'MC-XXXXXX', true);

    expect(enrolments.enrol).not.toHaveBeenCalled();
  });
});
