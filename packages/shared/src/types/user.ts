import { AuthProvider, ContextLevel, EnrolmentStatus, UserStatus } from '../enums';

export interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  idNumber?: string | null;
  avatarUrl?: string | null;
  description?: string | null;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  timezone: string;
  language: string;
  department?: string | null;
  institution?: string | null;
  interests: string[];
  status: UserStatus;
  provider: AuthProvider;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  mustChangePassword: boolean;
  isPlatformAdmin: boolean;
  lastLoginAt?: string | null;
  lastAccessAt?: string | null;
  customFields?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Ficha completa de un usuario: quién es, qué puede hacer y dónde.
 *
 * Va en una sola respuesta porque las tres cosas se miran juntas —se abre la
 * ficha de alguien justamente para entender por qué ve o no ve algo— y en
 * peticiones sueltas la pantalla se pintaría a trozos.
 */
export interface UserProfileDto extends UserDto {
  roles: {
    id: string;
    name: string;
    shortName: string;
    /** Dónde tiene el rol: el nombre de la empresa, la categoría o el curso. */
    contextLabel: string;
    contextLevel: ContextLevel;
  }[];
  courses: {
    id: string;
    fullName: string;
    shortName: string;
    /** Con qué papel participa; vacío si la matrícula no lleva rol asociado. */
    roleName: string;
    status: EnrolmentStatus;
    progress: number;
    lastAccess?: string | null;
  }[];
  badgeCount: number;
}

export interface UserSessionDto {
  id: string;
  userAgent: string;
  ip: string;
  device?: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}
