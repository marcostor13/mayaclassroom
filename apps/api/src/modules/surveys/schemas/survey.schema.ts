import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SurveyQuestionType, SurveyStatus, SurveyTrigger } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: true })
export class SurveyQuestion {
  @Prop({ type: String, enum: Object.values(SurveyQuestionType), required: true })
  type!: SurveyQuestionType;

  @Prop({ required: true }) text!: string;
  @Prop({ type: String, default: null }) help!: string | null;
  @Prop({ default: false }) required!: boolean;
  @Prop({ default: 0 }) position!: number;

  @Prop({ type: [String], default: [] }) options!: string[];

  @Prop({ type: Number, default: null }) scaleMax!: number | null;
  @Prop({ type: String, default: null }) scaleMinLabel!: string | null;
  @Prop({ type: String, default: null }) scaleMaxLabel!: string | null;
}

/** Encuesta de un curso, escrita por el profesorado o la administración. */
@Schema({ collection: 'surveys', timestamps: true })
export class Survey extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ required: true }) title!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ type: String, enum: Object.values(SurveyStatus), default: SurveyStatus.Draft, index: true })
  status!: SurveyStatus;

  @Prop({ type: String, enum: Object.values(SurveyTrigger), default: SurveyTrigger.OnCompletion })
  trigger!: SurveyTrigger;

  @Prop({ default: true }) anonymous!: boolean;

  @Prop({ type: [SurveyQuestion], default: [] })
  questions!: SurveyQuestion[];

  @Prop({ type: Date, default: null }) opensAt!: Date | null;
  @Prop({ type: Date, default: null }) closesAt!: Date | null;

  /**
   * Contador de respuestas.
   *
   * Se lleva aparte y no se cuenta al vuelo porque el listado del profesorado
   * lo enseña en cada fila; con muchas encuestas serían tantas consultas como
   * filas para un número que solo crece de uno en uno.
   */
  @Prop({ default: 0 })
  responseCount!: number;
}

export type SurveyDocument = HydratedDocument<Survey>;
export const SurveySchema = SchemaFactory.createForClass(Survey);
SurveySchema.index({ tenant: 1, course: 1, status: 1 });

/**
 * Respuesta a una encuesta.
 *
 * **No guarda quién responde, a propósito.** Sin autor no hay forma de
 * reconstruirlo después, ni por error ni a petición de nadie, que es la única
 * manera de que la respuesta sea de verdad anónima y de que el alumnado
 * conteste con franqueza. Quién ha respondido se lleva en `SurveyParticipation`,
 * en otra colección y sin ninguna referencia que las una.
 */
@Schema({ collection: 'survey_responses', timestamps: true })
export class SurveyResponse extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Survey', required: true, index: true })
  survey!: Types.ObjectId;

  /** Respuestas indexadas por identificador de pregunta. */
  @Prop({ type: Object, default: {} })
  answers!: Record<string, unknown>;

  @Prop({ type: Date, default: Date.now, index: true })
  submittedAt!: Date;
}

export type SurveyResponseDocument = HydratedDocument<SurveyResponse>;
export const SurveyResponseSchema = SchemaFactory.createForClass(SurveyResponse);

/**
 * Quién ha respondido ya, sin decir qué.
 *
 * Existe para no volver a pedirle la encuesta a quien ya la contestó y para
 * poder calcular la participación. Guarda persona y encuesta, y nada más: no
 * hay fecha con precisión de segundo ni referencia a la respuesta, porque con
 * cualquiera de las dos se podría emparejar por orden de llegada y el anonimato
 * dejaría de serlo.
 */
@Schema({ collection: 'survey_participations', timestamps: false })
export class SurveyParticipation extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Survey', required: true, index: true })
  survey!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;
}

export type SurveyParticipationDocument = HydratedDocument<SurveyParticipation>;
export const SurveyParticipationSchema = SchemaFactory.createForClass(SurveyParticipation);
SurveyParticipationSchema.index({ survey: 1, user: 1 }, { unique: true });
