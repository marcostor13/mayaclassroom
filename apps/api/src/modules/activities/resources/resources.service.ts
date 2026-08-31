import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModuleType, sanitizeHtml } from '@maya/shared';
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
  externalUrl?: string;
  display?: 'auto' | 'embed' | 'new' | 'open' | 'download';
  fileIds?: string[];
  showSize?: boolean;
  showType?: boolean;
  forceDownload?: boolean;
}

const RESOURCE_META: Record<string, { label: string; icon: string }> = {
  [ModuleType.Resource]: { label: 'Archivo', icon: 'file' },
  [ModuleType.Folder]: { label: 'Carpeta', icon: 'folder' },
  [ModuleType.Page]: { label: 'Página', icon: 'file-text' },
  [ModuleType.Url]: { label: 'URL', icon: 'link' },
  [ModuleType.Book]: { label: 'Libro', icon: 'book-open' },
  [ModuleType.Label]: { label: 'Etiqueta', icon: 'tag' },
};

/** Manejador reutilizable para cada tipo de recurso. */
class ResourceHandler implements ActivityHandler {
  readonly gradable = false;

  constructor(
    readonly type: ModuleType,
    readonly label: string,
    readonly icon: string,
    private readonly service: ResourcesService,
  ) {}

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
      this.registry.register(
        new ResourceHandler(type as ModuleType, meta.label, meta.icon, this),
      );
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
