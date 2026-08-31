import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_forum_discussions', timestamps: true })
export class Discussion extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Forum', required: true, index: true })
  forum!: Types.ObjectId;

  @Prop({ required: true }) name!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  group!: Types.ObjectId | null;

  @Prop({ default: false, index: true }) pinned!: boolean;
  @Prop({ default: false }) locked!: boolean;
  @Prop({ default: 0 }) replyCount!: number;
  @Prop({ type: Date, default: null, index: true }) lastPostAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'Post', default: null })
  firstPost!: Types.ObjectId | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  subscribers!: Types.ObjectId[];
}

export type DiscussionDocument = HydratedDocument<Discussion>;
export const DiscussionSchema = SchemaFactory.createForClass(Discussion);
DiscussionSchema.index({ forum: 1, pinned: -1, lastPostAt: -1 });
