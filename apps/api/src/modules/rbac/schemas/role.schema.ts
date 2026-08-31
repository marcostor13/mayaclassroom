import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ContextLevel, RoleArchetype } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Rol. Un rol pertenece a una empresa (o es global si `tenant` es null, como
 * los roles del sistema) y agrupa un conjunto de capacidades.
 */
@Schema({ collection: 'roles', timestamps: true })
export class Role extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenant!: Types.ObjectId | null;

  @Prop({ required: true, trim: true, index: true })
  shortName!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: String, enum: Object.values(RoleArchetype), default: null })
  archetype!: RoleArchetype | null;

  /** Niveles de contexto donde este rol puede asignarse. */
  @Prop({ type: [String], enum: Object.values(ContextLevel), default: [ContextLevel.Course] })
  assignableAt!: ContextLevel[];

  @Prop({ default: 100 })
  sortOrder!: number;

  /** Los roles del sistema no pueden eliminarse. */
  @Prop({ default: false })
  isSystem!: boolean;
}

export type RoleDocument = HydratedDocument<Role>;
export const RoleSchema = SchemaFactory.createForClass(Role);

RoleSchema.index({ tenant: 1, shortName: 1 }, { unique: true });
