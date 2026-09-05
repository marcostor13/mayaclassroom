import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';
import { StoredFile } from './schemas/stored-file.schema';
import { TenantsService } from '../tenants/tenants.service';

const TENANT = new Types.ObjectId();
const OWNER = new Types.ObjectId();
const GB = 1024 * 1024 * 1024;

function fichero(bytes: number) {
  return {
    originalname: 'clase.mp4',
    mimetype: 'video/mp4',
    buffer: Buffer.alloc(0),
    size: bytes,
  };
}

/**
 * Monta el servicio con una empresa que tiene `max` de tope y `used` gastado.
 * El almacenamiento registra si llegó a escribirse algo: lo importante de esta
 * comprobación no es solo que falle, sino que falle **antes** de subir nada.
 */
async function build(used: number, max: number) {
  const puestos: string[] = [];
  const storage = {
    buildKey: () => 'user/draft/2026/09/x.mp4',
    put: jest.fn(async (key: string) => {
      puestos.push(key);
      return { key, size: 1, checksum: 'x' };
    }),
    isRemote: true,
    publicUrl: (key: string) => `https://cdn/${key}`,
  };
  const model = { create: jest.fn(async (doc: unknown) => doc) };
  const tenants = {
    storageAllowance: jest.fn(async (_id: unknown, extra = 0) => ({
      used,
      max,
      free: Math.max(0, max - used),
      fits: used + extra <= max,
    })),
    adjustStorage: jest.fn(async () => undefined),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      FilesService,
      { provide: getModelToken(StoredFile.name), useValue: model },
      { provide: StorageService, useValue: storage },
      { provide: TenantsService, useValue: tenants },
      // Sin tope por fichero: aquí se prueba el tope de la empresa, y un
      // límite por fichero saltaría antes y taparía lo que se quiere ver.
      {
        provide: ConfigService,
        useValue: { getOrThrow: () => ({ maxFileSize: Number.MAX_SAFE_INTEGER }) },
      },
    ],
  }).compile();

  return { service: moduleRef.get(FilesService) as FilesService, storage, puestos, tenants };
}

const subida = (size: number) => ({
  tenantId: TENANT,
  ownerId: OWNER,
  component: 'user',
  fileArea: 'draft',
  file: fichero(size),
});

describe('FilesService · tope de almacenamiento de la empresa', () => {
  it('rechaza la subida que no cabe en el plan', async () => {
    const { service } = await build(299 * GB, 300 * GB);

    await expect(service.upload(subida(2 * GB))).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('no escribe nada en el almacenamiento cuando no cabe', async () => {
    // Si se comprobara después de subir, el objeto quedaría en el bucket
    // cobrándose sin que ningún documento lo referencie.
    const { service, storage, puestos } = await build(300 * GB, 300 * GB);

    await expect(service.upload(subida(1))).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled();
    expect(puestos).toHaveLength(0);
  });

  it('dice cuánto queda y de cuánto, para poder actuar', async () => {
    const { service } = await build(290 * GB, 300 * GB);

    await expect(service.upload(subida(20 * GB))).rejects.toThrow(/quedan 10\.0 GB de 300\.0 GB/);
  });

  it('deja pasar lo que sí cabe y lo suma al consumo de la empresa', async () => {
    const { service, storage, tenants } = await build(10 * GB, 300 * GB);

    await service.upload(subida(1024));

    expect(storage.put).toHaveBeenCalled();
    expect(tenants.adjustStorage).toHaveBeenCalled();
  });
});
