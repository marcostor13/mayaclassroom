import { Types } from 'mongoose';
import { toObjectId } from './mongo.util';

describe('toObjectId · identificadores mal formados', () => {
  it('convierte un identificador válido', () => {
    const id = new Types.ObjectId();
    expect(toObjectId(id.toString()).toString()).toBe(id.toString());
  });

  it('deja pasar un identificador que ya lo es, sin copiarlo', () => {
    const id = new Types.ObjectId();
    expect(toObjectId(id)).toBe(id);
  });

  it('rechaza «undefined» con un error de petición, no del servidor', () => {
    // Este era el caso real: un enlace construido con un campo vacío pedía
    // «/courses/undefined» y el driver reventaba dentro, saliendo como 500.
    expect(() => toObjectId('undefined')).toThrow('no es válido');
  });

  it('rechaza una cadena vacía y un texto cualquiera', () => {
    expect(() => toObjectId('')).toThrow('no es válido');
    expect(() => toObjectId('no-soy-un-id')).toThrow('no es válido');
  });
});
