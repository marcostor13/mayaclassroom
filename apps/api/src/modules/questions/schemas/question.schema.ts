import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuestionType } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: true })
export class QuestionAnswer {
  @Prop({ required: true }) text!: string;
  /** Fracción de la puntuación: 1 = correcta, 0 = incorrecta, negativa = penaliza. */
  @Prop({ default: 0 }) fraction!: number;
  @Prop({ type: String, default: null }) feedback!: string | null;
}

@Schema({ _id: false })
export class SubQuestion {
  @Prop({ required: true }) text!: string;
  @Prop({ required: true }) answer!: string;
}

/** Pregunta del banco de preguntas. */
@Schema({ collection: 'questions', timestamps: true })
export class Question extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'QuestionCategory', required: true, index: true })
  category!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(QuestionType), required: true, index: true })
  type!: QuestionType;

  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) questionText!: string;
  @Prop({ type: String, default: null }) generalFeedback!: string | null;

  /**
   * Pauta de corrección de las preguntas que evalúa una persona.
   *
   * Solo la ve quien corrige. Va en la pregunta y no en el examen porque es
   * propiedad de la pregunta: al reutilizarla en otro examen, la pauta viaja
   * con ella y dos personas distintas corrigen con el mismo criterio.
   */
  @Prop({ type: String, default: null })
  rubric!: string | null;

  @Prop({ default: 1 }) defaultMark!: number;
  @Prop({ default: 0 }) penalty!: number;

  @Prop({ default: true }) shuffleAnswers!: boolean;
  /** Opción múltiple: una sola respuesta correcta. */
  @Prop({ default: true }) single!: boolean;

  @Prop({ type: [QuestionAnswer], default: [] })
  answers!: QuestionAnswer[];

  @Prop({ type: [SubQuestion], default: [] })
  subquestions!: SubQuestion[];

  /** Tolerancia para preguntas numéricas. */
  @Prop({ default: 0 }) tolerance!: number;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ default: 0 }) usageCount!: number;
}

export type QuestionDocument = HydratedDocument<Question>;
export const QuestionSchema = SchemaFactory.createForClass(Question);
QuestionSchema.index({ tenant: 1, category: 1 });
QuestionSchema.index({ name: 'text', questionText: 'text' });
