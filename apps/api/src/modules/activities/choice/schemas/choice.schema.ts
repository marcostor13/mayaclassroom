import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseDocument } from '../../../../common/schemas/base.schema';

@Schema({ _id: true })
export class ChoiceOption {
  @Prop({ required: true }) text!: string;
  @Prop({ default: 0 }) maxAnswers!: number;
}

@Schema({ collection: 'mod_choice', timestamps: true })
export class Choice extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenant!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) intro!: string | null;

  @Prop({ type: [ChoiceOption], default: [] })
  options!: ChoiceOption[];

  @Prop({ default: false }) allowMultiple!: boolean;
  @Prop({ default: true }) allowUpdate!: boolean;
  @Prop({ default: false }) limitAnswers!: boolean;

  @Prop({ type: String, enum: ['always', 'afteranswer', 'afterclose', 'never'], default: 'afteranswer' })
  showResults!: 'always' | 'afteranswer' | 'afterclose' | 'never';

  @Prop({ default: false }) publishAnonymous!: boolean;
  @Prop({ type: Date, default: null }) timeOpen!: Date | null;
  @Prop({ type: Date, default: null }) timeClose!: Date | null;
}

export type ChoiceDocument = HydratedDocument<Choice>;
export const ChoiceSchema = SchemaFactory.createForClass(Choice);

@Schema({ collection: 'mod_choice_answers', timestamps: true })
export class ChoiceAnswer extends BaseDocument {
  @Prop({ type: Types.ObjectId, ref: 'Choice', required: true, index: true })
  choice!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  optionIds!: string[];
}

export type ChoiceAnswerDocument = HydratedDocument<ChoiceAnswer>;
export const ChoiceAnswerSchema = SchemaFactory.createForClass(ChoiceAnswer);
ChoiceAnswerSchema.index({ choice: 1, user: 1 }, { unique: true });
