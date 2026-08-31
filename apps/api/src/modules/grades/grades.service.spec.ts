import { GradeAggregation } from '@maya/shared';
import { GradesService } from './grades.service';

type AggregateInput = { value: number; max: number; weight: number }[];

interface AggregationOptions {
  aggregation: GradeAggregation;
  dropLowest: number;
  keepHighest: number;
}

/**
 * Las estrategias de agregación son lógica pura: se prueban invocando el método
 * privado a través de la instancia, sin necesidad de base de datos.
 */
describe('GradesService · estrategias de agregación', () => {
  const service = Object.create(GradesService.prototype) as GradesService;

  const category = (overrides: Partial<AggregationOptions> = {}): AggregationOptions => ({
    aggregation: GradeAggregation.Mean,
    dropLowest: 0,
    keepHighest: 0,
    ...overrides,
  });

  const values: AggregateInput = [
    { value: 8, max: 10, weight: 1 }, // 0,8
    { value: 6, max: 10, weight: 1 }, // 0,6
    { value: 10, max: 10, weight: 2 }, // 1,0
  ];

  it('media simple de las proporciones', () => {
    const result = service.aggregate(values, category());
    expect(result).toBeCloseTo((0.8 + 0.6 + 1) / 3, 5);
  });

  it('media ponderada por el peso de cada ítem', () => {
    const result = service.aggregate(
      values,
      category({ aggregation: GradeAggregation.WeightedMean }),
    );
    expect(result).toBeCloseTo((0.8 * 1 + 0.6 * 1 + 1 * 2) / 4, 5);
  });

  it('natural: suma de puntos sobre suma de máximos', () => {
    const result = service.aggregate(values, category({ aggregation: GradeAggregation.Natural }));
    expect(result).toBeCloseTo(24 / 30, 5);
  });

  it('mediana de las proporciones', () => {
    const result = service.aggregate(values, category({ aggregation: GradeAggregation.Median }));
    expect(result).toBeCloseTo(0.8, 5);
  });

  it('mínimo y máximo', () => {
    expect(service.aggregate(values, category({ aggregation: GradeAggregation.Min }))).toBeCloseTo(0.6, 5);
    expect(service.aggregate(values, category({ aggregation: GradeAggregation.Max }))).toBeCloseTo(1, 5);
  });

  it('descarta la nota más baja cuando dropLowest está activo', () => {
    const result = service.aggregate(values, category({ dropLowest: 1 }));
    expect(result).toBeCloseTo((0.8 + 1) / 2, 5);
  });

  it('conserva solo las mejores notas con keepHighest', () => {
    const result = service.aggregate(values, category({ keepHighest: 1 }));
    expect(result).toBeCloseTo(1, 5);
  });

  it('devuelve null cuando no hay calificaciones', () => {
    expect(service.aggregate([], category())).toBeNull();
  });
});
