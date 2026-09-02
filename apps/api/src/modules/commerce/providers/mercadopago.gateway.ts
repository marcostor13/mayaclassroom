import { Logger } from '@nestjs/common';
import type {
  GatewayCharge,
  GatewayChargeRequest,
  GatewayStatus,
  PaymentGateway,
} from './gateway';
import { gatewayFetch, readString } from './gateway';

const API = 'https://api.mercadopago.com';

/**
 * Mercado Pago.
 *
 * Se crea una «preferencia», que es su forma de describir lo que se va a
 * cobrar, y se manda al comprador a la dirección que devuelve. El cobro no se
 * confirma desde aquí: lo hace la pasarela y avisa después, así que `confirm`
 * solo pregunta cómo quedó.
 *
 * Se habla con su API por HTTP en lugar de con su SDK: son dos recursos, el
 * SDK arrastra dependencias y su versión de Node no siempre acompaña.
 */
export class MercadoPagoGateway implements PaymentGateway {
  private readonly logger = new Logger(MercadoPagoGateway.name);

  constructor(
    private readonly accessToken: string,
    private readonly sandbox: boolean,
  ) {}

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createCharge(request: GatewayChargeRequest): Promise<GatewayCharge> {
    const body = {
      items: [
        {
          id: request.orderReference,
          title: request.title,
          description: request.description ?? undefined,
          quantity: 1,
          currency_id: request.currency,
          // Mercado Pago cobra en unidades, no en céntimos.
          unit_price: request.amountCents / 100,
        },
      ],
      payer: {
        name: request.buyer.firstName,
        surname: request.buyer.lastName,
        email: request.buyer.email,
      },
      back_urls: {
        success: request.returnUrl,
        pending: request.returnUrl,
        failure: request.cancelUrl,
      },
      // Solo vuelve solo cuando el pago está aprobado; los pendientes se
      // quedan en su pantalla, que explica mejor que nosotros qué falta.
      auto_return: 'approved',
      external_reference: request.orderReference,
      notification_url: request.notificationUrl,
      statement_descriptor: request.brandName.slice(0, 22),
    };

    const response = await gatewayFetch(`${API}/checkout/preferences`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    const reference = readString(response, 'id');
    // En modo de prueba la dirección buena es la de pruebas: la de producción
    // existe igualmente y cobraría de verdad.
    const redirectUrl = this.sandbox
      ? (readString(response, 'sandbox_init_point') ?? readString(response, 'init_point'))
      : readString(response, 'init_point');

    if (!reference || !redirectUrl) {
      throw new Error('Mercado Pago no devolvió la dirección de pago.');
    }
    return { reference, redirectUrl };
  }

  /**
   * Estado de una preferencia.
   *
   * Se consultan los pagos por referencia externa y no la preferencia en sí,
   * porque la preferencia no sabe si acabó cobrándose: quien lo sabe es el
   * pago que se generó a partir de ella.
   */
  async confirm(chargeReference: string): Promise<GatewayStatus> {
    try {
      const response = await gatewayFetch(
        `${API}/v1/payments/search?external_reference=${encodeURIComponent(chargeReference)}`,
        { headers: this.headers },
      );

      const results = (response as { results?: unknown[] }).results ?? [];
      const approved = results.find((item) => readString(item, 'status') === 'approved');
      if (approved) {
        return { paid: true, failed: false, paymentId: readString(approved, 'id') };
      }

      const rejected = results.every((item) => {
        const status = readString(item, 'status');
        return status === 'rejected' || status === 'cancelled';
      });
      return { paid: false, failed: results.length > 0 && rejected, paymentId: null };
    } catch (error) {
      this.logger.warn(`No se pudo consultar el pago ${chargeReference}: ${String(error)}`);
      return { paid: false, failed: false, paymentId: null };
    }
  }

  /**
   * Estado de un pago concreto, el que llega en el aviso automático.
   *
   * Devuelve también la referencia del pedido para poder localizarlo: el aviso
   * solo trae el identificador del pago.
   */
  async paymentStatus(
    paymentId: string,
  ): Promise<{ orderReference: string | null; status: GatewayStatus }> {
    const response = await gatewayFetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: this.headers,
    });
    const state = readString(response, 'status');
    return {
      orderReference: readString(response, 'external_reference'),
      status: {
        paid: state === 'approved',
        failed: state === 'rejected' || state === 'cancelled',
        paymentId,
      },
    };
  }
}
