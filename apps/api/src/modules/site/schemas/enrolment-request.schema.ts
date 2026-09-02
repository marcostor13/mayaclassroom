import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EnrolmentRequestStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Solicitud de plaza llegada desde la página pública.
 *
 * Los datos de contacto se guardan tal cual los escribió quien la envía, sin
 * crear todavía ninguna cuenta: la mayoría de las solicitudes no acaban en
 * matrícula, y llenar la empresa de usuarios fantasma ensuciaría los informes
 * y el límite de usuarios del plan. La cuenta se crea al aprobar.
 */
@Schema({ collection: 'enrolment_requests' })
export class EnrolmentRequest extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true, trim: true }) firstName!: string;
  @Prop({ required: true, trim: true }) lastName!: string;
  @Prop({ required: true, lowercase: true, trim: true, index: true }) email!: string;
  @Prop({ type: String, default: null }) phone!: string | null;
  @Prop({ type: String, default: null }) message!: string | null;

  @Prop({
    type: String,
    enum: Object.values(EnrolmentRequestStatus),
    default: EnrolmentRequestStatus.Pending,
    index: true,
  })
  status!: EnrolmentRequestStatus;

  @Prop({ type: String, default: null }) note!: string | null;

  /** Cuenta creada o reutilizada al aprobar. Nulo mientras esté pendiente. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null }) user!: Types.ObjectId | null;
}

export type EnrolmentRequestDocument = HydratedDocument<EnrolmentRequest>;
export const EnrolmentRequestSchema = SchemaFactory.createForClass(EnrolmentRequest);

// Se consulta siempre por empresa y estado, ordenado por fecha.
EnrolmentRequestSchema.index({ tenant: 1, status: 1, createdAt: -1 });
