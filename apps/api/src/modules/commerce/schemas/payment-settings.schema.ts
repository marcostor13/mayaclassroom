import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';
import { DEFAULT_CURRENCY } from '@maya/shared';

/**
 * Credenciales de una pasarela.
 *
 * Los dos secretos (`accessToken` de Mercado Pago y `secret` de PayPal) se
 * marcan `select: false`: no salen de la base de datos salvo que una consulta
 * los pida a propósito. Así ninguna lectura rutinaria —y ninguna respuesta de
 * la API construida a partir de ella— puede acabar filtrándolos por descuido.
 */
@Schema({ _id: false })
export class MercadoPagoSettingsSchema {
  @Prop({ default: false }) enabled!: boolean;
  /** Clave pública: es pública de verdad, viaja al navegador del comprador. */
  @Prop({ type: String, default: null }) publicKey!: string | null;
  @Prop({ type: String, default: null, select: false }) accessToken!: string | null;
  @Prop({ default: true }) sandbox!: boolean;
}

@Schema({ _id: false })
export class PayPalSettingsSchema {
  @Prop({ default: false }) enabled!: boolean;
  @Prop({ type: String, default: null }) clientId!: string | null;
  @Prop({ type: String, default: null, select: false }) secret!: string | null;
  @Prop({ default: true }) sandbox!: boolean;
}

/** Pago acordado fuera: transferencia, Bizum, efectivo en secretaría. */
@Schema({ _id: false })
export class ManualPaymentSettingsSchema {
  @Prop({ default: false }) enabled!: boolean;
  @Prop({ type: String, default: null }) instructions!: string | null;
}

/**
 * Pasarela simulada.
 *
 * No tiene credenciales porque no habla con nadie: recorre el circuito de
 * compra sin cobrar. Apagada por defecto, y con aviso en la pantalla de
 * ajustes, porque mientras esté encendida cualquiera puede matricularse sin
 * pagar.
 */
@Schema({ _id: false })
export class SimulatedPaymentSettingsSchema {
  @Prop({ default: false }) enabled!: boolean;
}

/**
 * Cómo cobra una empresa. Un documento por empresa, creado al leerlo por
 * primera vez para que la pantalla de ajustes no tenga que decidir nada.
 */
@Schema({ collection: 'payment_settings' })
export class PaymentSettings extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, unique: true })
  declare tenant: Types.ObjectId;

  /** Moneda por defecto de los cursos que no declaren la suya. */
  @Prop({ default: DEFAULT_CURRENCY }) currency!: string;

  @Prop({ type: MercadoPagoSettingsSchema, default: () => ({}) })
  mercadoPago!: MercadoPagoSettingsSchema;

  @Prop({ type: PayPalSettingsSchema, default: () => ({}) })
  paypal!: PayPalSettingsSchema;

  @Prop({ type: ManualPaymentSettingsSchema, default: () => ({}) })
  manual!: ManualPaymentSettingsSchema;

  @Prop({ type: SimulatedPaymentSettingsSchema, default: () => ({}) })
  simulated!: SimulatedPaymentSettingsSchema;
}

export type PaymentSettingsDocument = HydratedDocument<PaymentSettings>;
export const PaymentSettingsSchema = SchemaFactory.createForClass(PaymentSettings);
