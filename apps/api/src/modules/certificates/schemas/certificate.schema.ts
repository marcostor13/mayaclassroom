import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TenantScopedDocument } from '../../../common/schemas/base.schema';

@Schema({ collection: 'certificate_templates', timestamps: true })
export class CertificateTemplate extends TenantScopedDocument {
  @Prop({ required: true }) name!: string;
  @Prop({ type: String, default: null }) backgroundUrl!: string | null;

  /** Plantilla HTML con marcadores `{{nombre}}`, `{{curso}}`, `{{fecha}}`… */
  @Prop({ required: true })
  bodyHtml!: string;

  @Prop({ type: String, enum: ['landscape', 'portrait'], default: 'landscape' })
  orientation!: 'landscape' | 'portrait';

  @Prop({ default: true }) showGrade!: boolean;
  @Prop({ default: true }) showDate!: boolean;
  @Prop({ default: true }) showQr!: boolean;
}

export type CertificateTemplateDocument = HydratedDocument<CertificateTemplate>;
export const CertificateTemplateSchema = SchemaFactory.createForClass(CertificateTemplate);

@Schema({ collection: 'issued_certificates', timestamps: true })
export class IssuedCertificate extends TenantScopedDocument {
  @Prop({ type: Types.ObjectId, ref: 'CertificateTemplate', required: true })
  template!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Course', required: true, index: true })
  course!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ type: Number, default: null }) grade!: number | null;
  @Prop({ type: Date, default: Date.now }) issuedAt!: Date;
}

export type IssuedCertificateDocument = HydratedDocument<IssuedCertificate>;
export const IssuedCertificateSchema = SchemaFactory.createForClass(IssuedCertificate);
IssuedCertificateSchema.index({ course: 1, user: 1 }, { unique: true });
