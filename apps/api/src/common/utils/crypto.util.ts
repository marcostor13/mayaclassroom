import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Cifrado de secretos guardados en la base de datos.
 *
 * Se usa para las credenciales de las pasarelas de cobro: son las únicas
 * cadenas del sistema que no se pueden guardar como resumen —hay que
 * recuperarlas para hablar con la pasarela— pero que tampoco deben quedar
 * legibles en un volcado de la base de datos.
 *
 * AES-256-GCM y no AES-CBC porque autentica lo que descifra: un valor alterado
 * falla en lugar de devolver basura que acabaría enviándose a la pasarela.
 */

const ALGORITHM = 'aes-256-gcm';
/** Marca de formato: distingue lo cifrado de un valor antiguo en claro. */
const PREFIX = 'enc:v1:';

/**
 * La clave se deriva por resumen del secreto de configuración en lugar de
 * usarlo tal cual: el algoritmo exige exactamente 32 bytes y el secreto de
 * despliegue tiene la longitud que tenga.
 */
function keyFrom(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFrom(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

/**
 * Descifra un valor guardado.
 *
 * Un valor sin la marca de formato se devuelve tal cual: son las credenciales
 * escritas antes de que existiera el cifrado, que deben seguir funcionando
 * hasta que su dueño las vuelva a guardar.
 */
export function decryptSecret(value: string, secret: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split('.');
  if (!ivPart || !tagPart || !dataPart) return '';

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      keyFrom(secret),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Clave cambiada o dato manipulado. Devolver vacío deja la pasarela sin
    // configurar, que es un fallo visible y reparable; devolver basura la
    // dejaría fallando contra el proveedor sin explicación.
    return '';
  }
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%*?';

function pick(alphabet: string): string {
  return alphabet[randomBytes(1)[0] % alphabet.length];
}

/**
 * Contraseña temporal para una cuenta creada sin que su dueño esté delante
 * (una compra, una matrícula aprobada).
 *
 * Lleva siempre un carácter de cada clase, de modo que cumple cualquier
 * política de contraseñas por estricta que sea la de la empresa. Se omiten los
 * caracteres que se confunden al leerlos en voz alta o al copiarlos de un
 * correo (l, I, 1, O, 0).
 */
export function generateTemporaryPassword(minLength = 12): string {
  const alphabet = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < Math.max(minLength, 8)) chars.push(pick(alphabet));

  // Barajado de Fisher-Yates: sin él, las cuatro primeras posiciones tendrían
  // siempre la misma clase de carácter y el espacio real sería mucho menor.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Referencia corta y legible de un pedido: `MC-7K3F9A`. */
export function orderReference(): string {
  const alphabet = UPPER + DIGITS;
  let code = '';
  for (let i = 0; i < 6; i += 1) code += pick(alphabet);
  return `MC-${code}`;
}
