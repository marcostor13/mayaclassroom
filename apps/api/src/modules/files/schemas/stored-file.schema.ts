import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Fichero almacenado. Réplica simplificada de la *Files API* de Moodle: cada
 * fichero pertenece a un contexto, un componente y un «área de fichero», lo que
 * permite adjuntarlos a cualquier entidad sin acoplar colecciones.
 */
@Schema({ collection: 'files', timestamps: true })
export class StoredFile extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Context', default: null, index: true })
  context!: Types.ObjectId | null;

  /** Componente propietario: `mod/assign`, `user`, `course`… */
  @Prop({ required: true, index: true })
  component!: string;

  /** Área dentro del componente: `submission_files`, `attachment`, `avatar`… */
  @Prop({ required: true, index: true })
  fileArea!: string;

  /** Identificador del elemento concreto (entrega, mensaje, etc.). */
  @Prop({ type: Types.ObjectId, default: null, index: true })
  itemId!: Types.ObjectId | null;

  @Prop({ required: true }) filename!: string;
  @Prop({ required: true }) storageKey!: string;
  @Prop({ required: true }) mimeType!: string;
  @Prop({ required: true }) size!: number;
  @Prop({ required: true }) checksum!: string;

  @Prop({ default: '/' }) filePath!: string;
  @Prop({ type: String, default: null }) thumbnailKey!: string | null;
  @Prop({ type: String, default: null }) license!: string | null;
  @Prop({ type: String, default: null }) author!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  /** Los ficheros públicos se sirven sin comprobación de permisos. */
  @Prop({ default: false })
  isPublic!: boolean;

  @Prop({ default: 0 })
  downloadCount!: number;
}

export type StoredFileDocument = HydratedDocument<StoredFile>;
export const StoredFileSchema = SchemaFactory.createForClass(StoredFile);

StoredFileSchema.index({ component: 1, fileArea: 1, itemId: 1 });
StoredFileSchema.index({ tenant: 1, owner: 1 });
