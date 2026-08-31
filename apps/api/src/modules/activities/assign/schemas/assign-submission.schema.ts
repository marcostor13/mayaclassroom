import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SubmissionStatus } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_assign_submissions', timestamps: true })
export class AssignSubmission extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Assign', required: true, index: true })
  assign!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  group!: Types.ObjectId | null;

  @Prop({ default: 1 }) attempt!: number;

  @Prop({ type: String, enum: Object.values(SubmissionStatus), default: SubmissionStatus.New })
  status!: SubmissionStatus;

  @Prop({ type: String, default: null }) onlineText!: string | null;
  @Prop({ type: String, default: null }) url!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  files!: Types.ObjectId[];

  @Prop({ type: Date, default: null }) submittedAt!: Date | null;
  @Prop({ default: false }) late!: boolean;

  @Prop({ type: Number, default: null }) grade!: number | null;
  @Prop({ type: Date, default: null }) gradedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  grader!: Types.ObjectId | null;

  @Prop({ type: String, default: null }) feedbackText!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  feedbackFiles!: Types.ObjectId[];

  @Prop({ type: Date, default: null }) extensionDueDate!: Date | null;

  /** Evaluación por rúbrica: criterio → nivel seleccionado. */
  @Prop({ type: Object, default: null })
  rubricGrades!: Record<string, unknown> | null;
}

export type AssignSubmissionDocument = HydratedDocument<AssignSubmission>;
export const AssignSubmissionSchema = SchemaFactory.createForClass(AssignSubmission);
AssignSubmissionSchema.index({ assign: 1, user: 1, attempt: 1 }, { unique: true });
AssignSubmissionSchema.index({ assign: 1, status: 1 });
