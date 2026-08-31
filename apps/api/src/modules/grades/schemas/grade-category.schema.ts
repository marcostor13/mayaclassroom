import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GradeAggregation } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'grade_categories', timestamps: true })
export class GradeCategory extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GradeCategory', default: null, index: true })
  parent!: Types.ObjectId | null;

  @Prop({ required: true }) name!: string;

  @Prop({ type: String, enum: Object.values(GradeAggregation), default: GradeAggregation.Natural })
  aggregation!: GradeAggregation;

  @Prop({ default: true }) aggregateOnlyGraded!: boolean;
  @Prop({ default: 0 }) dropLowest!: number;
  @Prop({ default: 0 }) keepHighest!: number;
  @Prop({ default: 0 }) depth!: number;
  @Prop({ default: '/' }) path!: string;
  @Prop({ default: 0 }) sortOrder!: number;
}

export type GradeCategoryDocument = HydratedDocument<GradeCategory>;
export const GradeCategorySchema = SchemaFactory.createForClass(GradeCategory);
GradeCategorySchema.index({ course: 1, sortOrder: 1 });
