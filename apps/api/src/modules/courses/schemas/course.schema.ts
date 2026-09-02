import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CourseFormat, CourseVisibility, GroupMode, MAX_UPLOAD_BYTES } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Datos de venta de un curso. Ver `catalog` más abajo. */
@Schema({ _id: false })
export class CourseCatalogSchema {
  @Prop({ default: false, index: true }) listed!: boolean;
  /** En céntimos: el dinero en coma flotante acaba en errores de redondeo. */
  @Prop({ default: 0, min: 0 }) priceCents!: number;
  @Prop({ default: 'EUR' }) currency!: string;
  @Prop({ type: String, default: null }) headline!: string | null;
  @Prop({ type: [String], default: [] }) highlights!: string[];
  @Prop({ type: String, default: null }) level!: string | null;
  @Prop({ type: Number, default: null }) durationHours!: number | null;
}

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

  /**
   * Datos de venta, para el escaparate público.
   *
   * Van aparte de los campos lectivos porque responden a otra pregunta: `title`
   * y `summary` describen el curso a quien ya está dentro, mientras que
   * `headline` y `highlights` lo venden a quien todavía está decidiendo. Un
   * curso puede existir sin estar nunca a la venta, que es el caso por defecto.
   */
  @Prop({ type: CourseCatalogSchema, default: () => ({}) })
  catalog!: CourseCatalogSchema;
}

export type CourseDocument = HydratedDocument<Course>;
export const CourseSchema = SchemaFactory.createForClass(Course);

CourseSchema.index({ tenant: 1, shortName: 1 }, { unique: true });
CourseSchema.index({ tenant: 1, category: 1, sortOrder: 1 });
// El escaparate pide siempre lo mismo: los cursos a la venta y visibles de una
// empresa. Es la consulta más repetida de la parte pública, la única sin sesión
// detrás y, por tanto, la más expuesta.
CourseSchema.index({ tenant: 1, 'catalog.listed': 1, visibility: 1, sortOrder: 1 });
// `language_override` es obligatorio aquí: por defecto MongoDB usa el campo
// `language` del documento para elegir el stemmer, pero en un curso ese campo
// es el idioma en que se imparte (y admite null o códigos que MongoDB no
// reconoce). Sin este ajuste, insertar un curso con `language: null` falla con
// «found language override field in document with non-string type».
CourseSchema.index(
  { fullName: 'text', shortName: 'text', summary: 'text' },
  { default_language: 'es', language_override: 'textLanguage', name: 'course_text' },
);
