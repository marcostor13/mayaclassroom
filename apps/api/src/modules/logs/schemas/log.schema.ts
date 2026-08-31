import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { LogAction } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/**
 * Registro de eventos de la plataforma. Es la fuente de la que se derivan la
 * auditoría, los informes de participación y las analíticas de curso, de modo
 * que cada entrada guarda tanto el actor como el objeto sobre el que se actúa.
 */
@Schema({ collection: 'logs', timestamps: true })
export class Log extends TenantScopedDocument {
  /** Usuario que ejecuta la acción. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Usuario afectado, cuando es distinto del que ejecuta la acción. */
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  relatedUser!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Context', default: null })
  context!: Types.ObjectId | null;

  /** Origen del evento: `core`, `enrol/manual`, `mod/assign`, … */
  @Prop({ required: true, index: true }) component!: string;

  /** Tipo de entidad afectada: `course`, `enrolment`, `submission`, … */
  @Prop({ required: true, index: true }) target!: string;

  @Prop({ type: String, enum: Object.values(LogAction), required: true, index: true })
  action!: LogAction;

  /** Identificador del objeto afectado, en texto para admitir claves ajenas. */
  @Prop({ type: String, default: null }) objectId!: string | null;

  @Prop({ type: String, default: '' }) description!: string;
  @Prop({ type: String, default: '' }) ip!: string;
  @Prop({ type: String, default: '' }) userAgent!: string;
}

export type LogDocument = HydratedDocument<Log>;
export const LogSchema = SchemaFactory.createForClass(Log);

// Consultas habituales: auditoría por empresa, informes por curso y por usuario.
LogSchema.index({ tenant: 1, createdAt: -1 });
LogSchema.index({ course: 1, createdAt: -1 });
LogSchema.index({ course: 1, user: 1, createdAt: -1 });
LogSchema.index({ tenant: 1, user: 1, createdAt: -1 });
