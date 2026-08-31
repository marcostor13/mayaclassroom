import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Asignación de un rol a un usuario en un contexto concreto. */
@Schema({ collection: 'role_assignments', timestamps: true })
export class RoleAssignment extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  role!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Context', required: true, index: true })
  context!: Types.ObjectId;

  /** Copia desnormalizada de la ruta del contexto para acelerar la resolución. */
  @Prop({ required: true, index: true })
  contextPath!: string;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenant!: Types.ObjectId | null;

  /** Componente que creó la asignación (`manual`, `enrol/self`, `cohort`…). */
  @Prop({ default: 'manual' })
  component!: string;

  @Prop({ type: Date, default: null })
  timeStart!: Date | null;

  @Prop({ type: Date, default: null })
  timeEnd!: Date | null;
}

export type RoleAssignmentDocument = HydratedDocument<RoleAssignment>;
export const RoleAssignmentSchema = SchemaFactory.createForClass(RoleAssignment);

RoleAssignmentSchema.index({ user: 1, role: 1, context: 1 }, { unique: true });
RoleAssignmentSchema.index({ user: 1, contextPath: 1 });
RoleAssignmentSchema.index({ context: 1, role: 1 });
