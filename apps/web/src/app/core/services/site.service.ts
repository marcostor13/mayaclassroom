import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CheckoutRequest,
  CheckoutResult,
  CheckoutSession,
  EnrolmentRequestDto,
  EnrolmentRequestResult,
  EnrolmentRequestStatus,
  PublicCourseDetailDto,
  PublicPaymentMethod,
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

  /** Ficha de venta de un curso. `ref` admite el identificador o el nombre corto. */
  publicCourse(slug: string, ref: string): Observable<PublicCourseDetailDto> {
    return this.api.get<PublicCourseDetailDto>(`/site/public/${slug}/courses/${ref}`);
  }

  /** Formas de pago que la empresa tiene activas y configuradas. */
  paymentMethods(slug: string): Observable<PublicPaymentMethod[]> {
    return this.api.get<PublicPaymentMethod[]>(`/site/public/${slug}/payment-methods`);
  }

  checkout(slug: string, payload: CheckoutRequest): Observable<CheckoutSession> {
    return this.api.post<CheckoutSession>(`/site/public/${slug}/checkout`, payload);
  }

  /**
   * Estado de una compra al volver de la pasarela.
   *
   * La confirmación la hace el servidor consultando a la pasarela: lo que trae
   * la dirección de vuelta lo controla el navegador y no basta para dar por
   * bueno un pago.
   */
  orderStatus(slug: string, reference: string): Observable<CheckoutResult> {
    return this.api.get<CheckoutResult>(`/site/public/${slug}/orders/${reference}`);
  }

  /**
   * Resuelve un pedido de la pasarela de prueba.
   *
   * La API vuelve a comprobar que el pedido es de esa pasarela y que la
   * empresa la tiene encendida: lo que decide aquí el navegador es solo si el
   * pago simulado sale aprobado o rechazado.
   */
  simulatePayment(slug: string, reference: string, approve: boolean): Observable<CheckoutResult> {
    return this.api.post<CheckoutResult>(
      `/site/public/${slug}/orders/${reference}/simulate`,
      { approve },
    );
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
