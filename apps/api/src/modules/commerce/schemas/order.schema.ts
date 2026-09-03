import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DEFAULT_CURRENCY, OrderStatus, PaymentProvider } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Datos de quien compra. Se guardan aunque ya exista la cuenta: son los del
 *  pedido, y renombrarse después no debe reescribir una factura pasada. */
@Schema({ _id: false })
export class OrderBuyerSchema {
  @Prop({ required: true, trim: true }) firstName!: string;
  @Prop({ required: true, trim: true }) lastName!: string;
  @Prop({ required: true, lowercase: true, trim: true }) email!: string;
  @Prop({ type: String, default: null }) phone!: string | null;
}

/**
 * Un pedido de curso.
 *
 * Se crea antes de mandar a nadie a la pasarela, no después: si el comprador
 * cierra la pestaña a medio pagar, el pedido queda pendiente y se puede
 * conciliar; si solo se creara al volver, esa venta desaparecería sin rastro.
 *
 * No se guarda ningún dato de tarjeta. Lo único que se conserva de la pasarela
 * es su identificador, que es lo que hace falta para reconciliar después.
 */
@Schema({ collection: 'orders', timestamps: true })
export class Order extends TenantScopedDocument {
  /** Referencia corta que se enseña al comprador y viaja a la pasarela. */
  @Prop({ required: true, index: true }) reference!: string;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true }) courseTitle!: string;

  @Prop({ type: OrderBuyerSchema, required: true }) buyer!: OrderBuyerSchema;

  @Prop({ required: true, min: 0 }) amountCents!: number;
  @Prop({ required: true, default: DEFAULT_CURRENCY }) currency!: string;

  @Prop({ type: String, enum: Object.values(PaymentProvider), required: true, index: true })
  provider!: PaymentProvider;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.Pending,
    index: true,
  })
  status!: OrderStatus;

  /** Identificador del pedido o de la preferencia en la pasarela. */
  @Prop({ type: String, default: null, index: true }) providerReference!: string | null;

  /** Identificador del cobro concreto, cuando la pasarela lo distingue. */
  @Prop({ type: String, default: null }) providerPaymentId!: string | null;

  /** Cuenta con la que se matriculó. Nula mientras el pago no se confirme. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) user!: Types.ObjectId | null;

  @Prop({ default: false }) enrolled!: boolean;
  @Prop({ type: Date, default: null }) paidAt!: Date | null;

  /** Motivo del fallo o nota de quien confirmó un pago manual. */
  @Prop({ type: String, default: null }) note!: string | null;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ tenant: 1, reference: 1 }, { unique: true });
OrderSchema.index({ tenant: 1, status: 1, createdAt: -1 });
// La vuelta de la pasarela y el aviso automático llegan con su identificador y
// sin sesión: es la consulta del camino crítico del cobro.
OrderSchema.index({ tenant: 1, providerReference: 1 });
