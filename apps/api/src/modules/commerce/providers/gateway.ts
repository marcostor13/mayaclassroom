/**
 * Contrato común de una pasarela de cobro.
 *
 * Las dos pasarelas admitidas funcionan igual desde fuera: se crea un cobro,
 * se manda al comprador a pagar y después se pregunta si el pago cuajó. Lo que
 * cambia —cómo se autentica cada una, cómo llama a sus recursos— queda dentro
 * de cada implementación, de modo que añadir una tercera no toca el servicio
 * de pedidos.
 */
export interface GatewayCharge {
  /** Identificador del cobro en la pasarela. */
  reference: string;
  /** Dirección a la que se envía al comprador para pagar. */
  redirectUrl: string;
}

export interface GatewayChargeRequest {
  title: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  /** Referencia del pedido; vuelve en el aviso de la pasarela. */
  orderReference: string;
  buyer: { firstName: string; lastName: string; email: string };
  returnUrl: string;
  cancelUrl: string;
  notificationUrl: string;
  brandName: string;
}

/** Lo que se sabe de un cobro al preguntar por él. */
export interface GatewayStatus {
  paid: boolean;
  /** `true` cuando la pasarela dice que el cobro se descartó para siempre. */
  failed: boolean;
  paymentId?: string | null;
}

export interface PaymentGateway {
  createCharge(request: GatewayChargeRequest): Promise<GatewayCharge>;
  /** Confirma el cobro. En PayPal captura; en Mercado Pago solo consulta. */
  confirm(chargeReference: string): Promise<GatewayStatus>;
}

/**
 * Peticiones a la pasarela.
 *
 * El tiempo máximo es corto a propósito: esto ocurre mientras el comprador
 * espera en la página, y una pasarela lenta debe dar un error claro en vez de
 * dejar la pantalla colgada hasta que el navegador se rinda.
 */
export async function gatewayFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<unknown> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...rest, signal: controller.signal });
    const text = await response.text();
    const body: unknown = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`La pasarela respondió ${response.status}: ${text.slice(0, 300)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/** Lectura defensiva: la respuesta de la pasarela es JSON ajeno, no un tipo. */
export function readString(source: unknown, ...path: string[]): string | null {
  let current: unknown = source;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : typeof current === 'number' ? String(current) : null;
}
