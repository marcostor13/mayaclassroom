import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OrderStatus, PaymentProvider, UserStatus } from '@maya/shared';
import type { CheckoutResult, CheckoutSession, OrderDto } from '@maya/shared';
import type { AppConfig } from '../../config';
import { generateTemporaryPassword, orderReference, toObjectId } from '../../common/utils';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { MailService } from '../mail/mail.service';
import { SiteService } from '../site/site.service';
import { Order, OrderDocument } from './schemas/order.schema';
import { PaymentsService } from './payments.service';
import type { CreateCheckoutDto, UpdateOrderStatusDto } from './dto/commerce.dto';

/**
 * Compra de cursos.
 *
 * El pedido se crea **antes** de mandar a nadie a la pasarela. Si el comprador
 * cierra la pestaña a medio pagar queda un pedido pendiente que se puede
 * conciliar; creándolo solo a la vuelta, esa venta desaparecería sin rastro.
 *
 * La matrícula la hace `fulfil`, que es idempotente: la misma compra llega por
 * dos caminos —el comprador que vuelve y el aviso automático de la pasarela—
 * y el que llegue segundo no debe duplicar nada.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly model: Model<OrderDocument>,
    private readonly tenants: TenantsService,
    private readonly users: UsersService,
    private readonly enrolments: EnrolmentsService,
    private readonly payments: PaymentsService,
    private readonly site: SiteService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private get webUrl(): string {
    return this.config.getOrThrow<AppConfig>('app').webUrl;
  }

  /* --------------------------------- Compra ------------------------------- */

  async checkout(slug: string, dto: CreateCheckoutDto): Promise<CheckoutSession> {
    const tenant = await this.tenants.requireBySlug(slug);
    const course = await this.site.findListedCourse(tenant._id, dto.courseId);

    const currency = (
      course.catalog.currency || (await this.payments.currencyOf(tenant._id))
    ).toUpperCase();
    const amountCents = course.catalog.priceCents;

    const order = await this.model.create({
      tenant: tenant._id,
      reference: orderReference(),
      course: course._id,
      courseTitle: course.fullName,
      buyer: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email: dto.email.toLowerCase().trim(),
        phone: dto.phone ?? null,
      },
      amountCents,
      currency,
      // Un curso gratuito no pasa por pasarela por mucho que la ficha ofrezca
      // una: no hay nada que cobrar y hacer esperar pierde a quien ya decidió.
      provider: amountCents <= 0 ? PaymentProvider.Free : dto.provider,
      status: OrderStatus.Pending,
    });

    if (amountCents <= 0) {
      await this.fulfil(order);
      return this.session(order, {
        message: 'Ya está matriculado. Le hemos enviado por correo sus datos de acceso.',
      });
    }

    if (order.provider === PaymentProvider.Manual) {
      const settings = await this.payments.forTenant(tenant._id);
      if (!settings.manual.enabled) {
        throw new BadRequestException('Esa forma de pago no está disponible.');
      }
      return this.session(order, {
        message:
          settings.manual.instructions ??
          'Le escribiremos con los datos para hacer la transferencia.',
      });
    }

    if (order.provider === PaymentProvider.Simulated) {
      if (!(await this.payments.simulationEnabled(tenant._id))) {
        throw new BadRequestException('Esa forma de pago no está disponible.');
      }
      // Se manda a una pantalla propia que imita a la pasarela en vez de
      // matricular aquí mismo: lo que se quiere enseñar es el circuito
      // entero —salir, decidir y volver—, no un atajo.
      return this.session(order, {
        redirectUrl: `${this.webUrl}/p/${tenant.slug}/pago-prueba/${order.reference}`,
        message: 'Pasarela de prueba: no se cobrará nada.',
      });
    }

    const resolved = await this.payments.gatewayFor(tenant._id, order.provider);
    if (!resolved) {
      throw new BadRequestException('Esa forma de pago no está disponible.');
    }

    const base = `${this.webUrl}/p/${tenant.slug}`;
    try {
      const charge = await resolved.gateway.createCharge({
        title: course.fullName,
        description: course.catalog.headline ?? course.summary ?? null,
        amountCents,
        currency,
        orderReference: order.reference,
        buyer: {
          firstName: order.buyer.firstName,
          lastName: order.buyer.lastName,
          email: order.buyer.email,
        },
        returnUrl: `${base}/pedido/${order.reference}`,
        cancelUrl: `${base}/pedido/${order.reference}?cancelado=1`,
        notificationUrl: `${this.config.getOrThrow<AppConfig>('app').url}/api/v1/site/public/${tenant.slug}/webhooks/${order.provider}`,
        brandName: tenant.name,
      });

      order.providerReference = charge.reference;
      await order.save();
      return this.session(order, {
        redirectUrl: charge.redirectUrl,
        message: 'Le llevamos a la pasarela para completar el pago.',
      });
    } catch (error) {
      order.status = OrderStatus.Failed;
      order.note = error instanceof Error ? error.message.slice(0, 400) : 'Error desconocido';
      await order.save();
      this.logger.error(`No se pudo iniciar el cobro ${order.reference}: ${String(error)}`);
      throw new BadRequestException(
        'No se ha podido iniciar el pago. Inténtelo de nuevo en unos minutos.',
      );
    }
  }

  private session(order: OrderDocument, extra: Partial<CheckoutSession>): CheckoutSession {
    return {
      orderId: order.id as string,
      reference: order.reference,
      provider: order.provider,
      status: order.status,
      redirectUrl: null,
      providerReference: order.providerReference,
      message: '',
      ...extra,
    };
  }

  /**
   * Estado de la compra al volver de la pasarela.
   *
   * Se pregunta a la pasarela en lugar de fiarse de lo que traiga la dirección
   * de vuelta: esa dirección la controla el navegador y cualquiera podría
   * escribirla a mano para darse una matrícula.
   */
  async resolveReturn(slug: string, reference: string): Promise<CheckoutResult> {
    const tenant = await this.tenants.requireBySlug(slug);
    const order = await this.requireOrder(tenant._id, reference);

    // La simulada no tiene a quién preguntar: la resuelve `simulate`.
    if (
      order.status === OrderStatus.Pending &&
      order.providerReference &&
      order.provider !== PaymentProvider.Simulated
    ) {
      const resolved = await this.payments.gatewayFor(tenant._id, order.provider);
      if (resolved) {
        const status = await resolved.gateway.confirm(order.providerReference);
        if (status.paid) {
          order.providerPaymentId = status.paymentId ?? order.providerPaymentId;
          await this.fulfil(order);
        } else if (status.failed) {
          order.status = OrderStatus.Failed;
          await order.save();
        }
      }
    }

    return {
      order: this.toDto(order),
      enrolled: order.enrolled,
      email: order.buyer.email,
      message: this.messageFor(order),
    };
  }

  /**
   * Resuelve un pedido de la pasarela simulada.
   *
   * Tres condiciones, y las tres se comprueban aquí y no en el cliente: el
   * pedido tiene que ser de la pasarela simulada, la empresa tiene que
   * tenerla encendida y el pedido tiene que seguir pendiente. Sin eso, esta
   * ruta sería una forma de matricularse gratis en cualquier curso.
   */
  async simulate(slug: string, reference: string, approve: boolean): Promise<CheckoutResult> {
    const tenant = await this.tenants.requireBySlug(slug);
    const order = await this.requireOrder(tenant._id, reference);

    if (order.provider !== PaymentProvider.Simulated) {
      throw new BadRequestException('Este pedido no es de la pasarela de prueba.');
    }
    if (!(await this.payments.simulationEnabled(tenant._id))) {
      throw new BadRequestException('La pasarela de prueba no está activada.');
    }

    if (order.status === OrderStatus.Pending) {
      if (approve) {
        await this.fulfil(order);
      } else {
        order.status = OrderStatus.Failed;
        order.note = 'Pago rechazado en la pasarela de prueba.';
        await order.save();
      }
    }

    return {
      order: this.toDto(order),
      enrolled: order.enrolled,
      email: order.buyer.email,
      message: this.messageFor(order),
    };
  }

  private messageFor(order: OrderDocument): string {
    switch (order.status) {
      case OrderStatus.Paid:
        return 'Pago confirmado. Le hemos enviado por correo sus datos de acceso.';
      case OrderStatus.Failed:
        return 'El pago no se ha completado. Puede intentarlo de nuevo.';
      case OrderStatus.Cancelled:
        return 'La compra se ha cancelado.';
      case OrderStatus.Refunded:
        return 'Esta compra ha sido reembolsada.';
      default:
        if (order.provider === PaymentProvider.Manual) {
          return 'Hemos anotado su pedido. Le escribiremos para confirmar el pago.';
        }
        if (order.provider === PaymentProvider.Simulated) {
          return 'Pedido de prueba pendiente. Complete el pago simulado para recibir su acceso.';
        }
        return 'El pago está en curso. En cuanto la pasarela lo confirme recibirá su acceso.';
    }
  }

  /**
   * Aviso automático de la pasarela.
   *
   * Nunca se cree lo que dice el aviso: solo se usa para saber qué pago mirar,
   * y el estado se consulta contra la pasarela con las credenciales de la
   * empresa. Así un aviso falsificado no matricula a nadie.
   */
  async handleWebhook(
    slug: string,
    provider: PaymentProvider,
    payload: Record<string, unknown>,
    query: Record<string, string>,
  ): Promise<{ received: true }> {
    const tenant = await this.tenants.requireBySlug(slug);

    if (provider === PaymentProvider.MercadoPago) {
      const paymentId =
        query['data.id'] ??
        query.id ??
        (typeof payload.data === 'object' && payload.data !== null
          ? String((payload.data as Record<string, unknown>).id ?? '')
          : '');
      if (paymentId) await this.confirmMercadoPagoPayment(tenant._id, paymentId);
      return { received: true };
    }

    if (provider === PaymentProvider.PayPal) {
      const resource = payload.resource as Record<string, unknown> | undefined;
      const chargeReference =
        (typeof resource?.id === 'string' ? resource.id : null) ??
        (typeof payload.id === 'string' ? payload.id : null);
      if (chargeReference) {
        const order = await this.model
          .findOne({ tenant: tenant._id, providerReference: chargeReference, deletedAt: null })
          .exec();
        if (order && order.status === OrderStatus.Pending) {
          const resolved = await this.payments.gatewayFor(tenant._id, PaymentProvider.PayPal);
          const status = await resolved?.gateway.confirm(chargeReference);
          if (status?.paid) await this.fulfil(order);
        }
      }
      return { received: true };
    }

    return { received: true };
  }

  private async confirmMercadoPagoPayment(
    tenantId: Types.ObjectId,
    paymentId: string,
  ): Promise<void> {
    const resolved = await this.payments.gatewayFor(tenantId, PaymentProvider.MercadoPago);
    if (!resolved) return;

    // `paymentStatus` solo existe en esta pasarela: es la única que avisa con
    // el identificador del pago en vez de con el del pedido.
    const gateway = resolved.gateway as {
      paymentStatus?: (
        id: string,
      ) => Promise<{ orderReference: string | null; status: { paid: boolean } }>;
    };
    if (!gateway.paymentStatus) return;

    try {
      const { orderReference: reference, status } = await gateway.paymentStatus(paymentId);
      if (!reference || !status.paid) return;

      const order = await this.model
        .findOne({ tenant: tenantId, reference, deletedAt: null })
        .exec();
      if (!order) return;
      order.providerPaymentId = paymentId;
      await this.fulfil(order);
    } catch (error) {
      this.logger.warn(`Aviso de Mercado Pago no procesado (${paymentId}): ${String(error)}`);
    }
  }

  /* ------------------------------- Matrícula ------------------------------ */

  /**
   * Marca el pedido como pagado y da el acceso.
   *
   * Es idempotente: un pedido ya matriculado se deja como está. La misma
   * compra llega por dos caminos —la vuelta del comprador y el aviso de la
   * pasarela— y el segundo no debe crear una segunda cuenta ni un segundo
   * correo.
   *
   * Si ya existe una cuenta con ese correo en la empresa se reutiliza: quien
   * compra su segundo curso es la misma persona, y una cuenta nueva le partiría
   * el expediente en dos.
   */
  async fulfil(order: OrderDocument): Promise<OrderDocument> {
    if (order.enrolled) return order;

    const tenantId = order.tenant;
    let user = await this.users.findByEmail(order.buyer.email, tenantId);
    let temporaryPassword: string | null = null;

    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      user = await this.users.create(tenantId, {
        email: order.buyer.email,
        username: order.buyer.email,
        password: temporaryPassword,
        firstName: order.buyer.firstName,
        lastName: order.buyer.lastName,
        status: UserStatus.Active,
        initialRole: 'student',
      });
      await this.users.setTemporaryPassword(user._id, temporaryPassword);
    }

    await this.enrolments.enrol({
      courseId: order.course,
      tenantId,
      userId: user._id,
      roleShortName: 'student',
    });

    order.status = OrderStatus.Paid;
    order.paidAt = order.paidAt ?? new Date();
    order.user = user._id;
    order.enrolled = true;
    await order.save();

    const tenant = await this.tenants.findById(tenantId);
    await this.mail.sendCourseAccess({
      to: order.buyer.email,
      name: order.buyer.firstName,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      courseTitle: order.courseTitle,
      reference: order.reference,
      temporaryPassword,
    });

    return order;
  }

  /* ---------------------------- Administración ---------------------------- */

  async list(
    tenantId: string | Types.ObjectId,
    status?: OrderStatus,
  ): Promise<OrderDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId), deletedAt: null };
    if (status) filter.status = status;
    const orders = await this.model.find(filter).sort({ createdAt: -1 }).limit(300).exec();
    return orders.map((order) => this.toDto(order));
  }

  /**
   * Cambia el estado a mano. Es la vía de los pagos por transferencia y la de
   * corregir un pedido que la pasarela dejó a medias.
   */
  async updateStatus(
    tenantId: string | Types.ObjectId,
    id: string,
    dto: UpdateOrderStatusDto,
  ): Promise<OrderDto> {
    const order = await this.model
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId), deletedAt: null })
      .exec();
    if (!order) throw new NotFoundException('El pedido no existe.');

    if (dto.note !== undefined) order.note = dto.note ?? null;

    if (dto.status === OrderStatus.Paid) {
      await this.fulfil(order);
      if (dto.note !== undefined) {
        order.note = dto.note ?? null;
        await order.save();
      }
      return this.toDto(order);
    }

    order.status = dto.status;
    await order.save();
    return this.toDto(order);
  }

  private async requireOrder(
    tenantId: Types.ObjectId,
    reference: string,
  ): Promise<OrderDocument> {
    const order = await this.model
      .findOne({ tenant: tenantId, reference, deletedAt: null })
      .exec();
    if (!order) throw new NotFoundException('No encontramos ese pedido.');
    return order;
  }

  toDto(order: OrderDocument): OrderDto {
    return {
      id: order.id as string,
      reference: order.reference,
      courseId: order.course.toString(),
      courseTitle: order.courseTitle,
      buyerName: `${order.buyer.firstName} ${order.buyer.lastName}`.trim(),
      buyerEmail: order.buyer.email,
      amountCents: order.amountCents,
      currency: order.currency,
      provider: order.provider,
      status: order.status,
      providerReference: order.providerReference,
      enrolled: order.enrolled,
      createdAt: (order.get('createdAt') as Date | undefined)?.toISOString() ?? '',
      paidAt: order.paidAt?.toISOString() ?? null,
    };
  }
}
