import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizGradeMethod } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ _id: false })
export class QuizSlot {
  @Prop({ type: Types.ObjectId, ref: 'Question', required: true })
  question!: Types.ObjectId;

  @Prop({ required: true }) slot!: number;
  @Prop({ default: 1 }) page!: number;
  @Prop({ default: 1 }) maxMark!: number;
}

@Schema({ collection: 'mod_quiz', timestamps: true })
export class Quiz extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ type: Date, default: null }) timeOpen!: Date | null;
  @Prop({ type: Date, default: null }) timeClose!: Date | null;

  /** 0 = sin límite de tiempo. */
  @Prop({ default: 0 }) timeLimitSeconds!: number;

  /** 0 = intentos ilimitados. */
  @Prop({ default: 1 }) attemptsAllowed!: number;

  @Prop({ type: String, enum: Object.values(QuizGradeMethod), default: QuizGradeMethod.Highest })
  gradeMethod!: QuizGradeMethod;

  @Prop({ default: 10 }) maxGrade!: number;
  @Prop({ type: Number, default: null }) passingGrade!: number | null;

  @Prop({ default: false }) shuffleQuestions!: boolean;
  @Prop({ default: true }) shuffleAnswers!: boolean;
  @Prop({ default: 1 }) questionsPerPage!: number;

  @Prop({ type: String, enum: ['free', 'sequential'], default: 'free' })
  navMethod!: 'free' | 'sequential';

  @Prop({ default: true }) reviewAfterClose!: boolean;
  @Prop({ default: true }) showCorrectAnswers!: boolean;
  @Prop({ default: false }) requirePassword!: boolean;
  @Prop({ type: String, default: null }) password!: string | null;

  @Prop({ type: [QuizSlot], default: [] })
  slots!: QuizSlot[];
}

export type QuizDocument = HydratedDocument<Quiz>;
export const QuizSchema = SchemaFactory.createForClass(Quiz);
