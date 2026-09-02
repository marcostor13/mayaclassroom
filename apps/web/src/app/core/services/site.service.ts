import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EnrolmentRequestDto,
  EnrolmentRequestResult,
  EnrolmentRequestStatus,
  PublicSiteDto,
  TenantSiteDto,
} from '@maya/shared';
import { ApiService } from './api.service';

/** La página pública de la empresa: su diseño, su catálogo y sus solicitudes. */
@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly api = inject(ApiService);

  /* --------------------------------- Público ------------------------------ */

  /** No necesita sesión: es la puerta de entrada de quien aún no es alumno. */
  publicSite(slug: string): Observable<PublicSiteDto> {
    return this.api.get<PublicSiteDto>(`/site/public/${slug}`);
  }

  requestPlace(
    slug: string,
    payload: {
      courseId: string;
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      message?: string;
    },
  ): Observable<EnrolmentRequestResult> {
    return this.api.post<EnrolmentRequestResult>(`/site/public/${slug}/requests`, payload);
  }

  /* ------------------------------ Administración -------------------------- */

  mine(): Observable<TenantSiteDto> {
    return this.api.get<TenantSiteDto>('/site');
  }

  update(payload: Partial<TenantSiteDto>): Observable<TenantSiteDto> {
    return this.api.patch<TenantSiteDto>('/site', payload);
  }

  requests(status?: EnrolmentRequestStatus): Observable<EnrolmentRequestDto[]> {
    return this.api.get<EnrolmentRequestDto[]>('/site/requests', status ? { status } : {});
  }

  resolveRequest(
    id: string,
    status: EnrolmentRequestStatus,
    note?: string,
  ): Observable<EnrolmentRequestDto> {
    return this.api.patch<EnrolmentRequestDto>(`/site/requests/${id}`, { status, note });
  }
}
