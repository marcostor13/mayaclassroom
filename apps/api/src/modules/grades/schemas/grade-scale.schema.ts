import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Escala de calificación personalizada (Insuficiente/Bien/Notable…). */
@Schema({ collection: 'grade_scales', timestamps: true })
export class GradeScale extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;

  /** Elementos ordenados de menor a mayor. */
  @Prop({ type: [String], required: true })
  items!: string[];

  @Prop({ type: String, default: null }) description!: string | null;

  /** Si es null, la escala es global de la empresa. */
  @Prop({ type: Types.ObjectId, ref: 'Course', default: null })
  course!: Types.ObjectId | null;
}

export type GradeScaleDocument = HydratedDocument<GradeScale>;
export const GradeScaleSchema = SchemaFactory.createForClass(GradeScale);
