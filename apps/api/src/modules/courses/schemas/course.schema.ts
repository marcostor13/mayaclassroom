import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CourseFormat, CourseVisibility, GroupMode, MAX_UPLOAD_BYTES } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'courses', timestamps: true })
export class Course extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  category!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  shortName!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ type: String, default: null }) idNumber!: string | null;
  @Prop({ type: String, default: null }) summary!: string | null;
  @Prop({ type: String, default: null }) imageUrl!: string | null;

  @Prop({ type: String, enum: Object.values(CourseFormat), default: CourseFormat.Topics })
  format!: CourseFormat;

  @Prop({
    type: String,
    enum: Object.values(CourseVisibility),
    default: CourseVisibility.Visible,
    index: true,
  })
  visibility!: CourseVisibility;

  @Prop({ type: Date, default: null }) startDate!: Date | null;
  @Prop({ type: Date, default: null }) endDate!: Date | null;

  @Prop({ default: 10 }) numSections!: number;

  @Prop({ type: Number, enum: [0, 1, 2], default: GroupMode.NoGroups })
  groupMode!: GroupMode;

  @Prop({ default: false }) forceGroupMode!: boolean;
  @Prop({ default: true }) showGradebook!: boolean;
  @Prop({ default: true }) showActivityReports!: boolean;
  @Prop({ default: true }) enableCompletion!: boolean;
  @Prop({ default: false }) completionNotify!: boolean;
  @Prop({ type: String, default: null }) language!: string | null;
  @Prop({ default: MAX_UPLOAD_BYTES }) maxUploadBytes!: number;

  /** Configuración específica del formato (p. ej. actividad única). */
  @Prop({ type: Object, default: {} })
  formatOptions!: Record<string, unknown>;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ type: Object, default: {} })
  customFields!: Record<string, unknown>;

  /** Reglas de finalización del curso. */
  @Prop({ type: Object, default: { aggregation: 'all', criteria: [] } })
  completionCriteria!: Record<string, unknown>;

  @Prop({ default: 0 }) enrolledCount!: number;
  @Prop({ default: false }) isTemplate!: boolean;
  @Prop({ default: 0 }) sortOrder!: number;
}

export type CourseDocument = HydratedDocument<Course>;
export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ tenant: 1, shortName: 1 }, { unique: true });
CourseSchema.index({ tenant: 1, category: 1, sortOrder: 1 });
CourseSchema.index({ fullName: 'text', shortName: 'text', summary: 'text' });
