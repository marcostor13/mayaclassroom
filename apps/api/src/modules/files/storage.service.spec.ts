import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import type { StorageConfig } from '../../config';

function build(overrides: Partial<StorageConfig> = {}) {
  const storage: StorageConfig = {
    driver: 'r2',
    localPath: './storage',
    publicBaseUrl: 'https://cdn.ejemplo.com',
    maxFileSize: 50 * 1024 * 1024,
    s3: {
      bucket: 'maya',
      region: 'auto',
      accessKeyId: 'clave',
      secretAccessKey: 'secreto',
      endpoint: 'https://cuenta.r2.cloudflarestorage.com',
      forcePathStyle: true,
    },
    ...overrides,
  };
  const config = { getOrThrow: () => storage };
  return Test.createTestingModule({
    providers: [StorageService, { provide: ConfigService, useValue: config }],
  })
    .compile()
    .then((ref) => ref.get(StorageService));
}

describe('StorageService · claves y direcciones públicas', () => {
  it('reconoce el almacenamiento remoto', async () => {
    const remoto = await build();
    const local = await build({ driver: 'local' });

    expect(remoto.isRemote).toBe(true);
    expect(local.isRemote).toBe(false);
  });

  it('compone la dirección pública sin duplicar la barra', async () => {
    const service = await build({ publicBaseUrl: 'https://cdn.ejemplo.com/' });

    expect(service.publicUrl('image/branding/2026/09/abc.png')).toBe(
      'https://cdn.ejemplo.com/image/branding/2026/09/abc.png',
    );
  });

  it('reparte las claves por año y mes, con nombre irrepetible', async () => {
    const service = await build();

    const a = service.buildKey('image/branding', 'Logo empresa.PNG');
    const b = service.buildKey('image/branding', 'Logo empresa.PNG');

    // La extensión se conserva en minúsculas —R2 la usa para el tipo— y el
    // resto es un identificador único: dos subidas del mismo fichero no se
    // pisan, que es lo que permite cachear para siempre.
    expect(a).toMatch(/^image\/branding\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(a).not.toBe(b);
  });

  it('no deja escapar la ruta del directorio de almacenamiento', async () => {
    const service = await build({ driver: 'local' });

    // `get` resuelve la ruta antes de leer: una clave con «..» debe rebotar
    // en lugar de alcanzar ficheros de fuera.
    await expect(service.get('../../etc/passwd')).rejects.toThrow('no permitida');
  });
});
