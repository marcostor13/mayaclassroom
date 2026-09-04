import { mergeSegments } from './media-progress.service';

/**
 * La fusión de tramos es lo que distingue «ha visto el vídeo» de «ha arrastrado
 * la barra hasta el final», así que se comprueba aparte del servicio.
 */
describe('mergeSegments · tiempo distinto reproducido', () => {
  it('une los tramos solapados en uno solo', () => {
    expect(
      mergeSegments([
        { from: 0, to: 30 },
        { from: 20, to: 45 },
      ]),
    ).toEqual([{ from: 0, to: 45 }]);
  });

  it('mantiene separados los tramos con un hueco real', () => {
    // Ver el principio y luego saltar al final deja sin ver lo del medio, y el
    // porcentaje debe reflejarlo.
    expect(
      mergeSegments([
        { from: 0, to: 10 },
        { from: 100, to: 120 },
      ]),
    ).toEqual([
      { from: 0, to: 10 },
      { from: 100, to: 120 },
    ]);
  });

  it('cierra los huecos de menos de un segundo entre latidos', () => {
    // Una pausa deja décimas de hueco; sin esto, la lista crecería sin fin.
    expect(
      mergeSegments([
        { from: 0, to: 15 },
        { from: 15.4, to: 30 },
      ]),
    ).toEqual([{ from: 0, to: 30 }]);
  });

  it('vuelve a ver lo mismo sin sumarlo dos veces', () => {
    const merged = mergeSegments([
      { from: 0, to: 60 },
      { from: 0, to: 60 },
    ]);
    const total = merged.reduce((sum, s) => sum + (s.to - s.from), 0);
    expect(total).toBe(60);
  });

  it('descarta los tramos vacíos y ordena lo que llega desordenado', () => {
    expect(
      mergeSegments([
        { from: 50, to: 60 },
        { from: 10, to: 10 },
        { from: 0, to: 5 },
      ]),
    ).toEqual([
      { from: 0, to: 5 },
      { from: 50, to: 60 },
    ]);
  });

  it('normaliza un tramo con los extremos invertidos', () => {
    expect(mergeSegments([{ from: 30, to: 10 }])).toEqual([{ from: 10, to: 30 }]);
  });
});
