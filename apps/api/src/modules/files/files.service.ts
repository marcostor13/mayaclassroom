import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import sharp from 'sharp';
import { FileRef } from '@maya/shared';
import { StoredFile, StoredFileDocument } from './schemas/stored-file.schema';
import { StorageService } from './storage.service';
import { TenantsService } from '../tenants/tenants.service';
import { AppConfig, StorageConfig } from '../../config';
import { toObjectId } from '../../common/utils';

export interface UploadInput {
  tenantId: string | Types.ObjectId;
  ownerId: string | Types.ObjectId;
  component: string;
  fileArea: string;
  itemId?: string | Types.ObjectId | null;
  contextId?: string | Types.ObjectId | null;
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number };
  isPublic?: boolean;
  allowedMimeTypes?: string[];
  maxSize?: number;
  makeThumbnail?: boolean;
}

const IMAGE_MIME = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/;

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.dll', '.sh', '.ps1', '.jar',
];

@Injectable()
export class FilesService {
  constructor(
    @InjectModel(StoredFile.name) private readonly model: Model<StoredFileDocument>,
    private readonly storage: StorageService,
    private readonly tenants: TenantsService,
    private readonly config: ConfigService,
  ) {}

  private get storageConfig(): StorageConfig {
    return this.config.getOrThrow<StorageConfig>('storage');
  }

  async upload(input: UploadInput): Promise<StoredFileDocument> {
    const { file } = input;
    const maxSize = input.maxSize ?? this.storageConfig.maxFileSize;

    if (file.size > maxSize) {
      throw new BadRequestException(
        `El fichero supera el tamaño máximo permitido (${Math.round(maxSize / 1024 / 1024)} MB).`,
      );
    }
    const lower = file.originalname.toLowerCase();
    if (BLOCKED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      throw new BadRequestException('El tipo de fichero no está permitido por seguridad.');
    }
    if (input.allowedMimeTypes?.length && !input.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Solo se admiten los siguientes tipos: ${input.allowedMimeTypes.join(', ')}.`,
      );
    }

    const key = this.storage.buildKey(`${input.component}/${input.fileArea}`, file.originalname);
    const stored = await this.storage.put(key, file.buffer, file.mimetype);

    let thumbnailKey: string | null = null;
    if ((input.makeThumbnail ?? true) && IMAGE_MIME.test(file.mimetype) && file.mimetype !== 'image/svg+xml') {
      thumbnailKey = await this.createThumbnail(key, file.buffer);
    }

    const document = await this.model.create({
      tenant: toObjectId(input.tenantId),
      context: input.contextId ? toObjectId(input.contextId) : null,
      component: input.component,
      fileArea: input.fileArea,
      itemId: input.itemId ? toObjectId(input.itemId) : null,
      filename: this.sanitizeFilename(file.originalname),
      storageKey: stored.key,
      mimeType: file.mimetype,
      size: stored.size,
      checksum: stored.checksum,
      thumbnailKey,
      owner: toObjectId(input.ownerId),
      isPublic: input.isPublic ?? false,
    });

    await this.tenants.adjustStorage(input.tenantId, stored.size);
    return document;
  }

  private async createThumbnail(key: string, buffer: Buffer): Promise<string | null> {
    try {
      const thumb = await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      const thumbKey = `${key}.thumb.webp`;
      await this.storage.put(thumbKey, thumb, 'image/webp');
      return thumbKey;
    } catch {
      return null;
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 200);
  }

  async findById(id: string | Types.ObjectId): Promise<StoredFileDocument> {
    const file = await this.model.findById(toObjectId(id)).exec();
    if (!file || file.deletedAt) throw new NotFoundException('Fichero no encontrado.');
    return file;
  }

  async listByArea(
    component: string,
    fileArea: string,
    itemId: string | Types.ObjectId,
  ): Promise<StoredFileDocument[]> {
    return this.model
      .find({ component, fileArea, itemId: toObjectId(itemId), deletedAt: null })
      .sort({ createdAt: 1 })
      .exec();
  }

  async listByOwner(
    ownerId: string | Types.ObjectId,
    component?: string,
  ): Promise<StoredFileDocument[]> {
    const filter: Record<string, unknown> = { owner: toObjectId(ownerId), deletedAt: null };
    if (component) filter.component = component;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  async download(id: string | Types.ObjectId): Promise<{ file: StoredFileDocument; data: Buffer }> {
    const file = await this.findById(id);
    const data = await this.storage.get(file.storageKey);
    await this.model.updateOne({ _id: file._id }, { $inc: { downloadCount: 1 } }).exec();
    return { file, data };
  }

  async remove(id: string | Types.ObjectId, requesterId?: string | Types.ObjectId): Promise<void> {
    const file = await this.findById(id);
    if (requesterId && String(file.owner) !== String(requesterId)) {
      throw new ForbiddenException('Solo el propietario puede eliminar este fichero.');
    }
    await this.storage.remove(file.storageKey);
    if (file.thumbnailKey) await this.storage.remove(file.thumbnailKey);
    await this.tenants.adjustStorage(file.tenant, -file.size);
    file.deletedAt = new Date();
    await file.save();
  }

  async removeByArea(
    component: string,
    fileArea: string,
    itemId: string | Types.ObjectId,
  ): Promise<void> {
    const files = await this.listByArea(component, fileArea, itemId);
    for (const file of files) await this.remove(file._id);
  }

  /** Vincula ficheros ya subidos (borrador) a un elemento definitivo. */
  async attachToItem(
    fileIds: (string | Types.ObjectId)[],
    params: { component: string; fileArea: string; itemId: string | Types.ObjectId; contextId?: string | Types.ObjectId },
  ): Promise<void> {
    if (!fileIds.length) return;
    await this.model
      .updateMany(
        { _id: { $in: fileIds.map(toObjectId) } },
        {
          $set: {
            component: params.component,
            fileArea: params.fileArea,
            itemId: toObjectId(params.itemId),
            ...(params.contextId ? { context: toObjectId(params.contextId) } : {}),
          },
        },
      )
      .exec();
  }

  /**
   * Un fichero público guardado fuera se enlaza directamente al almacenamiento
   * y no a través de la API.
   *
   * No es solo eficiencia: un logo o la portada de un curso los pide el
   * navegador de gente sin sesión —la página pública, el correo de bienvenida—
   * y `/files/:id/download` exige testigo. Sirviéndolos desde el bucket, además,
   * el tráfico de imágenes deja de pasar por el servidor de la API.
   *
   * Lo privado sigue saliendo por la API, que es donde se comprueban permisos.
   */
  toRef(file: StoredFileDocument): FileRef {
    if (file.isPublic) {
      // Con almacenamiento remoto se enlaza al bucket; con disco local, a la
      // ruta pública de la API. En los dos casos la dirección es **absoluta**:
      // el cliente vive en otro origen que la API (:4205 frente a :3000), así
      // que una ruta relativa apuntaría al propio cliente y daría 404.
      const url = this.storage.isRemote
        ? this.storage.publicUrl(file.storageKey)
        : `${this.apiBase}/files/public/${file.id}`;
      return {
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        url,
        thumbnailUrl:
          file.thumbnailKey && this.storage.isRemote
            ? this.storage.publicUrl(file.thumbnailKey)
            : url,
        createdAt: file.createdAt?.toISOString(),
      };
    }

    // Lo privado sigue saliendo por la ruta con permisos, en relativo: solo lo
    // pide la aplicación, que ya sabe a qué servidor hablar.
    return {
      id: file.id,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      url: `/api/v1/files/${file.id}/download`,
      thumbnailUrl: file.thumbnailKey ? `/api/v1/files/${file.id}/thumbnail` : null,
      createdAt: file.createdAt?.toISOString(),
    };
  }

  /** Base pública de la API, sin barra final: «https://api.ejemplo.com/api/v1». */
  private get apiBase(): string {
    const app = this.config.getOrThrow<AppConfig>('app');
    return `${app.url.replace(/\/$/, '')}/${app.globalPrefix}/v1`;
  }

  toRefs(files: StoredFileDocument[]): FileRef[] {
    return files.map((f) => this.toRef(f));
  }
}
