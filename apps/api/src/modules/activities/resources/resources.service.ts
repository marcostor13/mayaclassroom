import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModuleType, sanitizeHtml } from '@maya/shared';
import type { LessonBlock } from '@maya/shared';
import { CourseResource, CourseResourceDocument } from './schemas/resource.schema';
import { BookChapter, BookChapterDocument } from './schemas/book-chapter.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { FilesService } from '../../files/files.service';
import { toObjectId } from '../../../common/utils';

interface ResourceSettings {
  intro?: string;
  content?: string;
  blocks?: LessonBlock[];
  externalUrl?: string;
  display?: 'auto' | 'embed' | 'new' | 'open' | 'download';
  fileIds?: string[];
  showSize?: boolean;
  showType?: boolean;
  forceDownload?: boolean;
}

interface ResourceMeta {
  label: string;
  icon: string;
  description: string;
  tags: string[];
}

const RESOURCE_META: Record<string, ResourceMeta> = {
  [ModuleType.Resource]: {
    label: 'Archivo',
    icon: 'file',
    description:
      'Un documento para descargar o ver dentro del curso: PDF, presentación, ' +
      'hoja de cálculo o imagen.',
    tags: ['Descargable'],
  },
  [ModuleType.Folder]: {
    label: 'Carpeta',
    icon: 'folder',
    description:
      'Varios archivos agrupados en un solo bloque, para no llenar el tema con ' +
      'una línea por documento.',
    tags: ['Varios archivos'],
  },
  [ModuleType.Page]: {
    label: 'Página',
    icon: 'file-text',
    description:
      'Contenido escrito dentro del propio curso, con texto, imágenes y vídeo ' +
      'incrustado. Lo más habitual para una lección.',
    tags: ['Texto y vídeo', 'Sin descarga'],
  },
  [ModuleType.Url]: {
    label: 'Enlace web',
    icon: 'link',
    description:
      'Un enlace a una página externa, que se abre incrustada o en una pestaña ' +
      'nueva según se configure.',
    tags: ['Sitio externo'],
  },
  [ModuleType.Book]: {
    label: 'Libro',
    icon: 'book-open',
    description:
      'Material largo repartido en capítulos con su propio índice, para apuntes ' +
      'o manuales de varias páginas.',
    tags: ['Por capítulos', 'Con índice'],
  },
  [ModuleType.Label]: {
    label: 'Etiqueta',
    icon: 'tag',
    description:
      'Un texto o una imagen sueltos en medio del tema. Sirve para separar ' +
      'bloques y dar contexto, no se abre.',
    tags: ['Solo visual'],
  },
};

/** Manejador reutilizable para cada tipo de recurso. */
class ResourceHandler implements ActivityHandler {
  readonly gradable = false;
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly tags: string[];

  constructor(
    readonly type: ModuleType,
    meta: ResourceMeta,
    private readonly service: ResourcesService,
  ) {
    this.label = meta.label;
    this.icon = meta.icon;
    this.description = meta.description;
    this.tags = meta.tags;
  }

  create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    return this.service.createResource(this.type, input);
  }

  update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    return this.service.updateResource(instanceId, input);
  }

  remove(instanceId: Types.ObjectId): Promise<void> {
    return this.service.removeResource(instanceId);
  }

  get(instanceId: Types.ObjectId): Promise<unknown> {
    return this.service.getResource(instanceId);
  }

  duplicate(instanceId: Types.ObjectId, targetCourseId: Types.ObjectId): Promise<Types.ObjectId> {
    return this.service.duplicateResource(instanceId, targetCourseId);
  }
}

@Injectable()
export class ResourcesService implements OnModuleInit {
  constructor(
    @InjectModel(CourseResource.name)
    private readonly model: Model<CourseResourceDocument>,
    @InjectModel(BookChapter.name)
    private readonly chapterModel: Model<BookChapterDocument>,
    private readonly registry: ActivityRegistry,
    private readonly files: FilesService,
  ) {}

  onModuleInit(): void {
    for (const [type, meta] of Object.entries(RESOURCE_META)) {
      this.registry.register(new ResourceHandler(type as ModuleType, meta, this));
    }
  }

  async createResource(
    kind: ModuleType,
    input: ActivityCreateInput,
  ): Promise<ActivityInstanceResult> {
    const settings = input.settings as ResourceSettings;
    const resource = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      kind,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      content: settings.content ? sanitizeHtml(settings.content) : null,
      externalUrl: settings.externalUrl ?? null,
      display: settings.display ?? 'auto',
      files: (settings.fileIds ?? []).map(toObjectId),
      showSize: settings.showSize ?? false,
      showType: settings.showType ?? false,
      forceDownload: settings.forceDownload ?? false,
      createdBy: input.userId,
    });

    if (settings.fileIds?.length) {
      await this.files.attachToItem(settings.fileIds, {
        component: `mod/${kind}`,
        fileArea: 'content',
        itemId: resource._id,
      });
    }
    return { id: resource._id, gradeMax: null };
  }

  async updateResource(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const resource = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as ResourceSettings;

    if (input.name) resource.name = input.name;
    if (settings.intro !== undefined) resource.intro = settings.intro ?? null;
    if (settings.content !== undefined) {
      resource.content = settings.content ? sanitizeHtml(settings.content) : null;
    }

    if (settings.blocks !== undefined) {
      const bloques = settings.blocks ?? [];
      resource.blocks = bloques.map((bloque) => ({
        id: bloque.id,
        type: bloque.type,
        // El texto de un bloque llega de un editor enriquecido y se muestra
        // como HTML: se limpia igual que el cuerpo de una página.
        content: bloque.content ? sanitizeHtml(bloque.content) : null,
        url: bloque.url ?? null,
        title: bloque.title ?? null,
        variant: bloque.variant ?? null,
        mimeType: bloque.mimeType ?? null,
        filename: bloque.filename ?? null,
      }));
      // `content` se mantiene al día con el texto de los bloques: lo siguen
      // leyendo los resúmenes, la búsqueda y las copias de seguridad, que no
      // saben de bloques.
      resource.content = bloques
        .filter((bloque) => bloque.content)
        .map((bloque) => sanitizeHtml(bloque.content as string))
        .join('\n');
    }
    if (settings.externalUrl !== undefined) resource.externalUrl = settings.externalUrl ?? null;
    if (settings.display !== undefined) resource.display = settings.display;
    if (settings.showSize !== undefined) resource.showSize = settings.showSize;
    if (settings.showType !== undefined) resource.showType = settings.showType;
    if (settings.forceDownload !== undefined) resource.forceDownload = settings.forceDownload;

    if (settings.fileIds) {
      resource.files = settings.fileIds.map(toObjectId);
      await this.files.attachToItem(settings.fileIds, {
        component: `mod/${resource.kind}`,
        fileArea: 'content',
        itemId: resource._id,
      });
    }

    await resource.save();
    return { id: resource._id, gradeMax: null };
  }

  async removeResource(instanceId: Types.ObjectId): Promise<void> {
    const resource = await this.model.findById(instanceId).exec();
    if (!resource) return;
    for (const fileId of resource.files) {
      await this.files.remove(fileId).catch(() => undefined);
    }
    await this.chapterModel.deleteMany({ book: resource._id }).exec();
    await resource.deleteOne();
  }

  async duplicateResource(
    instanceId: Types.ObjectId,
    targetCourseId: Types.ObjectId,
  ): Promise<Types.ObjectId> {
    const source = await this.findById(instanceId);
    const copy = await this.model.create({
      ...(source.toObject() as unknown as Record<string, unknown>),
      _id: undefined,
      course: targetCourseId,
      name: `${source.name} (copia)`,
      createdAt: undefined,
      updatedAt: undefined,
    });

    if (source.kind === ModuleType.Book) {
      const chapters = await this.chapters(source._id);
      for (const chapter of chapters) {
        await this.chapterModel.create({
          book: copy._id,
          title: chapter.title,
          content: chapter.content,
          subChapter: chapter.subChapter,
          hidden: chapter.hidden,
          sortOrder: chapter.sortOrder,
        });
      }
    }
    return copy._id;
  }

  async findById(id: string | Types.ObjectId): Promise<CourseResourceDocument> {
    const resource = await this.model.findById(toObjectId(id)).exec();
    if (!resource) throw new NotFoundException('Recurso no encontrado.');
    return resource;
  }

  async getResource(instanceId: string | Types.ObjectId) {
    const resource = await this.findById(instanceId);
    const files = await this.files.listByArea(
      `mod/${resource.kind}`,
      'content',
      resource._id,
    );
    const chapters =
      resource.kind === ModuleType.Book ? await this.chapters(resource._id) : undefined;

    return {
      id: resource.id,
      courseId: String(resource.course),
      kind: resource.kind,
      name: resource.name,
      intro: resource.intro,
      content: resource.content,
      externalUrl: resource.externalUrl,
      display: resource.display,
      showSize: resource.showSize,
      showType: resource.showType,
      forceDownload: resource.forceDownload,
      files: this.files.toRefs(files),
      chapters: chapters?.map((c) => ({
        id: c.id,
        bookId: String(c.book),
        title: c.title,
        content: c.content,
        subChapter: c.subChapter,
        hidden: c.hidden,
        sortOrder: c.sortOrder,
      })),
    };
  }

  /* ------------------------ Capítulos del libro -------------------------- */

  async chapters(bookId: string | Types.ObjectId): Promise<BookChapterDocument[]> {
    return this.chapterModel
      .find({ book: toObjectId(bookId) })
      .sort({ sortOrder: 1 })
      .exec();
  }

  async addChapter(
    bookId: string | Types.ObjectId,
    dto: { title: string; content: string; subChapter?: boolean },
  ): Promise<BookChapterDocument> {
    const count = await this.chapterModel.countDocuments({ book: toObjectId(bookId) }).exec();
    return this.chapterModel.create({
      book: toObjectId(bookId),
      title: dto.title,
      content: sanitizeHtml(dto.content),
      subChapter: dto.subChapter ?? false,
      sortOrder: count,
    });
  }

  async updateChapter(
    chapterId: string | Types.ObjectId,
    dto: { title?: string; content?: string; hidden?: boolean; sortOrder?: number },
  ): Promise<BookChapterDocument> {
    const chapter = await this.chapterModel.findById(toObjectId(chapterId)).exec();
    if (!chapter) throw new NotFoundException('Capítulo no encontrado.');
    if (dto.title) chapter.title = dto.title;
    if (dto.content !== undefined) chapter.content = sanitizeHtml(dto.content);
    if (dto.hidden !== undefined) chapter.hidden = dto.hidden;
    if (dto.sortOrder !== undefined) chapter.sortOrder = dto.sortOrder;
    await chapter.save();
    return chapter;
  }

  async removeChapter(chapterId: string | Types.ObjectId): Promise<void> {
    await this.chapterModel.deleteOne({ _id: toObjectId(chapterId) }).exec();
  }
}
