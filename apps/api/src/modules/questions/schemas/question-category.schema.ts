import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'question_categories', timestamps: true })
export class QuestionCategory extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'QuestionCategory', default: null, index: true })
  parent!: Types.ObjectId | null;

  /** Contexto donde vive la categoría (curso, empresa…). */
  @Prop({ type: Types.ObjectId, ref: 'Context', required: true, index: true })
  context!: Types.ObjectId;

  @Prop({ default: 0 }) sortOrder!: number;
}

export type QuestionCategoryDocument = HydratedDocument<QuestionCategory>;
export const QuestionCategorySchema = SchemaFactory.createForClass(QuestionCategory);
