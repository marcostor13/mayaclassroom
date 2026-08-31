import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CompletionState } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Estado de finalización de un módulo por usuario. */
@Schema({ collection: 'module_completions', timestamps: true })
export class ModuleCompletion extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  courseModule!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Number, enum: [0, 1, 2, 3], default: CompletionState.Incomplete })
  state!: CompletionState;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  /** Marcado manualmente por un profesor. */
  @Prop({ default: false })
  overrideByTeacher!: boolean;

  @Prop({ default: 0 }) viewCount!: number;
}

export type ModuleCompletionDocument = HydratedDocument<ModuleCompletion>;
export const ModuleCompletionSchema = SchemaFactory.createForClass(ModuleCompletion);
ModuleCompletionSchema.index({ courseModule: 1, user: 1 }, { unique: true });
ModuleCompletionSchema.index({ course: 1, user: 1 });
