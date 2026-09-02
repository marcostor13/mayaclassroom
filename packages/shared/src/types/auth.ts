import { AuthProvider, ContextLevel, UserStatus } from '../enums';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface SessionRoleAssignment {
  roleId: string;
  roleShortName: string;
  roleName: string;
  contextId: string;
  contextLevel: ContextLevel;
  contextPath: string;
  instanceId: string | null;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  status: UserStatus;
  provider: AuthProvider;
  language: string;
  timezone: string;
  isPlatformAdmin: boolean;
  twoFactorEnabled: boolean;
  /** Obliga a cambiar la contraseña temporal antes de usar la plataforma. */
  mustChangePassword: boolean;
  roles: SessionRoleAssignment[];
  /** Capacidades efectivas en el contexto del tenant, precalculadas. */
  capabilities: string[];
}

/**
 * Empresa entre las que elegir al entrar, cuando las mismas credenciales valen
 * en más de una. Solo lleva lo justo para pintar la tarjeta de elección.
 */
export interface TenantChoice {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  /**
   * Las credenciales son válidas en varias empresas y hace falta elegir una.
   * Cuando llega, `user` y `tokens` van vacíos: todavía no hay sesión.
   */
  requiresTenantChoice?: boolean;
  tenants?: TenantChoice[];
  /** Testigo corto que autoriza el segundo paso sin repetir la contraseña. */
  tenantChoiceToken?: string;
}
