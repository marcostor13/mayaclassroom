/* -------------------------------------------------------------------------- */
/*  Localización de la plataforma — Perú                                       */
/*                                                                            */
/*  Maya Classroom se opera desde Perú: los precios se ponen en soles, las     */
/*  fechas y los importes se escriben como se escriben allí y la hora por      */
/*  defecto es la de Lima. Todo lo que dependa de esa decisión sale de aquí,   */
/*  para que cambiar de mercado sea tocar un fichero y no rastrear literales.  */
/* -------------------------------------------------------------------------- */

/** Configuración regional con la que se formatean importes y fechas. */
export const DEFAULT_LOCALE = 'es-PE';

/** Moneda por defecto de cursos, pedidos y cobros: el sol peruano. */
export const DEFAULT_CURRENCY = 'PEN';

/** Zona horaria por defecto de empresas y usuarios. */
export const DEFAULT_TIMEZONE = 'America/Lima';

/**
 * Monedas que se ofrecen al configurar los cobros.
 *
 * Son las de los mercados donde operan Mercado Pago y PayPal, con el sol en
 * cabeza por ser la de casa.
 */
export const SUPPORTED_CURRENCIES = [
  { code: 'PEN', label: 'Sol peruano (S/)' },
  { code: 'USD', label: 'Dólar estadounidense ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'MXN', label: 'Peso mexicano' },
  { code: 'ARS', label: 'Peso argentino' },
  { code: 'COP', label: 'Peso colombiano' },
  { code: 'CLP', label: 'Peso chileno' },
  { code: 'BRL', label: 'Real brasileño' },
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]['code'];

/**
 * Escribe un importe en céntimos como precio.
 *
 * Los precios se guardan siempre en la unidad menor (céntimos de sol) para no
 * arrastrar errores de coma flotante; esta es la única función que los pasa a
 * texto, de modo que un curso, un pedido y un recibo se leen igual.
 *
 * Los importes redondos se escriben sin decimales —«S/ 149» y no
 * «S/ 149,00»—, que es como los pone cualquier tienda.
 */
export function formatMoney(
  amountCents: number,
  currency: string | null | undefined = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || DEFAULT_CURRENCY,
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}

/**
 * Símbolo de la moneda, para etiquetas de formulario del tipo «Precio (S/)».
 *
 * Se saca del propio formateador en lugar de una tabla a mano: así una moneda
 * nueva no exige tocar nada.
 */
export function currencySymbol(
  currency: string | null | undefined = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  const partes = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || DEFAULT_CURRENCY,
  }).formatToParts(0);
  return partes.find((parte) => parte.type === 'currency')?.value ?? (currency || '');
}
