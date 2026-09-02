import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { StorageConfig } from '../../config';

export interface StoredObject {
  key: string;
  size: number;
  checksum: string;
}

/**
 * Abstracción de almacenamiento. El controlador `local` guarda en disco (ideal
 * para desarrollo y despliegues con volumen persistente); `s3` delega en un
 * bucket compatible con S3 mediante la API REST firmada por el SDK cuando está
 * disponible en el entorno.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(private readonly config: ConfigService) {}

  private get storage(): StorageConfig {
    return this.config.getOrThrow<StorageConfig>('storage');
  }

  /** Ruta absoluta segura dentro del directorio de almacenamiento. */
  private localPath(key: string): string {
    const base = resolve(this.storage.localPath);
    const target = resolve(join(base, key));
    if (!target.startsWith(base)) {
      throw new InternalServerErrorException('Ruta de fichero no permitida.');
    }
    return target;
  }

  buildKey(prefix: string, filename: string): string {
    const ext = extname(filename).toLowerCase().slice(0, 12);
    const date = new Date();
    return `${prefix}/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}${ext}`;
  }

  /** ¿El almacenamiento vive fuera de este servidor? */
  get isRemote(): boolean {
    return this.storage.driver !== 'local';
  }

  /**
   * El `contentType` no es opcional por comodidad: sin él, R2 y S3 sirven todo
   * como `application/octet-stream`, y un navegador que pide una imagen recibe
   * una descarga en lugar de pintarla. Era el motivo por el que los logos
   * subidos no se veían.
   */
  async put(key: string, data: Buffer, contentType?: string): Promise<StoredObject> {
    const checksum = createHash('sha256').update(data).digest('hex');

    if (this.storage.driver === 'local') {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
      return { key, size: data.length, checksum };
    }

    await this.putS3(key, data, contentType);
    return { key, size: data.length, checksum };
  }

  async get(key: string): Promise<Buffer> {
    if (this.storage.driver === 'local') {
      const path = this.localPath(key);
      if (!existsSync(path)) throw new InternalServerErrorException('El fichero no existe.');
      return readFile(path);
    }
    return this.getS3(key);
  }

  async remove(key: string): Promise<void> {
    try {
      if (this.storage.driver === 'local') {
        const path = this.localPath(key);
        if (existsSync(path)) await unlink(path);
        return;
      }
      await this.removeS3(key);
    } catch (error) {
      this.logger.warn(`No se pudo eliminar el fichero ${key}: ${String(error)}`);
    }
  }

  publicUrl(key: string): string {
    return `${this.storage.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  }

  /* --------------------------------- S3 ---------------------------------- */

  /** Cliente y comandos, creados una sola vez: abrirlo por operación reabre
   *  el grupo de conexiones en cada subida. */
  private cached: {
    send: (command: unknown) => Promise<unknown>;
    commands: Record<string, new (input: unknown) => unknown>;
  } | null = null;

  private async s3Client(): Promise<{
    send: (command: unknown) => Promise<unknown>;
    commands: Record<string, new (input: unknown) => unknown>;
  }> {
    if (this.cached) return this.cached;

    // Carga perezosa: el SDK solo se requiere si el almacenamiento es remoto,
    // así un despliegue en disco no arrastra la dependencia.
    const specifier = '@aws-sdk/client-s3';
    const sdk = (await import(specifier).catch(() => null)) as null | Record<string, unknown>;
    if (!sdk) {
      throw new InternalServerErrorException(
        'El almacenamiento remoto requiere la dependencia @aws-sdk/client-s3.',
      );
    }

    const { bucket, accessKeyId, secretAccessKey, endpoint } = this.storage.s3;
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'Falta configurar el bucket o las credenciales del almacenamiento remoto.',
      );
    }

    const S3Client = sdk.S3Client as new (config: unknown) => {
      send: (command: unknown) => Promise<unknown>;
    };
    const client = new S3Client({
      region: this.storage.s3.region,
      endpoint,
      forcePathStyle: this.storage.s3.forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
      // R2 rechaza la petición si el SDK añade sus checksums de integridad,
      // que desde la versión 3.729 van por defecto en cada subida. Pedirlos
      // solo cuando la operación los exija es lo que Cloudflare documenta, y
      // en S3 no cambia nada.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.cached = {
      send: (command) => client.send(command),
      commands: {
        Put: sdk.PutObjectCommand as new (input: unknown) => unknown,
        Get: sdk.GetObjectCommand as new (input: unknown) => unknown,
        Delete: sdk.DeleteObjectCommand as new (input: unknown) => unknown,
      },
    };
    this.logger.log(`Almacenamiento remoto listo: ${this.storage.driver} · ${bucket}`);
    return this.cached;
  }

  private async putS3(key: string, data: Buffer, contentType?: string): Promise<void> {
    const { send, commands } = await this.s3Client();
    await send(
      new commands.Put({
        Bucket: this.storage.s3.bucket,
        Key: key,
        Body: data,
        ContentType: contentType || 'application/octet-stream',
        // Las claves llevan un UUID, así que el contenido de una nunca cambia:
        // se puede cachear para siempre sin miedo a servir algo obsoleto.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  private async getS3(key: string): Promise<Buffer> {
    const { send, commands } = await this.s3Client();
    const result = (await send(
      new commands.Get({ Bucket: this.storage.s3.bucket, Key: key }),
    )) as { Body?: { transformToByteArray: () => Promise<Uint8Array> } };
    if (!result.Body) throw new InternalServerErrorException('El fichero no existe.');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  private async removeS3(key: string): Promise<void> {
    const { send, commands } = await this.s3Client();
    await send(new commands.Delete({ Bucket: this.storage.s3.bucket, Key: key }));
  }
}
