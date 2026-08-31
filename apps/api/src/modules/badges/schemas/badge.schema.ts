import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BadgeCriteriaType, BadgeStatus, BadgeType } from '@maya/shared';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: true })
export class BadgeCriterion {
  @Prop({ type: String, enum: Object.values(BadgeCriteriaType), required: true })
  type!: BadgeCriteriaType;

  @Prop({ type: String, default: null }) description!: string | null;

  @Prop({ type: [Types.ObjectId], ref: 'CourseModule', default: [] })
  modules!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Course', default: [] })
  courses!: Types.ObjectId[];

  @Prop({ type: [Types.ObjectId], ref: 'Competency', default: [] })
  competencies!: Types.ObjectId[];

  @Prop({ type: Number, default: null }) minGrade!: number | null;
}

@Schema({ collection: 'badges', timestamps: true })
export class Badge extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Course', default: null, index: true })
  course!: Types.ObjectId | null;

  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) description!: string;
  @Prop({ type: String, default: null }) imageUrl!: string | null;

  @Prop({ type: String, enum: Object.values(BadgeType), default: BadgeType.Course })
  type!: BadgeType;

  @Prop({ type: String, enum: Object.values(BadgeStatus), default: BadgeStatus.Draft, index: true })
  status!: BadgeStatus;

  @Prop({ required: true }) issuerName!: string;
  @Prop({ required: true }) issuerEmail!: string;

  @Prop({ type: Date, default: null }) expiryDate!: Date | null;

  @Prop({ type: [BadgeCriterion], default: [] })
  criteria!: BadgeCriterion[];

  @Prop({ type: String, enum: ['all', 'any'], default: 'all' })
  criteriaAggregation!: 'all' | 'any';
}

export type BadgeDocument = HydratedDocument<Badge>;
export const BadgeSchema = SchemaFactory.createForClass(Badge);

@Schema({ collection: 'issued_badges', timestamps: true })
export class IssuedBadge extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'Badge', required: true, index: true })
  badge!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true }) uniqueHash!: string;
  @Prop({ type: Date, default: Date.now }) issuedAt!: Date;
  @Prop({ type: Date, default: null }) expiresAt!: Date | null;
}

export type IssuedBadgeDocument = HydratedDocument<IssuedBadge>;
export const IssuedBadgeSchema = SchemaFactory.createForClass(IssuedBadge);
IssuedBadgeSchema.index({ badge: 1, user: 1 }, { unique: true });
