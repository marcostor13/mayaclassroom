import { sealPayload, verifySeal } from './crypto.util';

const SECRETO = 'secreto-de-pruebas';

describe('sealPayload · sellos de autenticidad', () => {
  it('el mismo contenido da siempre el mismo sello', () => {
    const partes = ['MAYA-ABC123', 7, 'Ana Quispe', 'Introducción a la IA', 18, '2026-09-04'];
    expect(sealPayload(partes, SECRETO)).toBe(sealPayload(partes, SECRETO));
  });

  it('cambiar cualquier dato invalida el sello', () => {
    const sello = sealPayload(['MAYA-ABC123', 7, 'Ana Quispe'], SECRETO);
    // Es justo lo que se quiere detectar: alguien que edita el nombre en la
    // base de datos y espera que el certificado siga comprobando.
    expect(verifySeal(['MAYA-ABC123', 7, 'Ana Quispe'], SECRETO, sello)).toBe(true);
    expect(verifySeal(['MAYA-ABC123', 7, 'Ana Quispé'], SECRETO, sello)).toBe(false);
    expect(verifySeal(['MAYA-ABC124', 7, 'Ana Quispe'], SECRETO, sello)).toBe(false);
  });

  it('sin el secreto no se puede fabricar un sello válido', () => {
    const sello = sealPayload(['MAYA-ABC123'], SECRETO);
    expect(verifySeal(['MAYA-ABC123'], 'otro-secreto', sello)).toBe(false);
  });

  it('el separador impide que dos contenidos distintos den el mismo sello', () => {
    // Sin separador, «ab» + «c» y «a» + «bc» se concatenarían igual y un
    // certificado podría hacerse pasar por otro.
    expect(sealPayload(['ab', 'c'], SECRETO)).not.toBe(sealPayload(['a', 'bc'], SECRETO));
  });

  it('un sello vacío o de otra longitud no valida', () => {
    const sello = sealPayload(['MAYA-ABC123'], SECRETO);
    expect(verifySeal(['MAYA-ABC123'], SECRETO, '')).toBe(false);
    expect(verifySeal(['MAYA-ABC123'], SECRETO, sello.slice(0, -1))).toBe(false);
  });

  it('trata igual el nulo y el indefinido, que es como llegan de la base', () => {
    expect(sealPayload(['a', null], SECRETO)).toBe(sealPayload(['a', undefined], SECRETO));
  });
});
