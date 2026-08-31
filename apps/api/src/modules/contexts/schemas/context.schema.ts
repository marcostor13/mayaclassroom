import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContextLevel } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Contexto jerárquico — pieza central del modelo de permisos de Moodle.
 *
 * Cada objeto sobre el que se pueden asignar roles (empresa, categoría, curso,
 * módulo, usuario) tiene un contexto. El campo `path` materializa la ruta
 * completa (`/<id>/<id>/…`) para poder resolver la herencia de permisos con una
 * sola consulta usando una expresión regular anclada al principio.
 */
@Schema({ collection: 'contexts', timestamps: true })
export class Context extends BaseDocument {
  @Prop({ type: String, enum: Object.values(ContextLevel), required: true, index: true })
  level!: ContextLevel;

  /** Identificador del objeto al que pertenece el contexto (null en `system`). */
  @Prop({ type: Types.ObjectId, default: null, index: true })
  instanceId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Context', default: null, index: true })
  parent!: Types.ObjectId | null;

  /** Ruta materializada: `/systemId/tenantId/categoryId/courseId/`. */
  @Prop({ required: true, index: true })
  path!: string;

  @Prop({ required: true, default: 0, index: true })
  depth!: number;

  /** Empresa a la que pertenece el contexto (null para el contexto de sistema). */
  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenant!: Types.ObjectId | null;

  /** Etiqueta legible, útil en los listados de asignación de roles. */
  @Prop({ default: '' })
  label!: string;
}

export type ContextDocument = HydratedDocument<Context>;
export const ContextSchema = SchemaFactory.createForClass(Context);

ContextSchema.index({ level: 1, instanceId: 1 }, { unique: true, sparse: true });
ContextSchema.index({ tenant: 1, level: 1 });
