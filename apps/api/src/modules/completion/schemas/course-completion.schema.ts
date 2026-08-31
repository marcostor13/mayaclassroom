import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Finalización del curso por usuario. */
@Schema({ collection: 'course_completions', timestamps: true })
export class CourseCompletion extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ default: 0 }) progress!: number;
  @Prop({ default: 0 }) completedModules!: number;
  @Prop({ default: 0 }) totalModules!: number;

  @Prop({ type: Date, default: null }) completedAt!: Date | null;
  @Prop({ type: Number, default: null }) finalGrade!: number | null;
  @Prop({ default: false }) notified!: boolean;
}

export type CourseCompletionDocument = HydratedDocument<CourseCompletion>;
export const CourseCompletionSchema = SchemaFactory.createForClass(CourseCompletion);
CourseCompletionSchema.index({ course: 1, user: 1 }, { unique: true });
