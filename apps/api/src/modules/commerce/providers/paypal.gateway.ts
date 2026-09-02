import type {
  GatewayCharge,
  GatewayChargeRequest,
  GatewayStatus,
  PaymentGateway,
} from './gateway';
import { gatewayFetch, readString } from './gateway';

/**
 * PayPal, con su API de pedidos (v2).
 *
 * A diferencia de Mercado Pago, aquí el cobro no se cierra solo: al volver el
 * comprador hay que **capturar** el pedido. Por eso `confirm` captura en lugar
 * de limitarse a preguntar, y es idempotente a propósito —capturar dos veces
 * responde con un error que se traduce a «ya estaba cobrado», que es lo que
 * ocurre cuando alguien recarga la página de vuelta.
 */
export class PayPalGateway implements PaymentGateway {
  constructor(
    private readonly clientId: string,
    private readonly secret: string,
    private readonly sandbox: boolean,
  ) {}

  private get base(): string {
    return this.sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }

  /**
   * Testigo de aplicación.
   *
   * No se cachea: dura horas, pero guardarlo en memoria obliga a invalidarlo
   * cuando cambian las credenciales, y aquí se piden como mucho un par de
   * veces por compra.
   */
  private async token(): Promise<string> {
    const credentials = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');
    const response = await gatewayFetch(`${this.base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const token = readString(response, 'access_token');
    if (!token) throw new Error('PayPal no devolvió un testigo de acceso.');
    return token;
  }

  async createCharge(request: GatewayChargeRequest): Promise<GatewayCharge> {
    const token = await this.token();
    const response = await gatewayFetch(`${this.base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: request.orderReference,
            custom_id: request.orderReference,
            description: request.title.slice(0, 127),
            amount: {
              currency_code: request.currency,
              // PayPal cobra en unidades con dos decimales exactos.
              value: (request.amountCents / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          brand_name: request.brandName.slice(0, 127),
          user_action: 'PAY_NOW',
          return_url: request.returnUrl,
          cancel_url: request.cancelUrl,
        },
      }),
    });

    const reference = readString(response, 'id');
    const links = (response as { links?: unknown[] }).links ?? [];
    const approve = links.find((link) => readString(link, 'rel') === 'approve');
    const redirectUrl = approve ? readString(approve, 'href') : null;

    if (!reference || !redirectUrl) {
      throw new Error('PayPal no devolvió la dirección de pago.');
    }
    return { reference, redirectUrl };
  }

  async confirm(chargeReference: string): Promise<GatewayStatus> {
    const token = await this.token();
    try {
      const response = await gatewayFetch(
        `${this.base}/v2/checkout/orders/${encodeURIComponent(chargeReference)}/capture`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        },
      );
      const status = readString(response, 'status');
      return {
        paid: status === 'COMPLETED',
        failed: status === 'VOIDED',
        // PayPal identifica el cobro por el propio pedido: el identificador de
        // la captura vive anidado y no aporta nada para conciliar.
        paymentId: chargeReference,
      };
    } catch {
      // Capturar un pedido ya capturado falla; se consulta cómo quedó en vez
      // de dar la compra por perdida.
      return this.lookup(chargeReference, token);
    }
  }

  private async lookup(chargeReference: string, token: string): Promise<GatewayStatus> {
    try {
      const response = await gatewayFetch(
        `${this.base}/v2/checkout/orders/${encodeURIComponent(chargeReference)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const status = readString(response, 'status');
      return {
        paid: status === 'COMPLETED',
        failed: status === 'VOIDED',
        paymentId: chargeReference,
      };
    } catch {
      return { paid: false, failed: false, paymentId: null };
    }
  }
}
