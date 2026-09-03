import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LiveRecordingStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Grabación de una sesión.
 *
 * El vídeo no se compone en el servidor: lo graba el navegador de quien
 * presenta, que ya tiene todas las pistas mezcladas en pantalla, y lo sube por
 * trozos. Aquí solo vive la ficha; los bytes acaban en `StoredFile`, con el
 * mismo almacenamiento (disco, S3 o R2) que el resto de ficheros.
 */
@Schema({ collection: 'live_recordings', timestamps: true })
export class LiveRecording extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true, index: true })
  session!: Types.ObjectId;

  @Prop({ required: true, trim: true }) title!: string;

  @Prop({
    type: String,
    enum: Object.values(LiveRecordingStatus),
    default: LiveRecordingStatus.Recording,
    index: true,
  })
  status!: LiveRecordingStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recordedBy!: Types.ObjectId;

  /** Fichero final; `null` mientras se están recibiendo los trozos. */
  @Prop({ type: Types.ObjectId, ref: 'StoredFile', default: null })
  file!: Types.ObjectId | null;

  @Prop({ type: Date, required: true }) startedAt!: Date;
  @Prop({ type: Date, default: null }) finishedAt!: Date | null;

  @Prop({ default: 0 }) durationSeconds!: number;
  @Prop({ default: 0 }) size!: number;
  @Prop({ default: 'video/webm' }) mimeType!: string;

  /** Trozos recibidos hasta ahora; sirve para detectar huecos al ensamblar. */
  @Prop({ default: 0 })
  chunkCount!: number;

  /** Publicada al alumnado matriculado. */
  @Prop({ default: true })
  visibleToStudents!: boolean;

  @Prop({ type: String, default: null }) error!: string | null;
}

export type LiveRecordingDocument = HydratedDocument<LiveRecording>;
export const LiveRecordingSchema = SchemaFactory.createForClass(LiveRecording);

LiveRecordingSchema.index({ tenant: 1, createdAt: -1 });
LiveRecordingSchema.index({ session: 1, createdAt: -1 });
