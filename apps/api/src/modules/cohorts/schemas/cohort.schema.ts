import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Cohorte: conjunto de usuarios reutilizable para matriculación masiva. */
@Schema({ collection: 'cohorts', timestamps: true })
export class Cohort extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Context', required: true, index: true })
  context!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) idNumber!: string | null;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ default: true }) visible!: boolean;

  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  members!: Types.ObjectId[];
}

export type CohortDocument = HydratedDocument<Cohort>;
export const CohortSchema = SchemaFactory.createForClass(Cohort);
CohortSchema.index({ tenant: 1, name: 1 }, { unique: true });
