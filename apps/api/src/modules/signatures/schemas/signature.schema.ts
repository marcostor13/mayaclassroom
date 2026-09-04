import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SignatureUse } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Firma de referencia de una persona: la que sale en su certificado.
 *
 * Una por persona. Volver a firmar sustituye la anterior en lugar de acumular
 * versiones, porque lo que se necesita es «cómo firma esta persona», no su
 * historial de intentos. Lo que sí queda registrado para siempre es cada uso
 * concreto (`SignatureRecord`), con el trazo copiado dentro: así, cambiar la
 * firma no altera un acta de asistencia ya firmada.
 */
@Schema({ collection: 'user_signatures', timestamps: true })
export class UserSignature extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** PNG en base64 (`data:image/png;base64,…`). */
  @Prop({ required: true })
  imageDataUrl!: string;

  /** Sello HMAC del trazo junto con quién y cuándo firmó. */
  @Prop({ required: true })
  hash!: string;

  @Prop({ type: Date, default: Date.now }) signedAt!: Date;
  @Prop({ default: 600 }) width!: number;
  @Prop({ default: 200 }) height!: number;

  @Prop({ type: String, default: null }) ip!: string | null;
  @Prop({ type: String, default: null }) userAgent!: string | null;
}

export type UserSignatureDocument = HydratedDocument<UserSignature>;
export const UserSignatureSchema = SchemaFactory.createForClass(UserSignature);
UserSignatureSchema.index({ tenant: 1, user: 1 }, { unique: true });

/**
 * Firma estampada sobre un hecho concreto: una asistencia, una visualización.
 *
 * Guarda una copia del trazo y no una referencia a la firma de perfil: un acta
 * firmada tiene que seguir enseñando lo que se firmó aunque la persona cambie
 * después su firma o se dé de baja.
 */
@Schema({ collection: 'signature_records', timestamps: true })
export class SignatureRecord extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(SignatureUse), required: true, index: true })
  use!: SignatureUse;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  /** Sesión en vivo o actividad firmada, según el uso. */
  @Prop({ type: Types.ObjectId, default: null, index: true })
  reference!: Types.ObjectId | null;

  @Prop({ type: String, default: null }) referenceLabel!: string | null;

  @Prop({ required: true }) imageDataUrl!: string;
  @Prop({ required: true }) hash!: string;

  @Prop({ type: Date, default: Date.now, index: true }) signedAt!: Date;
  @Prop({ type: String, default: null }) ip!: string | null;
  @Prop({ type: String, default: null }) userAgent!: string | null;
}

export type SignatureRecordDocument = HydratedDocument<SignatureRecord>;
export const SignatureRecordSchema = SchemaFactory.createForClass(SignatureRecord);
// Firmar dos veces la misma sesión no aporta nada y ensuciaría el acta.
SignatureRecordSchema.index(
  { user: 1, use: 1, reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: 'objectId' } } },
);
SignatureRecordSchema.index({ tenant: 1, course: 1, signedAt: -1 });
