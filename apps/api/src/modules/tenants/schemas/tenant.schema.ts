import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { DEFAULT_TENANT_BRANDING, DEFAULT_TIMEZONE, TenantPlan, TenantStatus } from '@maya/shared';
import { BaseDocument } from '../../../common/schemas/base.schema';

@Schema({ _id: false })
export class TenantBrandingSchema {
  @Prop({ default: DEFAULT_TENANT_BRANDING.primaryColor })
  primaryColor!: string;

  @Prop({ default: DEFAULT_TENANT_BRANDING.accentColor })
  accentColor!: string;

  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  @Prop({ type: String, default: null })
  faviconUrl!: string | null;

  @Prop({ type: String, default: null })
  loginBackgroundUrl!: string | null;

  @Prop({ type: String, default: null })
  customCss!: string | null;

  @Prop({ type: String, default: null })
  welcomeMessage!: string | null;
}

@Schema({ _id: false })
export class PasswordPolicySchema {
  @Prop({ default: 8 }) minLength!: number;
  @Prop({ default: true }) requireUppercase!: boolean;
  @Prop({ default: true }) requireNumber!: boolean;
  @Prop({ default: false }) requireSymbol!: boolean;
  @Prop({ default: 0 }) expiryDays!: number;
}

@Schema({ _id: false })
export class TenantSettingsSchema {
  @Prop({ default: 'es' }) defaultLanguage!: string;
  @Prop({ default: DEFAULT_TIMEZONE }) timezone!: string;
  @Prop({ default: false }) allowSelfRegistration!: boolean;
  @Prop({ default: true }) requireEmailVerification!: boolean;
  @Prop({ default: false }) allowGuestAccess!: boolean;
  @Prop({ type: PasswordPolicySchema, default: () => ({}) })
  passwordPolicy!: PasswordPolicySchema;
  @Prop({ default: false }) enforceTwoFactor!: boolean;
  @Prop({ type: String, default: null }) sitePolicyUrl!: string | null;
  @Prop({ type: String, default: null }) supportEmail!: string | null;
  @Prop({ default: 1 }) weekStart!: number;
  @Prop({ default: 2 }) gradeDecimals!: number;
}

@Schema({ _id: false })
export class TenantLimitsSchema {
  @Prop({ default: 500 }) maxUsers!: number;
  @Prop({ default: 100 }) maxCourses!: number;
  @Prop({ default: 10 * 1024 * 1024 * 1024 }) maxStorageBytes!: number;
  @Prop({ default: 0 }) usedStorageBytes!: number;
}

/**
 * Empresa (tenant). Cada empresa es un espacio completamente aislado con sus
 * usuarios, categorías, cursos, roles y marca propia.
 */
@Schema({ collection: 'tenants', timestamps: true })
export class Tenant extends BaseDocument {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: null }) legalName!: string | null;
  @Prop({ type: String, default: null }) taxId!: string | null;

  /** Dominio propio opcional para resolver el tenant automáticamente. */
  @Prop({ type: String, default: null, index: true, sparse: true })
  domain!: string | null;

  @Prop({ required: true, lowercase: true, trim: true })
  contactEmail!: string;

  @Prop({ type: String, default: null }) contactPhone!: string | null;

  @Prop({ type: String, enum: Object.values(TenantStatus), default: TenantStatus.Trial, index: true })
  status!: TenantStatus;

  @Prop({ type: String, enum: Object.values(TenantPlan), default: TenantPlan.Free })
  plan!: TenantPlan;

  @Prop({ type: TenantBrandingSchema, default: () => ({}) })
  branding!: TenantBrandingSchema;

  @Prop({ type: TenantSettingsSchema, default: () => ({}) })
  settings!: TenantSettingsSchema;

  @Prop({ type: TenantLimitsSchema, default: () => ({}) })
  limits!: TenantLimitsSchema;

  /** Marca el tenant reservado a la administración de la plataforma. */
  @Prop({ default: false })
  isSystem!: boolean;
}

export type TenantDocument = HydratedDocument<Tenant>;
export const TenantSchema = SchemaFactory.createForClass(Tenant);

TenantSchema.index({ name: 'text', slug: 'text' });
