import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { PermissionValue } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Permiso de un rol sobre una capacidad, opcionalmente anulado (override) en un
 * contexto concreto. Si `context` es null la definición es la del rol base.
 */
@Schema({ collection: 'role_capabilities', timestamps: true })
export class RoleCapability extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  role!: Types.ObjectId;

  @Prop({ required: true, index: true })
  capability!: string;

  @Prop({ type: Number, enum: Object.values(PermissionValue).filter((v) => typeof v === 'number'), required: true })
  permission!: PermissionValue;

  /** Contexto del override. `null` = definición base del rol. */
  @Prop({ type: Types.ObjectId, ref: 'Context', default: null, index: true })
  context!: Types.ObjectId | null;
}

export type RoleCapabilityDocument = HydratedDocument<RoleCapability>;
export const RoleCapabilitySchema = SchemaFactory.createForClass(RoleCapability);

RoleCapabilitySchema.index({ role: 1, capability: 1, context: 1 }, { unique: true });
RoleCapabilitySchema.index({ context: 1, capability: 1 });
