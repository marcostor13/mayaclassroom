import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GradeItemType, GradeType } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Ítem de calificación (`grade_items` de Moodle). */
@Schema({ collection: 'grade_items', timestamps: true })
export class GradeItem extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GradeCategory', default: null, index: true })
  category!: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(GradeItemType), required: true })
  itemType!: GradeItemType;

  /** Tipo de módulo si el ítem procede de una actividad. */
  @Prop({ type: String, default: null }) itemModule!: string | null;

  @Prop({ type: Types.ObjectId, default: null, index: true })
  itemInstance!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', default: null })
  courseModule!: Types.ObjectId | null;

  @Prop({ required: true }) name!: string;

  @Prop({ type: String, enum: Object.values(GradeType), default: GradeType.Value })
  gradeType!: GradeType;

  @Prop({ type: Types.ObjectId, ref: 'GradeScale', default: null })
  scale!: Types.ObjectId | null;

  @Prop({ default: 100 }) grademax!: number;
  @Prop({ default: 0 }) grademin!: number;
  @Prop({ type: Number, default: null }) gradepass!: number | null;

  @Prop({ default: 1 }) weight!: number;
  @Prop({ default: 1 }) multiplicator!: number;
  @Prop({ default: 0 }) offset!: number;

  @Prop({ default: false }) hidden!: boolean;
  @Prop({ default: false }) locked!: boolean;
  @Prop({ default: 0 }) sortOrder!: number;
  @Prop({ default: 2 }) decimals!: number;

  /** Excluye el ítem del cálculo del total del curso. */
  @Prop({ default: false })
  excludeFromTotal!: boolean;
}

export type GradeItemDocument = HydratedDocument<GradeItem>;
export const GradeItemSchema = SchemaFactory.createForClass(GradeItem);
GradeItemSchema.index({ course: 1, sortOrder: 1 });
GradeItemSchema.index({ itemModule: 1, itemInstance: 1 });
