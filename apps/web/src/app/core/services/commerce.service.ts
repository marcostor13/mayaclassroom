import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  OrderDto,
  OrderStatus,
  PaymentSettingsDto,
} from '@maya/shared';
import { ApiService } from './api.service';

/** Lo que la empresa envía al guardar sus ajustes de cobro. */
export interface PaymentSettingsPayload {
  currency?: string;
  mercadoPago?: {
    enabled?: boolean;
    publicKey?: string | null;
    /** Ausente deja la credencial como estaba; vacío la borra. */
    accessToken?: string | null;
    sandbox?: boolean;
  };
  paypal?: {
    enabled?: boolean;
    clientId?: string | null;
    secret?: string | null;
    sandbox?: boolean;
  };
  manual?: { enabled?: boolean; instructions?: string | null };
}

/** Cobros y pedidos de la empresa. */
@Injectable({ providedIn: 'root' })
export class CommerceService {
  private readonly api = inject(ApiService);

  settings(): Observable<PaymentSettingsDto> {
    return this.api.get<PaymentSettingsDto>('/payments/settings');
  }

  updateSettings(payload: PaymentSettingsPayload): Observable<PaymentSettingsDto> {
    return this.api.patch<PaymentSettingsDto>('/payments/settings', payload);
  }

  orders(status?: OrderStatus): Observable<OrderDto[]> {
    return this.api.get<OrderDto[]>('/orders', status ? { status } : {});
  }

  updateOrder(id: string, status: OrderStatus, note?: string): Observable<OrderDto> {
    return this.api.patch<OrderDto>(`/orders/${id}`, { status, note });
  }
}
