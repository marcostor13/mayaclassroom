import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MessageConversationType } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'conversations', timestamps: true })
export class Conversation extends TenantScopedDocument {
  @Prop({
    type: String,
    enum: Object.values(MessageConversationType),
    default: MessageConversationType.Individual,
  })
  type!: MessageConversationType;

  @Prop({ type: String, default: null }) name!: string | null;
  @Prop({ type: String, default: null }) imageUrl!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true, index: true })
  members!: Types.ObjectId[];

  /** Curso asociado en conversaciones de grupo de curso. */
  @Prop({ type: Types.ObjectId, ref: 'Course', default: null })
  course!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Message', default: null })
  lastMessage!: Types.ObjectId | null;

  @Prop({ type: Date, default: Date.now, index: true })
  lastMessageAt!: Date;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  mutedBy!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  favouritedBy!: Types.ObjectId[];
}

export type ConversationDocument = HydratedDocument<Conversation>;
export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ members: 1, lastMessageAt: -1 });
