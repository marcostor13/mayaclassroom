import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Mensaje del chat de la sala. Se persiste —y no solo se difunde— porque quien
 * entra a mitad de clase necesita el hilo, y porque un enlace compartido en el
 * chat es material del curso como cualquier otro.
 */
@Schema({ collection: 'live_chat_messages', timestamps: true })
export class LiveChatMessage extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true, index: true })
  session!: Types.ObjectId;

  /** `null` en los avisos de la propia sala («X ha entrado»). */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  author!: Types.ObjectId | null;

  @Prop({ required: true }) body!: string;

  @Prop({ default: false }) system!: boolean;
}

export type LiveChatMessageDocument = HydratedDocument<LiveChatMessage>;
export const LiveChatMessageSchema = SchemaFactory.createForClass(LiveChatMessage);

LiveChatMessageSchema.index({ session: 1, createdAt: 1 });
