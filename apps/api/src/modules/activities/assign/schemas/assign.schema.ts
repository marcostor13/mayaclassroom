import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GradeType } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ collection: 'mod_assign', timestamps: true })
export class Assign extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ type: Date, default: null }) allowSubmissionsFrom!: Date | null;
  @Prop({ type: Date, default: null }) dueDate!: Date | null;
  @Prop({ type: Date, default: null }) cutOffDate!: Date | null;
  @Prop({ type: Date, default: null }) gradingDueDate!: Date | null;

  @Prop({ default: 100 }) maxGrade!: number;

  @Prop({ type: String, enum: Object.values(GradeType), default: GradeType.Value })
  gradeType!: GradeType;

  @Prop({ type: Number, default: null }) gradePass!: number | null;

  @Prop({ type: [String], default: ['online', 'file'] })
  submissionTypes!: ('online' | 'file' | 'url')[];

  @Prop({ default: 5 }) maxFiles!: number;
  @Prop({ default: 20 * 1024 * 1024 }) maxFileSize!: number;
  @Prop({ type: [String], default: [] }) allowedFileTypes!: string[];

  @Prop({ default: false }) blindMarking!: boolean;
  @Prop({ default: false }) teamSubmission!: boolean;
  @Prop({ default: false }) requireSubmissionStatement!: boolean;
  @Prop({ type: String, default: null }) submissionStatement!: string | null;

  @Prop({ type: String, enum: ['none', 'manual', 'untilpass'], default: 'none' })
  attemptReopenMethod!: 'none' | 'manual' | 'untilpass';

  @Prop({ default: 1 }) maxAttempts!: number;

  @Prop({ type: String, enum: ['allow', 'block', 'penalise'], default: 'allow' })
  latePolicy!: 'allow' | 'block' | 'penalise';

  @Prop({ default: 0 }) latePenaltyPercentPerDay!: number;

  @Prop({ default: false }) notifyGraders!: boolean;
  @Prop({ default: true }) sendStudentNotifications!: boolean;

  /** Rúbrica opcional: criterios con niveles y puntuación. */
  @Prop({ type: Object, default: null })
  rubric!: Record<string, unknown> | null;
}

export type AssignDocument = HydratedDocument<Assign>;
export const AssignSchema = SchemaFactory.createForClass(Assign);
