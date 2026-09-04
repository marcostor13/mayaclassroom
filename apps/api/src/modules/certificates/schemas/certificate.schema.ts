import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { CertificateAccessMode } from '@maya/shared';
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

/**
 * Certificado emitido.
 *
 * Guarda una copia de lo que certifica —nombre, curso, nota— en lugar de
 * resolverlo al enseñarlo: un certificado acredita lo que era cierto el día que
 * se expidió, y renombrar el curso después no debe cambiar lo que dice un
 * documento ya entregado. Es además lo que permite que el sello siga cuadrando.
 */
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

  /**
   * Número correlativo dentro de la empresa.
   *
   * El código es aleatorio para que no se pueda enumerar; el correlativo es
   * para citar el certificado en un registro interno («el número 128 de 2026»),
   * que es como se pide en una auditoría.
   */
  @Prop({ required: true, default: 0, index: true })
  serial!: number;

  /**
   * Sello HMAC del contenido con el secreto de la plataforma.
   *
   * Cualquiera puede calcular un SHA-256; solo quien tiene el secreto puede
   * producir un sello válido. Es lo que impide fabricar un certificado con un
   * código inventado o alterar el nombre de uno auténtico: al verificarlo, el
   * servidor recalcula el sello sobre la copia guardada y compara.
   */
  @Prop({ required: true, default: '' })
  hash!: string;

  /* --------- Copia de lo certificado, congelada al expedirlo ---------- */

  @Prop({ default: '' }) recipientName!: string;
  @Prop({ default: '' }) courseName!: string;
  @Prop({ type: Number, default: null }) grade!: number | null;
  @Prop({ type: Number, default: null }) gradeMax!: number | null;

  /** Trazo de la firma del alumno tal como estaba al expedirlo. */
  @Prop({ type: String, default: null })
  signatureImage!: string | null;

  @Prop({
    type: String,
    enum: Object.values(CertificateAccessMode),
    default: CertificateAccessMode.Download,
  })
  accessMode!: CertificateAccessMode;

  /**
   * Un certificado no se borra: se revoca.
   *
   * Borrarlo dejaría su código sin respuesta, y quien lo comprobara no sabría
   * si nunca existió o si se anuló. Revocado, la verificación lo dice.
   */
  @Prop({ default: false, index: true })
  revoked!: boolean;

  @Prop({ type: String, default: null }) revokedReason!: string | null;
  @Prop({ type: Date, default: null }) revokedAt!: Date | null;

  @Prop({ type: Date, default: Date.now }) issuedAt!: Date;
}

export type IssuedCertificateDocument = HydratedDocument<IssuedCertificate>;
export const IssuedCertificateSchema = SchemaFactory.createForClass(IssuedCertificate);
IssuedCertificateSchema.index({ course: 1, user: 1 }, { unique: true });
IssuedCertificateSchema.index({ tenant: 1, serial: 1 }, { unique: true });
