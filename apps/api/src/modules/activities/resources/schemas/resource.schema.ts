import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ModuleType } from '@maya/shared';
import { BaseDocument } from '../../../../common/schemas/base.schema';

/**
 * Recurso de curso. Una sola colección cubre Archivo, Carpeta, Página, URL,
 * Libro y Etiqueta; el campo `kind` actúa de discriminador.
 */
@Schema({ collection: 'mod_resources', timestamps: true })
export class CourseResource extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ModuleType), required: true, index: true })
  kind!: ModuleType;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  /** Página / Etiqueta: contenido HTML. */
  @Prop({ type: String, default: null }) content!: string | null;

  /** URL: enlace externo. */
  @Prop({ type: String, default: null }) externalUrl!: string | null;

  @Prop({ type: String, enum: ['auto', 'embed', 'new', 'open', 'download'], default: 'auto' })
  display!: 'auto' | 'embed' | 'new' | 'open' | 'download';

  /** Archivo / Carpeta: ficheros asociados. */
  @Prop({ type: [Types.ObjectId], ref: 'StoredFile', default: [] })
  files!: Types.ObjectId[];

  @Prop({ default: false }) showSize!: boolean;
  @Prop({ default: false }) showType!: boolean;
  @Prop({ default: false }) forceDownload!: boolean;
}

export type CourseResourceDocument = HydratedDocument<CourseResource>;
export const CourseResourceSchema = SchemaFactory.createForClass(CourseResource);
