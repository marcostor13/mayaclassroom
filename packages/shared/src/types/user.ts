import { AuthProvider, UserStatus } from '../enums';

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

export interface UserProfileDto extends UserDto {
  roles: { id: string; name: string; shortName: string; contextLabel: string }[];
  courses: { id: string; fullName: string; shortName: string; roleName: string }[];
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
