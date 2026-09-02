import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PaymentProvider } from '@maya/shared';
import type { PaymentSettingsDto, PublicPaymentMethod } from '@maya/shared';
import type { JwtConfig } from '../../config';
import { decryptSecret, encryptSecret, toObjectId } from '../../common/utils';
import { TenantsService } from '../tenants/tenants.service';
import {
  PaymentSettings,
  PaymentSettingsDocument,
} from './schemas/payment-settings.schema';
import type { UpdatePaymentSettingsDto } from './dto/commerce.dto';
import { MercadoPagoGateway } from './providers/mercadopago.gateway';
import { PayPalGateway } from './providers/paypal.gateway';
import type { PaymentGateway } from './providers/gateway';

/** Credenciales ya descifradas y listas para hablar con la pasarela. */
export interface ResolvedGateway {
  provider: PaymentProvider;
  gateway: PaymentGateway;
  sandbox: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentSettings.name)
    private readonly model: Model<PaymentSettingsDocument>,
    private readonly config: ConfigService,
    private readonly tenants: TenantsService,
  ) {}

  /**
   * Clave con la que se cifran las credenciales de las pasarelas.
   *
   * Se reutiliza el secreto de firma de la sesión en lugar de pedir uno nuevo:
   * ya es obligatorio en producción y tiene longitud validada, de modo que no
   * hay despliegues a los que les falte esta pieza.
   */
  private get secret(): string {
    return this.config.getOrThrow<JwtConfig>('jwt').accessSecret;
  }

  /**
   * Los ajustes de la empresa, creándolos vacíos la primera vez.
   *
   * Los secretos van marcados `select: false` en el esquema, así que hay que
   * pedirlos a propósito: esta versión no los trae, y es la que usa todo lo
   * que no sea cobrar.
   */
  async forTenant(tenantId: string | Types.ObjectId): Promise<PaymentSettingsDocument> {
    const tenant = toObjectId(tenantId);
    const existing = await this.model.findOne({ tenant }).exec();
    if (existing) return existing;
    return this.model.create({ tenant });
  }

  /** La misma consulta, con las credenciales. Solo para cobrar. */
  private async withSecrets(
    tenantId: string | Types.ObjectId,
  ): Promise<PaymentSettingsDocument> {
    await this.forTenant(tenantId);
    const settings = await this.model
      .findOne({ tenant: toObjectId(tenantId) })
      .select('+mercadoPago.accessToken +paypal.secret')
      .exec();
    if (!settings) throw new Error('No se pudieron leer los ajustes de cobro.');
    return settings;
  }

  async update(
    tenantId: string | Types.ObjectId,
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsDocument> {
    const settings = await this.withSecrets(tenantId);

    if (dto.currency) settings.currency = dto.currency.toUpperCase();

    if (dto.mercadoPago) {
      const { accessToken, ...rest } = dto.mercadoPago;
      Object.assign(settings.mercadoPago, rest);
      // Una cadena vacía borra la credencial; ausente la deja como estaba, que
      // es lo que hace el formulario cuando no se toca el campo.
      if (accessToken !== undefined) {
        settings.mercadoPago.accessToken = accessToken
          ? encryptSecret(accessToken, this.secret)
          : null;
      }
    }

    if (dto.paypal) {
      const { secret, ...rest } = dto.paypal;
      Object.assign(settings.paypal, rest);
      if (secret !== undefined) {
        settings.paypal.secret = secret ? encryptSecret(secret, this.secret) : null;
      }
    }

    if (dto.manual) Object.assign(settings.manual, dto.manual);
    if (dto.simulated) Object.assign(settings.simulated, dto.simulated);

    await settings.save();
    return settings;
  }

  toDto(settings: PaymentSettingsDocument): PaymentSettingsDto {
    return {
      currency: settings.currency,
      mercadoPago: {
        enabled: settings.mercadoPago.enabled,
        publicKey: settings.mercadoPago.publicKey,
        hasAccessToken: Boolean(settings.mercadoPago.accessToken),
        sandbox: settings.mercadoPago.sandbox,
      },
      paypal: {
        enabled: settings.paypal.enabled,
        clientId: settings.paypal.clientId,
        hasSecret: Boolean(settings.paypal.secret),
        sandbox: settings.paypal.sandbox,
      },
      manual: {
        enabled: settings.manual.enabled,
        instructions: settings.manual.instructions,
      },
      simulated: { enabled: settings.simulated.enabled },
    };
  }

  /**
   * Formas de pago que se ofrecen en la ficha pública.
   *
   * Una pasarela activada pero sin credenciales no se ofrece: aparecería como
   * opción y fallaría al pulsarla, que es peor que no estar.
   */
  async publicMethods(tenantId: string | Types.ObjectId): Promise<PublicPaymentMethod[]> {
    const settings = await this.withSecrets(tenantId);
    const methods: PublicPaymentMethod[] = [];

    if (settings.mercadoPago.enabled && settings.mercadoPago.accessToken) {
      methods.push({
        provider: PaymentProvider.MercadoPago,
        label: 'Mercado Pago',
        hint: 'Tarjeta, saldo o efectivo.',
        sandbox: settings.mercadoPago.sandbox,
      });
    }

    if (settings.paypal.enabled && settings.paypal.clientId && settings.paypal.secret) {
      methods.push({
        provider: PaymentProvider.PayPal,
        label: 'PayPal',
        hint: 'Con cuenta de PayPal o tarjeta.',
        sandbox: settings.paypal.sandbox,
      });
    }

    if (settings.manual.enabled) {
      methods.push({
        provider: PaymentProvider.Manual,
        label: 'Transferencia',
        hint: settings.manual.instructions ?? 'Le enviaremos los datos por correo.',
        sandbox: false,
      });
    }

    // Va la última: mientras esté encendida es la vía por la que cualquiera
    // puede matricularse sin pagar, y no debe competir con las de verdad.
    if (settings.simulated.enabled) {
      methods.push({
        provider: PaymentProvider.Simulated,
        label: 'Pago de prueba',
        hint: 'Simula el cobro para ver el circuito completo. No se cobra nada.',
        sandbox: true,
      });
    }

    return methods;
  }

  /** `true` si la empresa tiene encendida la pasarela simulada. */
  async simulationEnabled(tenantId: string | Types.ObjectId): Promise<boolean> {
    return (await this.forTenant(tenantId)).simulated.enabled;
  }

  /** La pasarela lista para cobrar, o `null` si no está configurada. */
  async gatewayFor(
    tenantId: string | Types.ObjectId,
    provider: PaymentProvider,
  ): Promise<ResolvedGateway | null> {
    const settings = await this.withSecrets(tenantId);

    if (provider === PaymentProvider.MercadoPago) {
      const { enabled, accessToken, sandbox } = settings.mercadoPago;
      if (!enabled || !accessToken) return null;
      return {
        provider,
        sandbox,
        gateway: new MercadoPagoGateway(decryptSecret(accessToken, this.secret), sandbox),
      };
    }

    if (provider === PaymentProvider.PayPal) {
      const { enabled, clientId, secret, sandbox } = settings.paypal;
      if (!enabled || !clientId || !secret) return null;
      return {
        provider,
        sandbox,
        gateway: new PayPalGateway(clientId, decryptSecret(secret, this.secret), sandbox),
      };
    }

    return null;
  }

  /** Las mismas formas de pago, resueltas por la dirección pública. */
  async publicMethodsBySlug(slug: string): Promise<PublicPaymentMethod[]> {
    const tenant = await this.tenants.requireBySlug(slug);
    return this.publicMethods(tenant._id);
  }

  async currencyOf(tenantId: string | Types.ObjectId): Promise<string> {
    return (await this.forTenant(tenantId)).currency;
  }
}
