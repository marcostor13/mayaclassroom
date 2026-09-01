import { TenantPlan, TenantStatus } from '../enums';
import { TenantBranding } from '../constants/branding';

export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  domain?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  status: TenantStatus;
  plan: TenantPlan;
  branding: TenantBranding;
  settings: TenantSettings;
  limits: TenantLimits;
  userCount?: number;
  courseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  defaultLanguage: string;
  timezone: string;
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  allowGuestAccess: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    expiryDays: number;
  };
  enforceTwoFactor: boolean;
  sitePolicyUrl?: string | null;
  supportEmail?: string | null;
  weekStart: 0 | 1;
  gradeDecimals: number;
}

export interface TenantLimits {
  maxUsers: number;
  maxCourses: number;
  maxStorageBytes: number;
  usedStorageBytes: number;
}

/**
 * Credenciales de la cuenta de administración creada junto con la empresa.
 * La contraseña temporal solo viaja en la respuesta de alta: no se almacena en
 * claro ni vuelve a mostrarse, de modo que quien crea la empresa debe
 * entregarla en ese momento (además del correo automático).
 */
export interface TenantAdminCredentials {
  userId: string;
  email: string;
  username: string;
  temporaryPassword: string;
  /** `false` si el correo de bienvenida no se pudo entregar. */
  emailSent: boolean;
}

/** Respuesta del alta de empresa: la empresa y su administrador inicial. */
export interface TenantCreatedDto {
  tenant: TenantDto;
  admin: TenantAdminCredentials;
}
