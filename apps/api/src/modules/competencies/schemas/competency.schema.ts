import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CompetencyProficiency, LearningPlanStatus } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

/** Marco de competencias. */
@Schema({ collection: 'competency_frameworks', timestamps: true })
export class CompetencyFramework extends TenantScopedDocument {
  @Prop({ required: true }) shortName!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) idNumber!: string | null;

  @Prop({ type: Types.ObjectId, ref: 'GradeScale', default: null })
  scale!: Types.ObjectId | null;

  @Prop({ default: true }) visible!: boolean;
}

export type CompetencyFrameworkDocument = HydratedDocument<CompetencyFramework>;
export const CompetencyFrameworkSchema = SchemaFactory.createForClass(CompetencyFramework);

/** Competencia dentro de un marco (árbol anidado). */
@Schema({ collection: 'competencies', timestamps: true })
export class Competency extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'CompetencyFramework', required: true, index: true })
  framework!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Competency', default: null, index: true })
  parent!: Types.ObjectId | null;

  @Prop({ required: true }) shortName!: string;
  @Prop({ type: String, default: null }) description!: string | null;
  @Prop({ type: String, default: null }) idNumber!: string | null;

  @Prop({ default: '/' }) path!: string;
  @Prop({ default: 0 }) depth!: number;
  @Prop({ default: 0 }) sortOrder!: number;

  /** Regla de consecución automática (`all`, `points`, `none`). */
  @Prop({ type: String, default: null })
  ruleType!: string | null;

  @Prop({ type: Object, default: {} })
  ruleConfig!: Record<string, unknown>;
}

export type CompetencyDocument = HydratedDocument<Competency>;
export const CompetencySchema = SchemaFactory.createForClass(Competency);
CompetencySchema.index({ framework: 1, sortOrder: 1 });

/** Competencia asociada a un curso o actividad. */
@Schema({ collection: 'competency_links', timestamps: true })
export class CompetencyLink extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Competency', required: true, index: true })
  competency!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'CourseModule', default: null, index: true })
  courseModule!: Types.ObjectId | null;

  /** Qué hacer al completar la actividad: `none`, `attach`, `complete`. */
  @Prop({ default: 'attach' })
  ruleOutcome!: string;
}

export type CompetencyLinkDocument = HydratedDocument<CompetencyLink>;
export const CompetencyLinkSchema = SchemaFactory.createForClass(CompetencyLink);

/** Evaluación de una competencia para un usuario. */
@Schema({ collection: 'user_competencies', timestamps: true })
export class UserCompetency extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Competency', required: true, index: true })
  competency!: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(CompetencyProficiency),
    default: CompetencyProficiency.NotRated,
  })
  proficiency!: CompetencyProficiency;

  @Prop({ type: Number, default: null }) grade!: number | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  reviewer!: Types.ObjectId | null;

  @Prop({ type: [{ note: String, courseId: Types.ObjectId, date: Date }], default: [] })
  evidence!: { note: string; courseId?: Types.ObjectId; date: Date }[];
}

export type UserCompetencyDocument = HydratedDocument<UserCompetency>;
export const UserCompetencySchema = SchemaFactory.createForClass(UserCompetency);
UserCompetencySchema.index({ user: 1, competency: 1 }, { unique: true });

/** Plan de aprendizaje de un usuario. */
@Schema({ collection: 'learning_plans', timestamps: true })
export class LearningPlan extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({
    type: String,
    enum: Object.values(LearningPlanStatus),
    default: LearningPlanStatus.Draft,
  })
  status!: LearningPlanStatus;

  @Prop({ type: Date, default: null }) dueDate!: Date | null;

  @Prop({ type: [Types.ObjectId], ref: 'Competency', default: [] })
  competencies!: Types.ObjectId[];
}

export type LearningPlanDocument = HydratedDocument<LearningPlan>;
export const LearningPlanSchema = SchemaFactory.createForClass(LearningPlan);
