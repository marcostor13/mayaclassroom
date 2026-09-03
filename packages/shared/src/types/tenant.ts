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

/* ----------------------------- Dominio propio ----------------------------- */

/**
 * En qué punto está el dominio propio de una empresa.
 *
 * Es un estado y no un par de banderas porque el camino tiene una sola
 * dirección —se pide, se comprueba, queda activo— y con banderas sueltas
 * aparecen combinaciones que no significan nada (verificado pero sin nombre).
 */
export enum TenantDomainStatus {
  /** Nadie ha pedido ninguno. */
  None = 'none',
  /** Pedido y a la espera de que el DNS apunte a donde debe. */
  Pending = 'pending',
  /** Comprobado: el dominio sirve la página de la empresa. */
  Active = 'active',
  /** Estuvo activo y ha dejado de resolver; la página sigue en el de siempre. */
  Failed = 'failed',
}

/** El dominio propio de una empresa tal y como lo ve quien la administra. */
export interface TenantDomainDto {
  status: TenantDomainStatus;
  /** El nombre pedido, con o sin verificar. `null` si no hay ninguno. */
  hostname: string | null;
  /** Instrucciones de DNS que hay que dejar puestas. Siempre las dos. */
  records: TenantDomainRecord[];
  /** Cuándo se comprobó por última vez, en ISO. */
  checkedAt: string | null;
  /** Desde cuándo está activo, en ISO. */
  verifiedAt: string | null;
  /** Por qué falló la última comprobación, en cristiano. */
  lastError: string | null;
}

/** Un registro que la empresa tiene que crear en su proveedor de DNS. */
export interface TenantDomainRecord {
  type: 'CNAME' | 'TXT';
  /** Nombre completo del registro, para pegarlo tal cual. */
  name: string;
  value: string;
  /** Para qué sirve, porque quien lo pega no suele saber de DNS. */
  purpose: string;
}

/** Lo que la página pública necesita saber del anfitrión que la sirve. */
export interface HostResolutionDto {
  /** Empresa a la que pertenece el dominio, o `null` si es el de la plataforma. */
  tenantSlug: string | null;
}
