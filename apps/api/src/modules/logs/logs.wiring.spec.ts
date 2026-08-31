import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LogAction } from '@maya/shared';
import { Log } from './schemas/log.schema';
import { LogsService } from './logs.service';
import { LogsController } from './logs.controller';

const model = {
  create: jest.fn(async (doc: unknown) => doc),
  find: jest.fn(() => ({
    sort: () => ({ skip: () => ({ limit: () => ({ exec: async () => [] }) }) }),
  })),
  countDocuments: jest.fn(() => ({ exec: async () => 0 })),
  distinct: jest.fn(() => ({ exec: async () => [1, 2, 3] })),
  aggregate: jest.fn(async () => []),
};

describe('LogsModule · cableado', () => {
  it('resuelve el servicio y el controlador', async () => {
    const ref = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [LogsService, { provide: getModelToken(Log.name), useValue: model }],
    }).compile();

    const service = ref.get(LogsService);
    expect(ref.get(LogsController)).toBeDefined();

    await service.record({
      tenantId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
      component: 'core',
      target: 'course',
      action: LogAction.Viewed,
    });
    expect(model.create).toHaveBeenCalled();

    // Las llamadas internas pasan objetos planos, sin los captadores del DTO.
    const page = await service.paginate('507f1f77bcf86cd799439011', {
      page: 1,
      limit: 500,
      order: 'desc',
    } as never);
    expect(page.total).toBe(0);
    expect(await service.countActiveUsers('507f1f77bcf86cd799439013', 7)).toBe(3);
    expect((await service.activityByDay('507f1f77bcf86cd799439013', 30)).length).toBe(30);
  });
});
