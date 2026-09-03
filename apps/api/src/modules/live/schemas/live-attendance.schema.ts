import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LiveParticipantRole } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Asistencia a una sesión, una fila por persona y sesión.
 *
 * Se acumula en lugar de guardar una fila por entrada porque las reconexiones
 * son constantes —un móvil que cambia de wifi a datos genera tres— y el informe
 * que interesa es «cuánto tiempo estuvo», no «cuántas veces se le cayó».
 */
@Schema({ collection: 'live_attendance', timestamps: true })
export class LiveAttendance extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'LiveSession', required: true, index: true })
  session!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(LiveParticipantRole),
    default: LiveParticipantRole.Attendee,
  })
  role!: LiveParticipantRole;

  @Prop({ type: Date, required: true }) firstJoinAt!: Date;
  @Prop({ type: Date, default: null }) lastLeaveAt!: Date | null;

  /** Instante de la entrada en curso; `null` cuando no está conectada. */
  @Prop({ type: Date, default: null })
  openedAt!: Date | null;

  @Prop({ default: 0 }) totalSeconds!: number;
  @Prop({ default: 0 }) joins!: number;
}

export type LiveAttendanceDocument = HydratedDocument<LiveAttendance>;
export const LiveAttendanceSchema = SchemaFactory.createForClass(LiveAttendance);

LiveAttendanceSchema.index({ session: 1, user: 1 }, { unique: true });
LiveAttendanceSchema.index({ tenant: 1, user: 1 });
