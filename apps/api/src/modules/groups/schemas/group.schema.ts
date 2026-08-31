import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'course_groups', timestamps: true })
export class Group extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) idNumber!: string | null;
  @Prop({ type: String, default: null }) enrolmentKey!: string | null;
  @Prop({ type: String, default: null }) pictureUrl!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  members!: Types.ObjectId[];
}

export type GroupDocument = HydratedDocument<Group>;
export const GroupSchema = SchemaFactory.createForClass(Group);
GroupSchema.index({ course: 1, name: 1 }, { unique: true });
