import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { CAP, GUIDES, GuideId } from '@maya/shared';
import { GuidesService } from './guides.service';
import { GuideProgress } from './schemas/guide-progress.schema';

const TENANT = new Types.ObjectId();
const USER = new Types.ObjectId();

function progressDouble(base: Partial<Record<string, unknown>> = {}) {
  return {
    guideId: GuideId.PublishStorefront,
    completedStepIds: [] as string[],
    currentStep: 0,
    dismissed: false,
    completedAt: null as Date | null,
    get: () => new Date(),
    save: jest.fn(async () => undefined),
    ...base,
  };
}

async function build(existente: ReturnType<typeof progressDouble> | null) {
  const fila = existente;
  const model = {
    find: jest.fn(() => ({ exec: async () => (fila ? [fila] : []) })),
    findOne: jest.fn(() => ({ exec: async () => fila })),
    create: jest.fn(async (doc: Record<string, unknown>) => progressDouble(doc)),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [GuidesService, { provide: getModelToken(GuideProgress.name), useValue: model }],
  }).compile();

  return { service: moduleRef.get(GuidesService), model };
}

describe('GuidesService · qué guías se ofrecen', () => {
  it('solo ofrece las guías cuya capacidad tiene el usuario', async () => {
    const { service } = await build(null);

    const disponibles = service.available([CAP.SITE_MANAGE]);

    expect(disponibles.map((guide) => guide.id)).toEqual([GuideId.PublishStorefront]);
  });

  it('no ofrece ninguna a quien no administra nada', async () => {
    const { service } = await build(null);
    expect(service.available([CAP.COURSE_VIEW])).toEqual([]);
  });
});

describe('GuidesService · progreso', () => {
  it('rechaza un paso que no pertenece a la guía', async () => {
    const { service } = await build(progressDouble());

    await expect(
      service.update(TENANT, USER, GuideId.PublishStorefront, { completedStepId: 'inventado' }),
    ).rejects.toThrow(/no pertenece/i);
  });

  it('rechaza una guía que no existe', async () => {
    const { service } = await build(null);

    await expect(service.update(TENANT, USER, 'guia-fantasma', {})).rejects.toThrow(/no existe/i);
  });

  it('no apunta dos veces el mismo paso', async () => {
    const guia = GUIDES.find((g) => g.id === GuideId.PublishStorefront)!;
    const fila = progressDouble({ completedStepIds: [guia.steps[0].id] });
    const { service } = await build(fila);

    const resultado = await service.update(TENANT, USER, GuideId.PublishStorefront, {
      completedStepId: guia.steps[0].id,
    });

    expect(resultado.completedStepIds).toEqual([guia.steps[0].id]);
  });

  it('acota el paso actual al número de pasos de la guía', async () => {
    const guia = GUIDES.find((g) => g.id === GuideId.PublishStorefront)!;
    const { service } = await build(progressDouble());

    const resultado = await service.update(TENANT, USER, GuideId.PublishStorefront, {
      currentStep: 999,
    });

    expect(resultado.currentStep).toBe(guia.steps.length);
  });

  it('da la guía por terminada solo cuando están todos los pasos', async () => {
    const guia = GUIDES.find((g) => g.id === GuideId.PublishStorefront)!;
    const fila = progressDouble({
      completedStepIds: guia.steps.slice(0, -1).map((step) => step.id),
    });
    const { service } = await build(fila);

    const aMedias = await service.update(TENANT, USER, GuideId.PublishStorefront, {});
    expect(aMedias.completedAt).toBeNull();

    const completa = await service.update(TENANT, USER, GuideId.PublishStorefront, {
      completedStepId: guia.steps[guia.steps.length - 1].id,
    });
    expect(completa.completedAt).not.toBeNull();
  });

  it('reiniciar borra el progreso y vuelve a ofrecerla', async () => {
    const guia = GUIDES.find((g) => g.id === GuideId.PublishStorefront)!;
    const fila = progressDouble({
      completedStepIds: guia.steps.map((step) => step.id),
      dismissed: true,
      currentStep: 4,
    });
    const { service } = await build(fila);

    const resultado = await service.update(TENANT, USER, GuideId.PublishStorefront, {
      restart: true,
    });

    expect(resultado.completedStepIds).toEqual([]);
    expect(resultado.currentStep).toBe(0);
    expect(resultado.dismissed).toBe(false);
    expect(resultado.completedAt).toBeNull();
  });
});
