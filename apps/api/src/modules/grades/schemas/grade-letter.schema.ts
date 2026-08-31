import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Letra de calificación asociada a un porcentaje mínimo. */
@Schema({ collection: 'grade_letters', timestamps: true })
export class GradeLetter extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Context', required: true, index: true })
  context!: Types.ObjectId;

  @Prop({ required: true }) letter!: string;
  @Prop({ required: true }) lowerBoundary!: number;
}

export type GradeLetterDocument = HydratedDocument<GradeLetter>;
export const GradeLetterSchema = SchemaFactory.createForClass(GradeLetter);
GradeLetterSchema.index({ context: 1, lowerBoundary: -1 });
