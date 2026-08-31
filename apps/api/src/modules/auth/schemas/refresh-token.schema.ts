import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Token de refresco rotativo. Se guarda el hash SHA-256, nunca el token.
 * La detección de reuso invalida toda la familia (`familyId`), lo que corta
 * cualquier robo de token.
 */
@Schema({ collection: 'refresh_tokens', timestamps: true })
export class RefreshToken extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ required: true, index: true })
  familyId!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  replacedByHash!: string | null;

  @Prop({ default: '' }) userAgent!: string;
  @Prop({ default: '' }) ip!: string;
  @Prop({ type: String, default: null }) device!: string | null;

  @Prop({ type: Date, default: Date.now })
  lastUsedAt!: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RefreshTokenSchema.index({ user: 1, revokedAt: 1 });
