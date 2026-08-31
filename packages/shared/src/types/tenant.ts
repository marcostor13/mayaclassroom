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
