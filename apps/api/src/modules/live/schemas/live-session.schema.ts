import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DEFAULT_LIVE_SETTINGS, LiveSessionMode, LiveSessionStatus } from '@maya/shared';
import type { LiveSessionSettings } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Una reunión o clase en vivo.
 *
 * La sala no es un recurso del servidor: mientras nadie entra, esto es solo una
 * fila con una fecha y un código. El código —`maya-abc-defg`— es a la vez el
 * enlace que se comparte y la clave de la sala en la señalización, así que es
 * único en toda la plataforma, no solo dentro de la empresa: dos empresas con
 * el mismo código acabarían en la misma sala de Socket.IO.
 */
@Schema({ collection: 'live_sessions', timestamps: true })
export class LiveSession extends TenantScopedDocument {
  @Prop({ required: true, trim: true }) title!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ required: true, unique: true, index: true }) roomCode!: string;

  @Prop({
    type: String,
    enum: Object.values(LiveSessionStatus),
    default: LiveSessionStatus.Scheduled,
    index: true,
  })
  status!: LiveSessionStatus;

  @Prop({ type: String, enum: Object.values(LiveSessionMode), default: LiveSessionMode.Class })
  mode!: LiveSessionMode;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  group!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  host!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  coHosts!: Types.ObjectId[];

  /** Evento del calendario espejo de esta sesión; se borra con ella. */
  @Prop({ type: Types.ObjectId, ref: 'CalendarEvent', default: null })
  calendarEvent!: Types.ObjectId | null;

  @Prop({ type: Date, required: true, index: true }) scheduledStart!: Date;
  @Prop({ type: Date, default: null }) scheduledEnd!: Date | null;
  @Prop({ type: Date, default: null }) startedAt!: Date | null;
  @Prop({ type: Date, default: null }) endedAt!: Date | null;

  @Prop({ type: Object, default: () => ({ ...DEFAULT_LIVE_SETTINGS }) })
  settings!: LiveSessionSettings;

  /** Abierta a toda la empresa o restringida al curso al que pertenece. */
  @Prop({ default: false })
  openToTenant!: boolean;

  @Prop({ default: 0 }) recordingCount!: number;

  /** Marca de agua del pico de asistencia, para el informe posterior. */
  @Prop({ default: 0 })
  peakParticipants!: number;
}

export type LiveSessionDocument = HydratedDocument<LiveSession>;
export const LiveSessionSchema = SchemaFactory.createForClass(LiveSession);

LiveSessionSchema.index({ tenant: 1, scheduledStart: -1 });
LiveSessionSchema.index({ tenant: 1, status: 1, scheduledStart: 1 });
LiveSessionSchema.index({ course: 1, scheduledStart: -1 });
