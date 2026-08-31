import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AuthTokens,
  AuthenticatedUser,
  ContextLevel,
  LoginResponse,
  TenantBranding,
} from '../models';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

const ACCESS_KEY = 'maya.access';
const REFRESH_KEY = 'maya.refresh';
const TENANT_KEY = 'maya.tenant';

export interface PublicTenantProfile {
  id: string;
  slug: string;
  name: string;
  branding: TenantBranding;
  allowSelfRegistration: boolean;
  allowGuestAccess: boolean;
  sitePolicyUrl?: string | null;
  supportEmail?: string | null;
  defaultLanguage: string;
}

/**
 * Estado de sesión basado en señales. Mantiene el usuario autenticado, sus
 * capacidades efectivas y la empresa activa.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<AuthenticatedUser | null>(null);
  private readonly tenantSignal = signal<string>(
    localStorage.getItem(TENANT_KEY) ?? environment.defaultTenant,
  );
  private readonly loadingSignal = signal(false);

  readonly user = this.userSignal.asReadonly();
  readonly tenantSlug = this.tenantSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly capabilities = computed(() => new Set(this.userSignal()?.capabilities ?? []));
  readonly isPlatformAdmin = computed(() => this.userSignal()?.isPlatformAdmin ?? false);

  /** Roles del usuario agrupados por curso, para decidir vistas de profesor. */
  readonly courseRoles = computed(() => {
    const map = new Map<string, string[]>();
    for (const role of this.userSignal()?.roles ?? []) {
      if (role.contextLevel !== ContextLevel.Course || !role.instanceId) continue;
      const list = map.get(role.instanceId) ?? [];
      list.push(role.roleShortName);
      map.set(role.instanceId, list);
    }
    return map;
  });

  readonly isTeacherAnywhere = computed(() =>
    (this.userSignal()?.roles ?? []).some((role) =>
      ['editingteacher', 'teacher', 'manager', 'coursecreator'].includes(role.roleShortName),
    ),
  );

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  setTenant(slug: string): void {
    localStorage.setItem(TENANT_KEY, slug);
    this.tenantSignal.set(slug);
  }

  /** ¿Tiene el usuario la capacidad en el contexto de la empresa? */
  can(capability: string): boolean {
    return this.isPlatformAdmin() || this.capabilities().has(capability);
  }

  canAny(capabilities: string[]): boolean {
    return capabilities.some((capability) => this.can(capability));
  }

  /** Rol del usuario en un curso concreto. */
  roleInCourse(courseId: string): string[] {
    return this.courseRoles().get(courseId) ?? [];
  }

  isTeacherOf(courseId: string): boolean {
    const roles = this.roleInCourse(courseId);
    return roles.some((role) => ['editingteacher', 'teacher', 'manager'].includes(role));
  }

  tenantProfile(slug: string): Observable<PublicTenantProfile> {
    return this.api.get<PublicTenantProfile>(`/tenants/public/${slug}`);
  }

  login(credentials: {
    login: string;
    password: string;
    tenantSlug: string;
    totp?: string;
  }): Observable<LoginResponse> {
    this.loadingSignal.set(true);
    return this.api.post<LoginResponse>('/auth/login', credentials).pipe(
      tap({
        next: (response) => {
          this.loadingSignal.set(false);
          if (response.requiresTwoFactor) return;
          this.storeTokens(response.tokens);
          this.setTenant(credentials.tenantSlug);
          this.userSignal.set(response.user);
        },
        error: () => this.loadingSignal.set(false),
      }),
    );
  }

  register(payload: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantSlug: string;
  }): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/register', payload).pipe(
      tap((response) => {
        this.storeTokens(response.tokens);
        this.setTenant(payload.tenantSlug);
        this.userSignal.set(response.user);
      }),
    );
  }

  /** Recupera la sesión al arrancar la aplicación. */
  restore(): Observable<AuthenticatedUser> {
    return this.api.get<AuthenticatedUser>('/auth/me').pipe(
      tap((user) => {
        this.userSignal.set(user);
        this.setTenant(user.tenantSlug);
      }),
    );
  }

  refreshSession(): Observable<AuthTokens> {
    return this.api
      .post<AuthTokens>('/auth/refresh', { refreshToken: this.refreshToken })
      .pipe(tap((tokens) => this.storeTokens(tokens)));
  }

  logout(redirect = true): void {
    const token = this.refreshToken;
    if (token) {
      this.api.post('/auth/logout', { refreshToken: token }).subscribe({ error: () => undefined });
    }
    this.clear();
    if (redirect) void this.router.navigate(['/auth/login']);
  }

  forgotPassword(email: string, tenantSlug: string): Observable<{ sent: boolean }> {
    return this.api.post<{ sent: boolean }>('/auth/forgot-password', { email, tenantSlug });
  }

  resetPassword(token: string, password: string): Observable<{ reset: boolean }> {
    return this.api.post<{ reset: boolean }>('/auth/reset-password', { token, password });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ changed: boolean }> {
    return this.api.post<{ changed: boolean }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  verifyEmail(token: string): Observable<{ verified: boolean }> {
    return this.api.post<{ verified: boolean }>('/auth/verify-email', { token });
  }

  storeTokens(tokens: AuthTokens): void {
    if (!tokens.accessToken) return;
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.userSignal.set(null);
  }

  patchUser(patch: Partial<AuthenticatedUser>): void {
    const current = this.userSignal();
    if (current) this.userSignal.set({ ...current, ...patch });
  }
}
