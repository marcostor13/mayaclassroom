import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ContextLevel } from '@maya/shared';
import { ContextsService } from './contexts.service';
import { Context } from './schemas/context.schema';

const SISTEMA = new Types.ObjectId();
const CATEGORIA = new Types.ObjectId();
const CURSO = new Types.ObjectId();
const INSTANCIA = new Types.ObjectId();

/**
 * Contexto de curso ya existente, colgando de su categoría, como queda tras
 * crearlo bien.
 */
function contextoCurso() {
  return {
    _id: CURSO,
    level: ContextLevel.Course,
    instanceId: INSTANCIA,
    parent: CATEGORIA,
    depth: 3,
    path: `/${SISTEMA}/${CATEGORIA}/${CURSO}/`,
    label: 'Curso viejo',
    save: jest.fn(async () => undefined),
  };
}

async function build(existente: ReturnType<typeof contextoCurso> | null) {
  const model = {
    findOne: jest.fn(() => ({ exec: async () => existente })),
    findById: jest.fn(() => ({ exec: async () => null })),
    find: jest.fn(() => ({ exec: async () => [] })),
    updateMany: jest.fn(() => ({ exec: async () => undefined })),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [ContextsService, { provide: getModelToken(Context.name), useValue: model }],
  }).compile();
  return { service: moduleRef.get(ContextsService), model };
}

describe('ContextsService · no reubicar por accidente', () => {
  it('refresca la etiqueta sin mover el contexto cuando no se indica padre', async () => {
    const existente = contextoCurso();
    const { service } = await build(existente);
    const mover = jest.fn(async () => undefined);
    Reflect.set(service, 'moveSubtree', mover);

    const result = await service.ensureContext({
      level: ContextLevel.Course,
      instanceId: INSTANCIA,
      label: 'Curso renombrado',
    });

    // Este era el fallo: al guardar un curso se llamaba aquí solo para
    // actualizar el nombre y el subárbol entero acababa colgando del sistema,
    // fuera del alcance de los roles de su empresa.
    expect(mover).not.toHaveBeenCalled();
    expect(result.path).toBe(`/${SISTEMA}/${CATEGORIA}/${CURSO}/`);
    expect(existente.label).toBe('Curso renombrado');
    expect(existente.save).toHaveBeenCalled();
  });

  it('sí reubica cuando se pide un padre distinto', async () => {
    const existente = contextoCurso();
    const nuevoPadre = new Types.ObjectId();
    const { service, model } = await build(existente);
    const mover = jest.fn(async () => undefined);
    Reflect.set(service, 'moveSubtree', mover);
    model.findById = jest.fn(() => ({
      exec: async () => ({ _id: nuevoPadre, depth: 2, path: `/${SISTEMA}/${nuevoPadre}/` }),
    }));

    await service.ensureContext({
      level: ContextLevel.Course,
      instanceId: INSTANCIA,
      parentId: nuevoPadre,
    });

    expect(mover).toHaveBeenCalledTimes(1);
  });
});
