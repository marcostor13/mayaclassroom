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
  roles: SessionRoleAssignment[];
  /** Capacidades efectivas en el contexto del tenant, precalculadas. */
  capabilities: string[];
}

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
}
