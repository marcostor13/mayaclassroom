import { AvailabilityOperator, CompletionState } from '@maya/shared';
import { AvailabilityService } from './availability.service';

const MODULE = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function build(overrides: Partial<Record<string, unknown>> = {}): AvailabilityService {
  return new AvailabilityService(
    {
      stateFor: async () => CompletionState.Complete,
      ...(overrides['completion'] as object),
    } as never,
    {
      groupsOfUser: async () => [],
      membersOfGrouping: async () => [],
      ...(overrides['groups'] as object),
    } as never,
    {
      userGradeForItem: async () => ({ finalGrade: 7 }),
      ...(overrides['grades'] as object),
    } as never,
    {
      findById: async () => ({ country: 'ES', customFields: {} }),
      ...(overrides['users'] as object),
    } as never,
  );
}

describe('AvailabilityService · árbol de restricción de acceso', () => {
  const context = { userId: 'u1', courseId: 'c1' };

  it('concede el acceso cuando no hay restricciones', async () => {
    const result = await build().evaluate(null, context);
    expect(result.available).toBe(true);
    expect(result.visible).toBe(true);
  });

  it('respeta una condición de fecha ya cumplida', async () => {
    const tree = {
      op: AvailabilityOperator.And,
      c: [{ type: 'date', d: '>=', t: new Date(Date.now() - 86_400_000).toISOString() }],
    };
    const result = await build().evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(true);
  });

  it('bloquea una condición de fecha futura y explica el motivo', async () => {
    const tree = {
      op: AvailabilityOperator.And,
      c: [{ type: 'date', d: '>=', t: new Date(Date.now() + 86_400_000).toISOString() }],
    };
    const result = await build().evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(false);
    expect(result.info).toMatch(/Disponible a partir del/);
  });

  it('el operador OR basta con que se cumpla una condición', async () => {
    const tree = {
      op: AvailabilityOperator.Or,
      c: [
        { type: 'date', d: '>=', t: new Date(Date.now() + 86_400_000).toISOString() },
        { type: 'completion', cm: MODULE, e: CompletionState.Complete },
      ],
    };
    const result = await build().evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(true);
  });

  it('el operador AND exige todas las condiciones', async () => {
    const tree = {
      op: AvailabilityOperator.And,
      c: [
        { type: 'date', d: '>=', t: new Date(Date.now() + 86_400_000).toISOString() },
        { type: 'completion', cm: MODULE, e: CompletionState.Complete },
      ],
    };
    const result = await build().evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(false);
  });

  it('la condición de calificación compara con el mínimo exigido', async () => {
    const strict = build({ grades: { userGradeForItem: async () => ({ finalGrade: 3 }) } });
    const tree = {
      op: AvailabilityOperator.And,
      c: [{ type: 'grade', id: 'item1', min: 5 }],
    };
    const result = await strict.evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(false);
  });

  it('quien puede ignorar restricciones siempre tiene acceso', async () => {
    const tree = {
      op: AvailabilityOperator.And,
      c: [{ type: 'date', d: '>=', t: new Date(Date.now() + 86_400_000).toISOString() }],
    };
    const result = await build().evaluate(JSON.stringify(tree), {
      ...context,
      ignoreRestrictions: true,
    });
    expect(result.available).toBe(true);
  });

  it('un árbol mal formado no bloquea la actividad', async () => {
    const result = await build().evaluate('{esto no es json', context);
    expect(result.available).toBe(true);
  });

  it('oculta la actividad cuando show es false', async () => {
    const tree = {
      op: AvailabilityOperator.And,
      show: false,
      c: [{ type: 'date', d: '>=', t: new Date(Date.now() + 86_400_000).toISOString() }],
    };
    const result = await build().evaluate(JSON.stringify(tree), context);
    expect(result.available).toBe(false);
    expect(result.visible).toBe(false);
  });
});
