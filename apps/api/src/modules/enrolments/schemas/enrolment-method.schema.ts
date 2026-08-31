import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EnrolmentMethod } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

/**
 * Instancia de un método de matriculación en un curso (equivalente a la tabla
 * `enrol` de Moodle). Cada curso puede tener varios métodos activos.
 */
@Schema({ collection: 'enrolment_methods', timestamps: true })
export class EnrolmentMethodConfig extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(EnrolmentMethod), required: true })
  method!: EnrolmentMethod;

  @Prop({ default: true }) enabled!: boolean;
  @Prop({ default: '' }) name!: string;

  /** Rol que se asigna al matricularse por este método. */
  @Prop({ type: Types.ObjectId, ref: 'Role', default: null })
  role!: Types.ObjectId | null;

  /** Clave de matriculación (automatricula). */
  @Prop({ type: String, default: null }) enrolmentKey!: string | null;

  @Prop({ type: String, default: null }) groupEnrolmentKey!: string | null;

  @Prop({ type: Date, default: null }) startDate!: Date | null;
  @Prop({ type: Date, default: null }) endDate!: Date | null;

  /** Duración en días de la matrícula (0 = ilimitada). */
  @Prop({ default: 0 }) enrolPeriodDays!: number;

  @Prop({ default: 0 }) maxEnrolled!: number;

  @Prop({ type: Types.ObjectId, ref: 'Cohort', default: null })
  cohort!: Types.ObjectId | null;

  @Prop({ default: false }) sendWelcomeMessage!: boolean;
  @Prop({ type: String, default: null }) welcomeMessage!: string | null;

  @Prop({ default: 0 }) sortOrder!: number;
}

export type EnrolmentMethodDocument = HydratedDocument<EnrolmentMethodConfig>;
export const EnrolmentMethodSchema = SchemaFactory.createForClass(EnrolmentMethodConfig);

EnrolmentMethodSchema.index({ course: 1, method: 1 });
