import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'messages', timestamps: true })
export class Message extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversation!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sender!: Types.ObjectId;

  @Prop({ required: true }) body!: string;

  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  attachments!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  readBy!: Types.ObjectId[];

  @Prop({ type: Date, default: null }) editedAt!: Date | null;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ conversation: 1, createdAt: -1 });
