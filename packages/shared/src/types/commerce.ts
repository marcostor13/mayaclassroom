/**
 * Venta de cursos.
 *
 * El cobro ocurre siempre contra una pasarela externa y la plataforma se
 * limita a registrar el pedido y a esperar su confirmación. Nunca se guardan
 * datos de tarjeta: lo que se almacena es el identificador que devuelve la
 * pasarela, que es lo único que hace falta para conciliar después.
 */

export enum PaymentProvider {
  MercadoPago = 'mercadopago',
  PayPal = 'paypal',
  /** Transferencia o pago acordado fuera: lo confirma la empresa a mano. */
  Manual = 'manual',
  /** Cursos gratuitos: no hay cobro, pero sí pedido, para tener el histórico. */
  Free = 'free',
}

export enum OrderStatus {
  /** Creado; a la espera de que la pasarela confirme. */
  Pending = 'pending',
  Paid = 'paid',
  Failed = 'failed',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
}

export interface OrderDto {
  id: string;
  /** Referencia corta que se enseña al comprador: «MC-8F3K2A». */
  reference: string;
  courseId: string;
  courseTitle: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  currency: string;
  provider: PaymentProvider;
  status: OrderStatus;
  /** Identificador del pago en la pasarela, para conciliar. */
  providerReference?: string | null;
  /** `true` cuando la matrícula ya está hecha. */
  enrolled: boolean;
  createdAt: string;
  paidAt?: string | null;
}

/** Lo que envía la ficha de venta para iniciar una compra. */
export interface CheckoutRequest {
  courseId: string;
  provider: PaymentProvider;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

/**
 * Respuesta al iniciar la compra.
 *
 * `redirectUrl` es el camino normal: la pasarela cobra en su propia página y
 * devuelve al comprador a la de retorno. Los cursos gratuitos no lo traen
 * porque la matrícula ya está hecha cuando llega esta respuesta.
 */
export interface CheckoutSession {
  orderId: string;
  reference: string;
  provider: PaymentProvider;
  status: OrderStatus;
  redirectUrl?: string | null;
  /** Identificador del pedido en la pasarela (preferencia o `order id`). */
  providerReference?: string | null;
  /** Mensaje ya redactado para enseñar al comprador. */
  message: string;
}

/** Estado de una compra al volver de la pasarela. */
export interface CheckoutResult {
  order: OrderDto;
  /** `true` si ya puede entrar en la plataforma con su cuenta. */
  enrolled: boolean;
  message: string;
  /** Correo con el que se creó la cuenta, para prellenar el acceso. */
  email: string;
}

/* ------------------------- Configuración de cobro ------------------------- */

/**
 * Ajustes de cobro de una empresa.
 *
 * Los secretos nunca salen de la API: el DTO solo dice si están puestos
 * (`hasAccessToken`, `hasSecret`), de modo que la pantalla de configuración
 * puede enseñar «configurado» sin exponer la credencial.
 */
export interface PaymentSettingsDto {
  currency: string;
  mercadoPago: {
    enabled: boolean;
    publicKey?: string | null;
    hasAccessToken: boolean;
    sandbox: boolean;
  };
  paypal: {
    enabled: boolean;
    clientId?: string | null;
    hasSecret: boolean;
    sandbox: boolean;
  };
  manual: {
    enabled: boolean;
    instructions?: string | null;
  };
}

/** Lo que la ficha de venta necesita saber de cada forma de pago. */
export interface PublicPaymentMethod {
  provider: PaymentProvider;
  label: string;
  /** Aviso para el comprador; en el pago manual, las instrucciones. */
  hint?: string | null;
  sandbox: boolean;
}
