import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { NotificationChannel, NotificationStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'notifications', timestamps: true })
export class Notification extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, index: true }) component!: string;
  @Prop({ required: true, index: true }) eventName!: string;

  @Prop({ required: true }) subject!: string;
  @Prop({ required: true }) body!: string;

  @Prop({ type: String, default: null }) contextUrl!: string | null;
  @Prop({ type: String, default: null }) icon!: string | null;

  @Prop({
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.Unread,
    index: true,
  })
  status!: NotificationStatus;

  @Prop({ type: [String], default: [NotificationChannel.Web] })
  channels!: NotificationChannel[];

  @Prop({ type: Date, default: null }) readAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  fromUser!: Types.ObjectId | null;
}

export type NotificationDocument = HydratedDocument<Notification>;
export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ user: 1, status: 1, createdAt: -1 });
