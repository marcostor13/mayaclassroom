import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Calificación individual de un usuario en un ítem. */
@Schema({ collection: 'grades', timestamps: true })
export class Grade extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'GradeItem', required: true, index: true })
  gradeItem!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, default: null }) rawGrade!: number | null;
  @Prop({ type: Number, default: null }) finalGrade!: number | null;

  @Prop({ type: String, default: null }) feedback!: string | null;

  @Prop({ default: false }) hidden!: boolean;
  @Prop({ default: false }) locked!: boolean;
  @Prop({ default: false }) excluded!: boolean;
  @Prop({ default: false }) overridden!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  grader!: Types.ObjectId | null;

  @Prop({ type: Date, default: null }) gradedAt!: Date | null;
}

export type GradeDocument = HydratedDocument<Grade>;
export const GradeSchema = SchemaFactory.createForClass(Grade);
GradeSchema.index({ gradeItem: 1, user: 1 }, { unique: true });
GradeSchema.index({ course: 1, user: 1 });
