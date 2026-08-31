import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CompletionTracking, GroupMode, ModuleType } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Módulo de curso (`course_modules` en Moodle): la instancia genérica que enlaza
 * una sección con la instancia concreta de una actividad o recurso.
 */
@Schema({ collection: 'course_modules', timestamps: true })
export class CourseModule extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseSection', required: true, index: true })
  section!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ModuleType), required: true, index: true })
  moduleType!: ModuleType;

  /** Identificador del documento de la actividad concreta. */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  instance!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ default: true, index: true }) visible!: boolean;
  /** Disponible pero no listado en la página del curso. */
  @Prop({ default: false }) stealth!: boolean;

  @Prop({ default: 0 }) sortOrder!: number;
  @Prop({ default: 0 }) indent!: number;

  @Prop({ type: Number, enum: [0, 1, 2], default: GroupMode.NoGroups })
  groupMode!: GroupMode;

  @Prop({ type: Types.ObjectId, ref: 'Grouping', default: null })
  grouping!: Types.ObjectId | null;

  @Prop({ type: Number, enum: [0, 1, 2], default: CompletionTracking.None })
  completionTracking!: CompletionTracking;

  /** Condiciones de finalización automática. */
  @Prop({ type: Object, default: {} })
  completionRules!: Record<string, unknown>;

  @Prop({ type: Date, default: null }) completionExpected!: Date | null;

  @Prop({ type: String, default: null }) availabilityJson!: string | null;

  @Prop({ type: String, default: null }) idNumber!: string | null;

  /** Nota máxima si la actividad es calificable. */
  @Prop({ type: Number, default: null })
  gradeMax!: number | null;
}

export type CourseModuleDocument = HydratedDocument<CourseModule>;
export const CourseModuleSchema = SchemaFactory.createForClass(CourseModule);

CourseModuleSchema.index({ course: 1, section: 1, sortOrder: 1 });
CourseModuleSchema.index({ moduleType: 1, instance: 1 }, { unique: true });
