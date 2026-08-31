import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Preferencias de notificación por usuario, evento y canal. */
@Schema({ collection: 'notification_preferences', timestamps: true })
export class NotificationPreference extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) component!: string;
  @Prop({ required: true }) eventName!: string;

  @Prop({ default: true }) web!: boolean;
  @Prop({ default: true }) email!: boolean;
  @Prop({ default: false }) push!: boolean;
}

export type NotificationPreferenceDocument = HydratedDocument<NotificationPreference>;
export const NotificationPreferenceSchema =
  SchemaFactory.createForClass(NotificationPreference);

NotificationPreferenceSchema.index(
  { user: 1, component: 1, eventName: 1 },
  { unique: true },
);
