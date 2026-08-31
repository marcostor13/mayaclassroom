import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Agrupamiento: conjunto de grupos usado para restringir actividades. */
@Schema({ collection: 'course_groupings', timestamps: true })
export class Grouping extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true, trim: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) idNumber!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'Group', default: [] })
  groups!: Types.ObjectId[];
}

export type GroupingDocument = HydratedDocument<Grouping>;
export const GroupingSchema = SchemaFactory.createForClass(Grouping);
GroupingSchema.index({ course: 1, name: 1 }, { unique: true });
