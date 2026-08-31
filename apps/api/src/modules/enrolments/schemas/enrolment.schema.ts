import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EnrolmentMethod, EnrolmentStatus } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/** Matrícula de un usuario en un curso. */
@Schema({ collection: 'enrolments', timestamps: true })
export class Enrolment extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(EnrolmentMethod), default: EnrolmentMethod.Manual })
  method!: EnrolmentMethod;

  @Prop({
    type: String,
    enum: Object.values(EnrolmentStatus),
    default: EnrolmentStatus.Active,
    index: true,
  })
  status!: EnrolmentStatus;

  @Prop({ type: Date, default: null }) timeStart!: Date | null;
  @Prop({ type: Date, default: null }) timeEnd!: Date | null;
  @Prop({ type: Date, default: null }) lastAccess!: Date | null;

  /** Cohorte de origen si la matrícula proviene de una sincronización. */
  @Prop({ type: Types.ObjectId, ref: 'Cohort', default: null })
  cohort!: Types.ObjectId | null;

  @Prop({ default: 0 }) progress!: number;
  @Prop({ type: Date, default: null }) completedAt!: Date | null;
}

export type EnrolmentDocument = HydratedDocument<Enrolment>;
export const EnrolmentSchema = SchemaFactory.createForClass(Enrolment);

EnrolmentSchema.index({ course: 1, user: 1 }, { unique: true });
EnrolmentSchema.index({ user: 1, status: 1 });
EnrolmentSchema.index({ tenant: 1, course: 1, status: 1 });
