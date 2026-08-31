import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CalendarEventType } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'calendar_events', timestamps: true })
export class CalendarEvent extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ type: String, enum: Object.values(CalendarEventType), required: true, index: true })
  eventType!: CalendarEventType;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Group', default: null })
  group!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  category!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', default: null })
  courseModule!: Types.ObjectId | null;

  @Prop({ type: String, default: null }) moduleType!: string | null;

  @Prop({ type: Date, required: true, index: true }) startAt!: Date;
  @Prop({ type: Date, default: null }) endAt!: Date | null;
  @Prop({ default: false }) allDay!: boolean;

  @Prop({ type: String, default: null }) location!: string | null;
  @Prop({ type: String, default: null }) color!: string | null;

  /** Eventos generados por actividades (fechas de entrega, cierres…). */
  @Prop({ default: false })
  actionable!: boolean;

  @Prop({ type: String, default: null }) actionUrl!: string | null;

  /** Recordatorio en minutos antes del evento (0 = sin recordatorio). */
  @Prop({ default: 0 })
  reminderMinutes!: number;

  @Prop({ default: false }) reminderSent!: boolean;
}

export type CalendarEventDocument = HydratedDocument<CalendarEvent>;
export const CalendarEventSchema = SchemaFactory.createForClass(CalendarEvent);
CalendarEventSchema.index({ tenant: 1, startAt: 1 });
CalendarEventSchema.index({ course: 1, startAt: 1 });
CalendarEventSchema.index({ user: 1, startAt: 1 });
