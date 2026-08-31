import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ModuleType } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

/**
 * Actividades avanzadas de la Fase 3 (Lección, Glosario, Wiki, Taller, Base de
 * datos, Chat, SCORM, LTI, H5P y Encuesta predefinida). Comparten una misma
 * colección con configuración específica en `settings` y contenido en `entries`,
 * lo que permite añadir nuevos tipos sin migraciones.
 */
@Schema({ collection: 'mod_advanced', timestamps: true })
export class AdvancedActivity extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ModuleType), required: true, index: true })
  kind!: ModuleType;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ type: Number, default: null }) gradeMax!: number | null;

  /** Configuración específica del tipo de actividad. */
  @Prop({ type: Object, default: {} })
  settings!: Record<string, unknown>;
}

export type AdvancedActivityDocument = HydratedDocument<AdvancedActivity>;
export const AdvancedActivitySchema = SchemaFactory.createForClass(AdvancedActivity);

/**
 * Contenido de las actividades avanzadas: páginas de lección, entradas de
 * glosario, páginas de wiki, entregas de taller, registros de base de datos…
 */
@Schema({ collection: 'mod_advanced_entries', timestamps: true })
export class AdvancedEntry extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'AdvancedActivity', required: true, index: true })
  activity!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user!: Types.ObjectId | null;

  /** `page`, `entry`, `submission`, `assessment`, `record`, `message`… */
  @Prop({ required: true, index: true })
  entryType!: string;

  @Prop({ type: String, default: null }) title!: string | null;
  @Prop({ type: String, default: null }) content!: string | null;

  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;

  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  files!: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'AdvancedEntry', default: null })
  parent!: Types.ObjectId | null;

  @Prop({ default: true }) approved!: boolean;
  @Prop({ default: 0 }) sortOrder!: number;
  @Prop({ type: Number, default: null }) grade!: number | null;
}

export type AdvancedEntryDocument = HydratedDocument<AdvancedEntry>;
export const AdvancedEntrySchema = SchemaFactory.createForClass(AdvancedEntry);
AdvancedEntrySchema.index({ activity: 1, entryType: 1, sortOrder: 1 });
