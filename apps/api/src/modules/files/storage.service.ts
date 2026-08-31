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

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const checksum = createHash('sha256').update(data).digest('hex');

    if (this.storage.driver === 'local') {
      const path = this.localPath(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, data);
      return { key, size: data.length, checksum };
    }

    await this.putS3(key, data);
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

  private async s3Client(): Promise<{
    send: (command: unknown) => Promise<unknown>;
    commands: Record<string, new (input: unknown) => unknown>;
  }> {
    // Carga perezosa: el SDK de AWS solo se requiere si se usa el driver S3.
    // El especificador se resuelve en tiempo de ejecución para que la
    // dependencia siga siendo opcional.
    const specifier = '@aws-sdk/client-s3';
    const sdk = (await import(specifier).catch(() => null)) as null | Record<string, unknown>;
    if (!sdk) {
      throw new InternalServerErrorException(
        'El driver S3 requiere instalar la dependencia opcional @aws-sdk/client-s3.',
      );
    }
    const S3Client = sdk.S3Client as new (config: unknown) => {
      send: (command: unknown) => Promise<unknown>;
    };
    const client = new S3Client({
      region: this.storage.s3.region,
      endpoint: this.storage.s3.endpoint,
      credentials: {
        accessKeyId: this.storage.s3.accessKeyId,
        secretAccessKey: this.storage.s3.secretAccessKey,
      },
    });
    return {
      send: (command) => client.send(command),
      commands: {
        Put: sdk.PutObjectCommand as new (input: unknown) => unknown,
        Get: sdk.GetObjectCommand as new (input: unknown) => unknown,
        Delete: sdk.DeleteObjectCommand as new (input: unknown) => unknown,
      },
    };
  }

  private async putS3(key: string, data: Buffer): Promise<void> {
    const { send, commands } = await this.s3Client();
    await send(new commands.Put({ Bucket: this.storage.s3.bucket, Key: key, Body: data }));
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
