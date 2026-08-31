import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Sección (tema o semana) de un curso. */
@Schema({ collection: 'course_sections', timestamps: true })
export class CourseSection extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  /** 0 = sección general (cabecera del curso). */
  @Prop({ required: true, index: true })
  sectionNumber!: number;

  @Prop({ type: String, default: null }) name!: string | null;
  @Prop({ type: String, default: null }) summary!: string | null;

  @Prop({ default: true }) visible!: boolean;

  /** Árbol de restricción de acceso serializado en JSON. */
  @Prop({ type: String, default: null }) availabilityJson!: string | null;

  /** Orden de los módulos dentro de la sección. */
  @Prop({ type: [Types.ObjectId], default: [] })
  moduleOrder!: Types.ObjectId[];
}

export type CourseSectionDocument = HydratedDocument<CourseSection>;
export const CourseSectionSchema = SchemaFactory.createForClass(CourseSection);

CourseSectionSchema.index({ course: 1, sectionNumber: 1 }, { unique: true });
