import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ _id: true })
export class FeedbackItem {
  @Prop({
    type: String,
    enum: ['textfield', 'textarea', 'multichoice', 'numeric', 'info', 'label'],
    required: true,
  })
  type!: 'textfield' | 'textarea' | 'multichoice' | 'numeric' | 'info' | 'label';

  @Prop({ required: true }) label!: string;
  @Prop({ default: false }) required!: boolean;
  @Prop({ default: 0 }) position!: number;
  @Prop({ type: [String], default: [] }) options!: string[];
}

@Schema({ collection: 'mod_feedback', timestamps: true })
export class Feedback extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ default: true }) anonymous!: boolean;
  @Prop({ default: false }) multipleSubmit!: boolean;

  @Prop({ type: Date, default: null }) timeOpen!: Date | null;
  @Prop({ type: Date, default: null }) timeClose!: Date | null;

  @Prop({ type: [FeedbackItem], default: [] })
  items!: FeedbackItem[];
}

export type FeedbackDocument = HydratedDocument<Feedback>;
export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

@Schema({ collection: 'mod_feedback_responses', timestamps: true })
export class FeedbackResponse extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Feedback', required: true, index: true })
  feedback!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  user!: Types.ObjectId | null;

  /** Respuestas indexadas por identificador de ítem. */
  @Prop({ type: Object, default: {} })
  answers!: Record<string, unknown>;
}

export type FeedbackResponseDocument = HydratedDocument<FeedbackResponse>;
export const FeedbackResponseSchema = SchemaFactory.createForClass(FeedbackResponse);
