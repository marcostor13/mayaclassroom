import { decryptSecret, encryptSecret, generateTemporaryPassword, orderReference } from './crypto.util';

const CLAVE = 'un-secreto-de-despliegue-suficientemente-largo';

describe('cifrado de secretos', () => {
  it('devuelve el valor original al descifrar con la misma clave', () => {
    const cifrado = encryptSecret('APP_USR-1234567890', CLAVE);
    expect(cifrado).not.toContain('APP_USR');
    expect(decryptSecret(cifrado, CLAVE)).toBe('APP_USR-1234567890');
  });

  it('cifra el mismo valor de forma distinta cada vez', () => {
    // El vector de inicialización es aleatorio: dos cifrados iguales delatarían
    // que dos empresas usan la misma credencial.
    expect(encryptSecret('igual', CLAVE)).not.toBe(encryptSecret('igual', CLAVE));
  });

  it('deja pasar los valores antiguos sin cifrar', () => {
    expect(decryptSecret('token-en-claro', CLAVE)).toBe('token-en-claro');
  });

  it('devuelve vacío si la clave no es la que cifró', () => {
    const cifrado = encryptSecret('APP_USR-1234567890', CLAVE);
    expect(decryptSecret(cifrado, 'otra-clave-distinta-y-larga')).toBe('');
  });

  it('devuelve vacío si el dato ha sido manipulado', () => {
    const cifrado = encryptSecret('APP_USR-1234567890', CLAVE);
    expect(decryptSecret(`${cifrado}xx`, CLAVE)).toBe('');
  });
});

describe('contraseña temporal', () => {
  it('cumple cualquier política: minúscula, mayúscula, dígito y símbolo', () => {
    for (let i = 0; i < 30; i += 1) {
      const password = generateTemporaryPassword();
      expect(password.length).toBeGreaterThanOrEqual(12);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%*?]/);
    }
  });

  it('respeta la longitud mínima pedida', () => {
    expect(generateTemporaryPassword(20).length).toBe(20);
  });
});

describe('referencia de pedido', () => {
  it('tiene la forma MC-XXXXXX y no repite entre pedidos', () => {
    const referencias = new Set(Array.from({ length: 200 }, () => orderReference()));
    for (const referencia of referencias) expect(referencia).toMatch(/^MC-[A-Z0-9]{6}$/);
    // Con 6 caracteres de 32 símbolos, 200 referencias no deberían chocar.
    expect(referencias.size).toBe(200);
  });
});
