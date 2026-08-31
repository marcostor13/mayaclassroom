import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ForumSubscriptionMode, ForumType } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_forum', timestamps: true })
export class Forum extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ type: String, enum: Object.values(ForumType), default: ForumType.General })
  type!: ForumType;

  @Prop({
    type: String,
    enum: Object.values(ForumSubscriptionMode),
    default: ForumSubscriptionMode.Optional,
  })
  subscriptionMode!: ForumSubscriptionMode;

  @Prop({ default: 3 }) maxAttachments!: number;
  @Prop({ default: 10 * 1024 * 1024 }) maxBytes!: number;
  @Prop({ default: false }) allowRating!: boolean;
  @Prop({ default: 0 }) blockAfter!: number;
  @Prop({ default: 86400 }) blockPeriodSeconds!: number;
  @Prop({ default: 0 }) gradeMax!: number;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  subscribers!: Types.ObjectId[];
}

export type ForumDocument = HydratedDocument<Forum>;
export const ForumSchema = SchemaFactory.createForClass(Forum);
