import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsCourseOverview,
  BadgeDto,
  BadgeStatus,
  CapabilityDefinition,
  CohortDto,
  IssuedBadgeDto,
  Paginated,
  TenantAdminCredentials,
  TenantCreatedDto,
  TenantDomainDto,
  TenantDto,
  TenantStatus,
  UserDto,
  UserProfileDto,
} from '../models';
import { ApiService } from './api.service';

export interface RoleSummary {
  id: string;
  shortName: string;
  name: string;
  description: string;
  assignableAt: string[];
  isSystem: boolean;
  /**
   * Empresa a la que pertenece. Nulo significa que es un rol de la plataforma:
   * la empresa lo puede usar y consultar, pero no editarlo, porque el cambio
   * afectaría a todas las demás.
   */
  tenant?: string | null;
}

export interface CohortMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  /* -------------------------------- Usuarios ----------------------------- */

  users(query: Record<string, string | number | undefined> = {}): Observable<Paginated<UserDto>> {
    return this.api.get<Paginated<UserDto>>('/users', query);
  }

  user(id: string): Observable<UserDto> {
    return this.api.get<UserDto>(`/users/${id}`);
  }

  /** Ficha completa: datos, roles y cursos en una sola petición. */
  userProfile(id: string): Observable<UserProfileDto> {
    return this.api.get<UserProfileDto>(`/users/${id}/profile`);
  }

  createUser(payload: Record<string, unknown>): Observable<UserDto> {
    return this.api.post<UserDto>('/users', payload);
  }

  updateUser(id: string, payload: Record<string, unknown>): Observable<UserDto> {
    return this.api.patch<UserDto>(`/users/${id}`, payload);
  }

  setUserStatus(id: string, status: string): Observable<UserDto> {
    return this.api.patch<UserDto>(`/users/${id}/status`, { status });
  }

  deleteUser(id: string) {
    return this.api.delete<{ deleted: boolean }>(`/users/${id}`);
  }

  /* --------------------------------- Roles ------------------------------- */

  roles(): Observable<RoleSummary[]> {
    return this.api.get<RoleSummary[]>('/rbac/roles');
  }

  capabilityCatalog(): Observable<{
    total: number;
    byComponent: Record<string, CapabilityDefinition[]>;
    items: CapabilityDefinition[];
  }> {
    return this.api.get('/rbac/capabilities');
  }

  roleCapabilities(roleId: string): Observable<Record<string, number>> {
    return this.api.get<Record<string, number>>(`/rbac/roles/${roleId}/capabilities`);
  }

  setRoleCapability(roleId: string, capability: string, permission: number) {
    return this.api.patch(`/rbac/roles/${roleId}/capabilities`, { capability, permission });
  }

  createRole(payload: { shortName: string; name: string; assignableAt: string[] }) {
    return this.api.post<RoleSummary>('/rbac/roles', payload);
  }

  /* -------------------------------- Empresa ------------------------------ */

  myTenant(): Observable<TenantDto> {
    return this.api.get<TenantDto>('/tenants/me');
  }

  updateMyTenant(payload: Record<string, unknown>): Observable<TenantDto> {
    return this.api.patch<TenantDto>('/tenants/me', payload);
  }

  /* ----------------------------- Dominio propio --------------------------- */

  /**
   * El dominio propio va por rutas aparte y no dentro del parche de la empresa
   * porque no es un dato más: enruta tráfico, y hasta que la API comprueba el
   * DNS no sirve nada. Guardarlo con el resto del formulario haría creer que
   * con escribirlo basta.
   */
  myDomain(): Observable<TenantDomainDto> {
    return this.api.get<TenantDomainDto>('/tenants/me/domain');
  }

  setMyDomain(hostname: string): Observable<TenantDomainDto> {
    return this.api.put<TenantDomainDto>('/tenants/me/domain', { hostname });
  }

  verifyMyDomain(): Observable<TenantDomainDto> {
    return this.api.post<TenantDomainDto>('/tenants/me/domain/verify');
  }

  removeMyDomain(): Observable<TenantDomainDto> {
    return this.api.delete<TenantDomainDto>('/tenants/me/domain');
  }

  tenants(query: Record<string, string | number | undefined> = {}): Observable<Paginated<TenantDto>> {
    return this.api.get<Paginated<TenantDto>>('/tenants', query);
  }

  /**
   * Alta de empresa. La respuesta trae también las credenciales del
   * administrador que se crea con ella; la contraseña temporal solo viaja aquí.
   */
  createTenant(payload: Record<string, unknown>): Observable<TenantCreatedDto> {
    return this.api.post<TenantCreatedDto>('/tenants', payload);
  }

  tenant(id: string): Observable<TenantDto> {
    return this.api.get<TenantDto>(`/tenants/${id}`);
  }

  /**
   * Emite una contraseña temporal nueva para la administración de la empresa.
   * Es el único camino de vuelta cuando se pierde la del alta, que no se
   * guarda en claro en ninguna parte.
   */
  resetTenantAdminPassword(id: string): Observable<TenantAdminCredentials> {
    return this.api.post<TenantAdminCredentials>(`/tenants/${id}/admin-password`, {});
  }

  updateTenant(id: string, payload: Record<string, unknown>): Observable<TenantDto> {
    return this.api.patch<TenantDto>(`/tenants/${id}`, payload);
  }

  setTenantStatus(id: string, status: TenantStatus): Observable<TenantDto> {
    return this.api.patch<TenantDto>(`/tenants/${id}/status`, { status });
  }

  deleteTenant(id: string): Observable<void> {
    return this.api.delete<void>(`/tenants/${id}`);
  }

  /* ------------------------- Cohortes e insignias ------------------------ */

  cohorts(query: Record<string, string | number> = {}): Observable<Paginated<CohortDto>> {
    return this.api.get<Paginated<CohortDto>>('/cohorts', query);
  }

  createCohort(payload: { name: string; description?: string }) {
    return this.api.post<CohortDto>('/cohorts', payload);
  }

  updateCohort(id: string, payload: Record<string, unknown>): Observable<CohortDto> {
    return this.api.patch<CohortDto>(`/cohorts/${id}`, payload);
  }

  deleteCohort(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/cohorts/${id}`);
  }

  cohortMembers(id: string): Observable<CohortMember[]> {
    return this.api.get<CohortMember[]>(`/cohorts/${id}/members`);
  }

  addCohortMembers(id: string, userIds: string[]): Observable<CohortDto> {
    return this.api.post<CohortDto>(`/cohorts/${id}/members`, { userIds });
  }

  removeCohortMembers(id: string, userIds: string[]): Observable<CohortDto> {
    return this.api.deleteWithBody<CohortDto>(`/cohorts/${id}/members`, { userIds });
  }

  /** Matricula de una vez a toda la cohorte en un curso. */
  syncCohortToCourse(
    id: string,
    courseId: string,
    roleShortName = 'student',
  ): Observable<{ enrolled: number }> {
    return this.api.post<{ enrolled: number }>(`/cohorts/${id}/sync/${courseId}`, {
      roleShortName,
    });
  }

  badges(courseId?: string): Observable<BadgeDto[]> {
    return this.api.get<BadgeDto[]>('/badges', { courseId });
  }

  createBadge(payload: Record<string, unknown>): Observable<BadgeDto> {
    return this.api.post<BadgeDto>('/badges', payload);
  }

  updateBadge(id: string, payload: Record<string, unknown>): Observable<BadgeDto> {
    return this.api.patch<BadgeDto>(`/badges/${id}`, payload);
  }

  setBadgeStatus(id: string, status: BadgeStatus): Observable<BadgeDto> {
    return this.api.patch<BadgeDto>(`/badges/${id}/status`, { status });
  }

  deleteBadge(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/badges/${id}`);
  }

  awardBadge(id: string, userId: string): Observable<IssuedBadgeDto> {
    return this.api.post<IssuedBadgeDto>(`/badges/${id}/award/${userId}`);
  }

  revokeBadge(id: string, userId: string): Observable<{ revoked: boolean }> {
    return this.api.delete<{ revoked: boolean }>(`/badges/${id}/award/${userId}`);
  }

  badgesOfUser(userId: string): Observable<IssuedBadgeDto[]> {
    return this.api.get<IssuedBadgeDto[]>(`/badges/users/${userId}`);
  }

  myBadges(): Observable<IssuedBadgeDto[]> {
    return this.api.get<IssuedBadgeDto[]>('/badges/me');
  }

  /* ------------------------------ Analíticas ----------------------------- */

  courseAnalytics(courseId: string): Observable<AnalyticsCourseOverview> {
    return this.api.get<AnalyticsCourseOverview>(`/analytics/courses/${courseId}`);
  }

  logs(query: Record<string, string | number | undefined> = {}) {
    return this.api.get<Paginated<Record<string, unknown>>>('/logs', query);
  }
}
