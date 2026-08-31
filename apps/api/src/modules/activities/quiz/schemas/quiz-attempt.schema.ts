import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizAttemptState } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ _id: false })
export class QuizResponse {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  question!: Types.ObjectId;

  @Prop({ type: Object, default: null }) answer!: unknown;
  @Prop({ type: Number, default: null }) mark!: number | null;
  @Prop({ default: 1 }) maxMark!: number;
  @Prop({ type: Boolean, default: null }) correct!: boolean | null;
  @Prop({ type: String, default: null }) feedback!: string | null;
  @Prop({ default: false }) needsManualGrading!: boolean;
  @Prop({ default: false }) flagged!: boolean;
}

@Schema({ collection: 'mod_quiz_attempts', timestamps: true })
export class QuizAttempt extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Quiz', required: true, index: true })
  quiz!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) attempt!: number;

  @Prop({
    type: String,
    enum: Object.values(QuizAttemptState),
    default: QuizAttemptState.InProgress,
    index: true,
  })
  state!: QuizAttemptState;

  @Prop({ type: Date, default: Date.now }) startedAt!: Date;
  @Prop({ type: Date, default: null }) finishedAt!: Date | null;
  @Prop({ type: Date, default: null }) dueAt!: Date | null;

  @Prop({ type: Number, default: null }) sumGrades!: number | null;
  @Prop({ type: Number, default: null }) grade!: number | null;

  @Prop({ type: [QuizResponse], default: [] })
  responses!: QuizResponse[];

  /** Orden de las preguntas para este intento (barajado). */
  @Prop({ type: [String], default: [] })
  layout!: string[];
}

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;
export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
QuizAttemptSchema.index({ quiz: 1, user: 1, attempt: 1 }, { unique: true });
