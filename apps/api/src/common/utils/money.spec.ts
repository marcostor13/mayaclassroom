import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  SUPPORTED_CURRENCIES,
  currencySymbol,
  formatMoney,
} from '@maya/shared';

/**
 * El formateo de importes vive en `@maya/shared` porque lo usan la API y el
 * cliente, y un precio que se escribe distinto en cada sitio es un problema de
 * confianza, no de estilo. Se prueba aquí, que es donde corren las pruebas.
 */
/**
 * `Intl` separa el símbolo del número con un espacio duro (U+00A0) para que no
 * se parta al final de la línea. Es lo correcto, pero no se puede escribir en
 * una prueba, así que se normaliza antes de comparar.
 */
const texto = (valor: string): string => valor.replace(/\u00a0/g, ' ');

describe('importes', () => {
  it('escribe los precios en soles peruanos por defecto', () => {
    expect(texto(formatMoney(14900))).toBe('S/ 149');
    expect(texto(formatMoney(24900))).toBe('S/ 249');
  });

  it('omite los decimales cuando el importe es redondo', () => {
    // «S/ 149,00» en una tienda se lee como un error de maquetación.
    expect(texto(formatMoney(14900))).not.toContain('.');
    expect(texto(formatMoney(14950))).toBe('S/ 149.50');
  });

  it('escribe el gratuito como cero y no como cadena vacía', () => {
    expect(texto(formatMoney(0))).toBe('S/ 0');
  });

  it('respeta la moneda que la empresa tenga configurada', () => {
    expect(formatMoney(4900, 'USD')).toContain('49');
    expect(formatMoney(4900, 'USD')).not.toBe(formatMoney(4900, DEFAULT_CURRENCY));
  });

  it('cae en la moneda por defecto si llega vacía', () => {
    expect(formatMoney(14900, null)).toBe(formatMoney(14900, DEFAULT_CURRENCY));
    expect(formatMoney(14900, '')).toBe(formatMoney(14900, DEFAULT_CURRENCY));
  });

  it('saca el símbolo de la propia moneda, sin tabla a mano', () => {
    expect(currencySymbol()).toBe('S/');
    // En Perú el dólar se escribe «USD», no «$»: el símbolo lo decide la
    // configuración regional y no una tabla nuestra, que es justamente lo que
    // evita tener que mantenerla.
    expect(currencySymbol('USD')).toBe('USD');
  });

  it('ofrece el sol en cabeza de las monedas admitidas', () => {
    expect(SUPPORTED_CURRENCIES[0].code).toBe(DEFAULT_CURRENCY);
  });

  it('usa la configuración regional de Perú', () => {
    // Perú separa los decimales con punto; España, con coma. Si esto cambia,
    // los precios se leerían mal en el mercado al que va dirigida.
    expect(DEFAULT_LOCALE).toBe('es-PE');
    expect(texto(formatMoney(14950))).toContain('.');
  });
});
