import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MediaSourceKind } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Avance de una persona sobre un vídeo concreto.
 *
 * Una fila por persona y vídeo, no una por sesión de reproducción: lo que se
 * quiere responder es «¿ha visto este vídeo?», y guardar cada reproducción
 * suelta obligaría a agregarlas en cada consulta. El histórico que sí importa
 * —cuándo empezó, cuándo lo terminó, cuántas veces volvió— cabe en la propia
 * fila.
 *
 * `segments` guarda los tramos vistos, fusionados y ordenados. Es lo que
 * impide que arrastrar la barra hasta el final cuente como haber visto el
 * vídeo: el tiempo visto es la suma de los tramos, no la última posición.
 */
@Schema({ _id: false })
export class WatchedSegment {
  @Prop({ required: true }) from!: number;
  @Prop({ required: true }) to!: number;
}

@Schema({ collection: 'media_progress', timestamps: true })
export class MediaProgress extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', required: true, index: true })
  courseModule!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Identificador del bloque de lección o de la grabación. */
  @Prop({ required: true })
  mediaId!: string;

  @Prop({ type: String, enum: Object.values(MediaSourceKind), required: true })
  kind!: MediaSourceKind;

  @Prop({ type: String, default: null }) title!: string | null;

  @Prop({ default: 0 }) durationSeconds!: number;
  @Prop({ default: 0 }) watchedSeconds!: number;
  @Prop({ default: 0 }) lastPositionSeconds!: number;
  @Prop({ default: 0 }) percent!: number;

  @Prop({ type: [WatchedSegment], default: [] })
  segments!: WatchedSegment[];

  @Prop({ default: false, index: true }) completed!: boolean;
  @Prop({ type: Date, default: null }) completedAt!: Date | null;

  @Prop({ type: Date, default: Date.now }) firstPlayedAt!: Date;
  @Prop({ type: Date, default: Date.now }) lastPlayedAt!: Date;
  @Prop({ default: 0 }) playCount!: number;
}

export type MediaProgressDocument = HydratedDocument<MediaProgress>;
export const MediaProgressSchema = SchemaFactory.createForClass(MediaProgress);

MediaProgressSchema.index({ courseModule: 1, user: 1, mediaId: 1 }, { unique: true });
MediaProgressSchema.index({ tenant: 1, course: 1, user: 1 });
