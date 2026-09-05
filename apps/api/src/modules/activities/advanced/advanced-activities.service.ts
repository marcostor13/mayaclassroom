import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ModuleType, sanitizeHtml } from '@maya/shared';
import {
  AdvancedActivity,
  AdvancedActivityDocument,
  AdvancedEntry,
  AdvancedEntryDocument,
} from './schemas/advanced-activity.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { GradesService } from '../../grades/grades.service';
import { CompletionService } from '../../completion/completion.service';
import { CoursesService } from '../../courses/courses.service';
import { FilesService } from '../../files/files.service';
import { toObjectId } from '../../../common/utils';

interface AdvancedMeta {
  label: string;
  icon: string;
  gradable: boolean;
  description: string;
  tags: string[];
  defaultGrade?: number;
}

const ADVANCED_META: Record<string, AdvancedMeta> = {
  [ModuleType.Lesson]: {
    label: 'Lección',
    icon: 'route',
    gradable: true,
    defaultGrade: 100,
    description:
      'Contenido guiado por páginas con preguntas por el camino: según lo que ' +
      'responda el alumnado avanza por una rama u otra.',
    tags: ['Ruta guiada', 'Con preguntas'],
  },
  [ModuleType.Glossary]: {
    label: 'Glosario',
    icon: 'book-a',
    gradable: false,
    description:
      'Diccionario de términos del curso, ordenado alfabéticamente y con ' +
      'búsqueda. El alumnado también puede aportar entradas.',
    tags: ['Colaborativo', 'Con búsqueda'],
  },
  [ModuleType.Wiki]: {
    label: 'Wiki',
    icon: 'network',
    gradable: false,
    description:
      'Páginas que el grupo escribe y corrige entre todos, guardando el ' +
      'historial de cambios.',
    tags: ['Colaborativo', 'Con historial'],
  },
  [ModuleType.Workshop]: {
    label: 'Taller',
    icon: 'users-round',
    gradable: true,
    defaultGrade: 100,
    description:
      'Entrega con evaluación entre iguales: cada persona corrige los trabajos ' +
      'de sus compañeros con una plantilla de criterios.',
    tags: ['Entre iguales', 'Por criterios'],
  },
  [ModuleType.Database]: {
    label: 'Base de datos',
    icon: 'database',
    gradable: false,
    description:
      'Fichas con campos definidos que rellena el grupo —bibliografía, casos, ' +
      'recursos— y luego se buscan y filtran.',
    tags: ['Colaborativo', 'Campos propios'],
  },
  [ModuleType.Chat]: {
    label: 'Chat',
    icon: 'messages-square',
    gradable: false,
    description:
      'Conversación en tiempo real dentro del curso, para tutorías o dudas a una ' +
      'hora acordada.',
    tags: ['En directo'],
  },
  [ModuleType.Scorm]: {
    label: 'Paquete SCORM',
    icon: 'package',
    gradable: true,
    defaultGrade: 100,
    description:
      'Contenido interactivo creado con una herramienta externa y subido como ' +
      'paquete; devuelve por su cuenta la nota y el progreso.',
    tags: ['Contenido externo', 'Reporta nota'],
  },
  [ModuleType.Lti]: {
    label: 'Herramienta externa (LTI)',
    icon: 'plug',
    gradable: true,
    defaultGrade: 100,
    description:
      'Conecta una plataforma de fuera —un simulador, un laboratorio virtual— ' +
      'que se abre con la sesión ya iniciada y devuelve la nota.',
    tags: ['Servicio externo', 'Reporta nota'],
  },
  [ModuleType.H5p]: {
    label: 'H5P',
    icon: 'puzzle',
    gradable: true,
    defaultGrade: 100,
    description:
      'Contenido interactivo del estándar H5P: vídeo con preguntas, ' +
      'presentaciones o juegos de emparejar.',
    tags: ['Interactivo', 'Reporta nota'],
  },
  [ModuleType.Survey]: {
    label: 'Encuesta predefinida',
    icon: 'bar-chart-3',
    gradable: false,
    description:
      'Cuestionarios estándar ya validados sobre el clima del aula. No se ' +
      'redactan preguntas: se elige el modelo.',
    tags: ['Preguntas fijas'],
  },
  [ModuleType.Attendance]: {
    label: 'Asistencia',
    icon: 'user-check',
    gradable: true,
    defaultGrade: 100,
    description:
      'Registro de presencia por sesión, con su parte de faltas y retrasos que ' +
      'puede contar para la nota.',
    tags: ['Por sesiones', 'Cuenta para la nota'],
  },
};

class AdvancedHandler implements ActivityHandler {
  readonly label: string;
  readonly icon: string;
  readonly gradable: boolean;
  readonly description: string;
  readonly tags: string[];
  private readonly defaultGrade?: number;

  constructor(
    readonly type: ModuleType,
    meta: AdvancedMeta,
    private readonly service: AdvancedActivitiesService,
  ) {
    this.label = meta.label;
    this.icon = meta.icon;
    this.gradable = meta.gradable;
    this.description = meta.description;
    this.tags = meta.tags;
    this.defaultGrade = meta.defaultGrade;
  }

  create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    return this.service.createActivity(this.type, input, this.defaultGrade ?? null);
  }

  update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    return this.service.updateActivity(instanceId, input);
  }

  remove(instanceId: Types.ObjectId): Promise<void> {
    return this.service.removeActivity(instanceId);
  }

  get(instanceId: Types.ObjectId): Promise<unknown> {
    return this.service.getActivity(instanceId);
  }

  duplicate(instanceId: Types.ObjectId, targetCourseId: Types.ObjectId): Promise<Types.ObjectId> {
    return this.service.duplicateActivity(instanceId, targetCourseId);
  }
}

@Injectable()
export class AdvancedActivitiesService implements OnModuleInit {
  constructor(
    @InjectModel(AdvancedActivity.name)
    private readonly model: Model<AdvancedActivityDocument>,
    @InjectModel(AdvancedEntry.name)
    private readonly entryModel: Model<AdvancedEntryDocument>,
    private readonly registry: ActivityRegistry,
    private readonly grades: GradesService,
    private readonly completion: CompletionService,
    private readonly courses: CoursesService,
    private readonly files: FilesService,
  ) {}

  onModuleInit(): void {
    for (const [type, meta] of Object.entries(ADVANCED_META)) {
      this.registry.register(new AdvancedHandler(type as ModuleType, meta, this));
    }
  }

  /* ------------------------------ Actividad ------------------------------ */

  async createActivity(
    kind: ModuleType,
    input: ActivityCreateInput,
    defaultGrade: number | null,
  ): Promise<ActivityInstanceResult> {
    const settings = { ...input.settings };
    const gradeMax =
      typeof settings.gradeMax === 'number' ? settings.gradeMax : defaultGrade;

    const activity = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      kind,
      name: input.name,
      intro: (settings.intro as string) ?? input.description ?? null,
      gradeMax,
      settings,
      createdBy: input.userId,
    });
    return { id: activity._id, gradeMax };
  }

  async updateActivity(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const activity = await this.findById(instanceId);
    if (input.name) activity.name = input.name;
    if (input.description !== undefined) activity.intro = input.description;
    if (input.settings) {
      activity.settings = { ...activity.settings, ...input.settings };
      if (typeof input.settings.intro === 'string') activity.intro = input.settings.intro;
      if (typeof input.settings.gradeMax === 'number') activity.gradeMax = input.settings.gradeMax;
      activity.markModified('settings');
    }
    await activity.save();
    return { id: activity._id, gradeMax: activity.gradeMax };
  }

  async removeActivity(instanceId: Types.ObjectId): Promise<void> {
    await this.entryModel.deleteMany({ activity: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async duplicateActivity(
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

    const structural = await this.entryModel
      .find({ activity: source._id, user: null })
      .lean()
      .exec();
    for (const entry of structural) {
      await this.entryModel.create({
        ...(entry as unknown as Record<string, unknown>),
        _id: undefined,
        activity: copy._id,
        createdAt: undefined,
        updatedAt: undefined,
      });
    }
    return copy._id;
  }

  async findById(id: string | Types.ObjectId): Promise<AdvancedActivityDocument> {
    const activity = await this.model.findById(toObjectId(id)).exec();
    if (!activity) throw new NotFoundException('Actividad no encontrada.');
    return activity;
  }

  async getActivity(instanceId: string | Types.ObjectId) {
    const activity = await this.findById(instanceId);
    const structure = await this.entryModel
      .find({ activity: activity._id, user: null })
      .sort({ sortOrder: 1 })
      .exec();

    return {
      id: activity.id,
      courseId: String(activity.course),
      kind: activity.kind,
      name: activity.name,
      intro: activity.intro,
      gradeMax: activity.gradeMax,
      settings: activity.settings,
      structure: structure.map((e) => this.entryToDto(e)),
    };
  }

  /* ------------------------------- Entradas ------------------------------ */

  async entries(
    activityId: string | Types.ObjectId,
    entryType: string,
    options: { userId?: string | Types.ObjectId; approvedOnly?: boolean } = {},
  ) {
    const filter: Record<string, unknown> = {
      activity: toObjectId(activityId),
      entryType,
    };
    if (options.userId) filter.user = toObjectId(options.userId);
    if (options.approvedOnly) filter.approved = true;

    const entries = await this.entryModel
      .find(filter)
      .populate('user', 'firstName lastName avatarUrl')
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
    return entries.map((e) => this.entryToDto(e));
  }

  async addEntry(params: {
    activityId: string | Types.ObjectId;
    entryType: string;
    userId?: string | Types.ObjectId | null;
    title?: string | null;
    content?: string | null;
    data?: Record<string, unknown>;
    fileIds?: string[];
    parentId?: string | Types.ObjectId | null;
    approved?: boolean;
  }) {
    const activity = await this.findById(params.activityId);
    const count = await this.entryModel
      .countDocuments({ activity: activity._id, entryType: params.entryType })
      .exec();

    const entry = await this.entryModel.create({
      activity: activity._id,
      entryType: params.entryType,
      user: params.userId ? toObjectId(params.userId) : null,
      title: params.title ?? null,
      content: params.content ? sanitizeHtml(params.content) : null,
      data: params.data ?? {},
      files: (params.fileIds ?? []).map(toObjectId),
      parent: params.parentId ? toObjectId(params.parentId) : null,
      approved: params.approved ?? true,
      sortOrder: count,
    });

    if (params.fileIds?.length) {
      await this.files.attachToItem(params.fileIds, {
        component: `mod/${activity.kind}`,
        fileArea: 'entry',
        itemId: entry._id,
      });
    }

    if (params.userId) {
      const module = await this.courses.findModuleByInstance(activity.kind, activity._id);
      if (module) {
        await this.completion.evaluate(module._id, params.userId, { submitted: true });
      }
    }

    return this.entryToDto(entry);
  }

  async updateEntry(
    entryId: string | Types.ObjectId,
    updates: {
      title?: string | null;
      content?: string | null;
      data?: Record<string, unknown>;
      approved?: boolean;
      sortOrder?: number;
    },
  ) {
    const entry = await this.entryModel.findById(toObjectId(entryId)).exec();
    if (!entry) throw new NotFoundException('Entrada no encontrada.');
    if (updates.title !== undefined) entry.title = updates.title;
    if (updates.content !== undefined) {
      entry.content = updates.content ? sanitizeHtml(updates.content) : null;
    }
    if (updates.data) {
      entry.data = { ...entry.data, ...updates.data };
      entry.markModified('data');
    }
    if (updates.approved !== undefined) entry.approved = updates.approved;
    if (updates.sortOrder !== undefined) entry.sortOrder = updates.sortOrder;
    await entry.save();
    return this.entryToDto(entry);
  }

  async removeEntry(entryId: string | Types.ObjectId): Promise<void> {
    await this.entryModel.deleteMany({ parent: toObjectId(entryId) }).exec();
    await this.entryModel.deleteOne({ _id: toObjectId(entryId) }).exec();
  }

  /** Califica una entrada (taller, lección, SCORM…) y sincroniza el libro de notas. */
  async gradeEntry(
    entryId: string | Types.ObjectId,
    grade: number,
    graderId?: string | Types.ObjectId,
  ) {
    const entry = await this.entryModel.findById(toObjectId(entryId)).exec();
    if (!entry) throw new NotFoundException('Entrada no encontrada.');
    entry.grade = grade;
    await entry.save();

    const activity = await this.findById(entry.activity);
    if (entry.user && activity.gradeMax) {
      await this.grades.recordModuleGrade({
        courseId: activity.course,
        moduleType: activity.kind,
        instanceId: activity._id,
        userId: entry.user,
        grade,
        graderId,
      });
      const module = await this.courses.findModuleByInstance(activity.kind, activity._id);
      if (module) {
        await this.completion.evaluate(module._id, entry.user, { submitted: true, graded: true });
      }
    }
    return this.entryToDto(entry);
  }

  private entryToDto(entry: AdvancedEntryDocument) {
    const user = entry.user as unknown as {
      _id?: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    } | null;

    return {
      id: entry.id,
      activityId: String(entry.activity),
      entryType: entry.entryType,
      userId: user?._id ? String(user._id) : entry.user ? String(entry.user) : null,
      author: user?.firstName
        ? {
            id: String(user._id),
            fullName: `${user.firstName} ${user.lastName ?? ''}`.trim(),
            avatarUrl: user.avatarUrl ?? null,
          }
        : undefined,
      title: entry.title,
      content: entry.content,
      data: entry.data,
      parentId: entry.parent ? String(entry.parent) : null,
      approved: entry.approved,
      sortOrder: entry.sortOrder,
      grade: entry.grade,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}
