import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  ContextLevel,
  CourseFormat,
  CourseVisibility,
  ModuleType,
} from '@maya/shared';
import { Course, CourseDocument } from './schemas/course.schema';
import { CourseSection, CourseSectionDocument } from './schemas/course-section.schema';
import { CourseModule, CourseModuleDocument } from './schemas/course-module.schema';
import { ContextsService } from '../contexts/contexts.service';
import { CategoriesService } from '../categories/categories.service';
import { ActivityRegistry } from '../activities/activity-registry.service';
import { PaginatedResult } from '../../common/dto';
import { notDeleted, searchRegex, toObjectId, weekLabel } from '../../common/utils';
import {
  CourseQueryDto,
  CreateCourseDto,
  CreateModuleDto,
  CreateSectionDto,
  MoveModuleDto,
  UpdateCourseDto,
  UpdateModuleDto,
  UpdateSectionDto,
} from './dto/course.dto';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseSection.name) private readonly sectionModel: Model<CourseSectionDocument>,
    @InjectModel(CourseModule.name) private readonly moduleModel: Model<CourseModuleDocument>,
    private readonly contexts: ContextsService,
    private readonly categories: CategoriesService,
    private readonly registry: ActivityRegistry,
  ) {}

  /* -------------------------------- Cursos ------------------------------- */

  async findById(id: string | Types.ObjectId): Promise<CourseDocument> {
    const course = await this.courseModel.findById(toObjectId(id)).exec();
    if (!course || course.deletedAt) throw new NotFoundException('Curso no encontrado.');
    return course;
  }

  async findByIdInTenant(
    id: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<CourseDocument> {
    const course = await this.courseModel
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId), ...notDeleted })
      .exec();
    if (!course) throw new NotFoundException('Curso no encontrado en esta empresa.');
    return course;
  }

  async paginate(
    tenantId: string | Types.ObjectId,
    query: CourseQueryDto,
    options: { enrolledCourseIds?: Types.ObjectId[]; canSeeHidden?: boolean; favouriteIds?: Types.ObjectId[] } = {},
  ): Promise<PaginatedResult<CourseDocument>> {
    const filter: FilterQuery<CourseDocument> = { tenant: toObjectId(tenantId), ...notDeleted };

    if (!options.canSeeHidden) filter.visibility = CourseVisibility.Visible;
    if (query.visibility) filter.visibility = query.visibility;

    if (query.categoryId) {
      filter.category = query.includeSubcategories
        ? { $in: await this.categories.subtreeIds(query.categoryId) }
        : toObjectId(query.categoryId);
    }
    if (query.tag) filter.tags = query.tag;
    if (query.search) {
      filter.$or = [
        { fullName: searchRegex(query.search) },
        { shortName: searchRegex(query.search) },
        { idNumber: searchRegex(query.search) },
      ];
    }
    if (query.onlyMine && options.enrolledCourseIds) {
      filter._id = { $in: options.enrolledCourseIds };
    }

    const now = new Date();
    switch (query.classification) {
      case 'inprogress':
        filter.$and = [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        ];
        break;
      case 'future':
        filter.startDate = { $gt: now };
        break;
      case 'past':
        filter.endDate = { $lt: now };
        break;
      case 'favourites':
        filter._id = { $in: options.favouriteIds ?? [] };
        break;
      default:
        break;
    }

    const [items, total] = await Promise.all([
      this.courseModel
        .find(filter)
        .populate('category', 'name')
        .sort(query.sort ? query.sortObject : { sortOrder: 1, fullName: 1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.courseModel.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: CreateCourseDto,
    userId: string | Types.ObjectId,
  ): Promise<CourseDocument> {
    const clash = await this.courseModel
      .findOne({ tenant: toObjectId(tenantId), shortName: dto.shortName, ...notDeleted })
      .exec();
    if (clash) throw new ConflictException(`Ya existe un curso con el nombre corto «${dto.shortName}».`);

    const category = await this.categories.findById(dto.categoryId);
    if (String(category.tenant) !== String(tenantId)) {
      throw new BadRequestException('La categoría pertenece a otra empresa.');
    }

    const course = await this.courseModel.create({
      tenant: toObjectId(tenantId),
      category: category._id,
      shortName: dto.shortName,
      fullName: dto.fullName,
      idNumber: dto.idNumber ?? null,
      summary: dto.summary ?? null,
      imageUrl: dto.imageUrl ?? null,
      format: dto.format ?? CourseFormat.Topics,
      visibility: dto.visibility ?? CourseVisibility.Visible,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      numSections: dto.numSections ?? 10,
      groupMode: dto.groupMode ?? 0,
      forceGroupMode: dto.forceGroupMode ?? false,
      showGradebook: dto.showGradebook ?? true,
      enableCompletion: dto.enableCompletion ?? true,
      completionNotify: dto.completionNotify ?? false,
      language: dto.language ?? null,
      tags: dto.tags ?? [],
      formatOptions: dto.formatOptions ?? {},
      customFields: dto.customFields ?? {},
      createdBy: toObjectId(userId),
    });

    const categoryContext = await this.contexts.requireByInstance(
      ContextLevel.Category,
      category._id,
    );
    await this.contexts.ensureContext({
      level: ContextLevel.Course,
      instanceId: course._id,
      parentId: categoryContext._id,
      tenantId,
      label: course.fullName,
    });

    await this.createDefaultSections(course);
    await this.categories.adjustCourseCount(category._id, 1);

    this.logger.log(`Curso creado: ${course.shortName}`);
    return course;
  }

  private async createDefaultSections(course: CourseDocument): Promise<void> {
    const total = course.format === CourseFormat.SingleActivity ? 1 : course.numSections + 1;
    const sections = Array.from({ length: total }, (_, index) => ({
      course: course._id,
      sectionNumber: index,
      name:
        index === 0
          ? null
          : course.format === CourseFormat.Weekly && course.startDate
            ? weekLabel(course.startDate, index - 1)
            : null,
      visible: true,
      moduleOrder: [],
    }));
    await this.sectionModel.insertMany(sections);
  }

  async update(id: string | Types.ObjectId, dto: UpdateCourseDto): Promise<CourseDocument> {
    const course = await this.findById(id);
    const previousCategory = course.category;

    if (dto.shortName && dto.shortName !== course.shortName) {
      const clash = await this.courseModel
        .findOne({ tenant: course.tenant, shortName: dto.shortName, _id: { $ne: course._id } })
        .exec();
      if (clash) throw new ConflictException('Ya existe otro curso con ese nombre corto.');
    }

    if (dto.categoryId && String(dto.categoryId) !== String(course.category)) {
      const category = await this.categories.findById(dto.categoryId);
      course.category = category._id;
      const categoryContext = await this.contexts.requireByInstance(
        ContextLevel.Category,
        category._id,
      );
      const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, course._id);
      await this.contexts.moveSubtree(courseContext, categoryContext);
      await this.categories.adjustCourseCount(previousCategory, -1);
      await this.categories.adjustCourseCount(category._id, 1);
    }

    const { startDate, endDate, numSections, ...rest } = dto;
    Object.assign(course, rest);
    if (startDate !== undefined) course.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) course.endDate = endDate ? new Date(endDate) : null;

    if (numSections !== undefined && numSections !== course.numSections) {
      await this.resizeSections(course, numSections);
      course.numSections = numSections;
    }

    await course.save();
    await this.contexts.ensureContext({
      level: ContextLevel.Course,
      instanceId: course._id,
      tenantId: course.tenant,
      label: course.fullName,
    });
    return course;
  }

  private async resizeSections(course: CourseDocument, target: number): Promise<void> {
    const existing = await this.sectionModel.countDocuments({ course: course._id }).exec();
    const desired = target + 1;

    if (desired > existing) {
      const additions = Array.from({ length: desired - existing }, (_, index) => ({
        course: course._id,
        sectionNumber: existing + index,
        visible: true,
        moduleOrder: [],
      }));
      await this.sectionModel.insertMany(additions);
      return;
    }

    const removable = await this.sectionModel
      .find({ course: course._id, sectionNumber: { $gte: desired } })
      .exec();
    for (const section of removable) {
      const modules = await this.moduleModel.countDocuments({ section: section._id }).exec();
      if (modules > 0) {
        throw new BadRequestException(
          `La sección ${section.sectionNumber} contiene actividades; vacíela antes de reducir el número de secciones.`,
        );
      }
      await section.deleteOne();
    }
  }

  async setVisibility(
    id: string | Types.ObjectId,
    visibility: CourseVisibility,
  ): Promise<CourseDocument> {
    const course = await this.findById(id);
    course.visibility = visibility;
    await course.save();
    return course;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    const course = await this.findById(id);
    const modules = await this.moduleModel.find({ course: course._id }).exec();
    for (const module of modules) {
      const handler = this.registry.has(module.moduleType)
        ? this.registry.get(module.moduleType)
        : null;
      if (handler) await handler.remove(module.instance);
      await module.deleteOne();
    }
    await this.sectionModel.deleteMany({ course: course._id }).exec();
    course.deletedAt = new Date();
    await course.save();
    await this.categories.adjustCourseCount(course.category, -1);
    await this.contexts.deleteForInstance(ContextLevel.Course, course._id);
  }

  async adjustEnrolledCount(id: string | Types.ObjectId, delta: number): Promise<void> {
    await this.courseModel.updateOne({ _id: toObjectId(id) }, { $inc: { enrolledCount: delta } }).exec();
  }

  /* ------------------------------ Secciones ------------------------------ */

  async sections(courseId: string | Types.ObjectId): Promise<CourseSectionDocument[]> {
    return this.sectionModel
      .find({ course: toObjectId(courseId) })
      .sort({ sectionNumber: 1 })
      .exec();
  }

  async findSection(id: string | Types.ObjectId): Promise<CourseSectionDocument> {
    const section = await this.sectionModel.findById(toObjectId(id)).exec();
    if (!section) throw new NotFoundException('Sección no encontrada.');
    return section;
  }

  async addSection(
    courseId: string | Types.ObjectId,
    dto: CreateSectionDto,
  ): Promise<CourseSectionDocument> {
    const course = await this.findById(courseId);
    const last = await this.sectionModel
      .findOne({ course: course._id })
      .sort({ sectionNumber: -1 })
      .exec();
    const section = await this.sectionModel.create({
      course: course._id,
      sectionNumber: (last?.sectionNumber ?? -1) + 1,
      name: dto.name ?? null,
      summary: dto.summary ?? null,
      visible: dto.visible ?? true,
      availabilityJson: dto.availabilityJson ?? null,
      moduleOrder: [],
    });
    course.numSections = Math.max(course.numSections, section.sectionNumber);
    await course.save();
    return section;
  }

  async updateSection(
    id: string | Types.ObjectId,
    dto: UpdateSectionDto,
  ): Promise<CourseSectionDocument> {
    const section = await this.findSection(id);
    Object.assign(section, dto);
    await section.save();
    return section;
  }

  async removeSection(id: string | Types.ObjectId): Promise<void> {
    const section = await this.findSection(id);
    if (section.sectionNumber === 0) {
      throw new BadRequestException('La sección general no puede eliminarse.');
    }
    const modules = await this.moduleModel.find({ section: section._id }).exec();
    for (const module of modules) await this.removeModule(module._id);
    await section.deleteOne();

    const remaining = await this.sectionModel
      .find({ course: section.course, sectionNumber: { $gt: section.sectionNumber } })
      .sort({ sectionNumber: 1 })
      .exec();
    for (const item of remaining) {
      item.sectionNumber -= 1;
      await item.save();
    }
  }

  async moveSection(id: string | Types.ObjectId, targetNumber: number): Promise<void> {
    const section = await this.findSection(id);
    if (section.sectionNumber === 0 || targetNumber === 0) {
      throw new BadRequestException('La sección general no puede reordenarse.');
    }
    const sections = await this.sections(section.course);
    const ordered = sections
      .filter((s) => s.sectionNumber !== 0)
      .sort((a, b) => a.sectionNumber - b.sectionNumber);
    const current = ordered.findIndex((s) => s.id === section.id);
    const [moved] = ordered.splice(current, 1);
    ordered.splice(Math.max(0, targetNumber - 1), 0, moved);
    for (let index = 0; index < ordered.length; index += 1) {
      ordered[index].sectionNumber = index + 1;
      await ordered[index].save();
    }
  }

  /* --------------------------- Módulos de curso -------------------------- */

  async modules(courseId: string | Types.ObjectId): Promise<CourseModuleDocument[]> {
    return this.moduleModel
      .find({ course: toObjectId(courseId) })
      .sort({ sortOrder: 1 })
      .exec();
  }

  async findModule(id: string | Types.ObjectId): Promise<CourseModuleDocument> {
    const module = await this.moduleModel.findById(toObjectId(id)).exec();
    if (!module) throw new NotFoundException('Actividad no encontrada.');
    return module;
  }

  async findModuleByInstance(
    type: ModuleType,
    instanceId: string | Types.ObjectId,
  ): Promise<CourseModuleDocument | null> {
    return this.moduleModel.findOne({ moduleType: type, instance: toObjectId(instanceId) }).exec();
  }

  async addModule(
    courseId: string | Types.ObjectId,
    dto: CreateModuleDto,
    userId: string | Types.ObjectId,
  ): Promise<CourseModuleDocument> {
    const course = await this.findById(courseId);
    const section = await this.findSection(dto.sectionId);
    if (String(section.course) !== String(course._id)) {
      throw new BadRequestException('La sección no pertenece a este curso.');
    }

    const handler = this.registry.get(dto.moduleType);
    const instance = await handler.create({
      tenantId: course.tenant,
      courseId: course._id,
      name: dto.name,
      description: dto.description ?? null,
      settings: dto.settings ?? {},
      userId: toObjectId(userId),
    });

    const position = section.moduleOrder.length;
    const module = await this.moduleModel.create({
      course: course._id,
      section: section._id,
      moduleType: dto.moduleType,
      instance: instance.id,
      name: dto.name,
      description: dto.description ?? null,
      visible: dto.visible ?? true,
      sortOrder: position,
      groupMode: dto.groupMode ?? course.groupMode,
      completionTracking: dto.completionTracking ?? 0,
      completionRules: dto.completionRules ?? {},
      completionExpected: dto.completionExpected ? new Date(dto.completionExpected) : null,
      availabilityJson: dto.availabilityJson ?? null,
      gradeMax: instance.gradeMax,
      createdBy: toObjectId(userId),
    });

    section.moduleOrder.push(module._id);
    await section.save();

    const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, course._id);
    await this.contexts.ensureContext({
      level: ContextLevel.Module,
      instanceId: module._id,
      parentId: courseContext._id,
      tenantId: course.tenant,
      label: module.name,
    });

    return module;
  }

  async updateModule(
    id: string | Types.ObjectId,
    dto: UpdateModuleDto,
  ): Promise<CourseModuleDocument> {
    const module = await this.findModule(id);
    const handler = this.registry.get(module.moduleType);

    if (dto.name || dto.description !== undefined || dto.settings) {
      const result = await handler.update(module.instance, {
        name: dto.name,
        description: dto.description ?? null,
        settings: dto.settings ?? {},
      });
      module.gradeMax = result.gradeMax;
    }

    if (dto.name) module.name = dto.name;
    if (dto.description !== undefined) module.description = dto.description ?? null;
    if (dto.visible !== undefined) module.visible = dto.visible;
    if (dto.groupMode !== undefined) module.groupMode = dto.groupMode;
    if (dto.completionTracking !== undefined) module.completionTracking = dto.completionTracking;
    if (dto.completionRules) module.completionRules = dto.completionRules;
    if (dto.completionExpected !== undefined) {
      module.completionExpected = dto.completionExpected ? new Date(dto.completionExpected) : null;
    }
    // La cadena vacía significa «sin restricciones»; se guarda como null.
    if (dto.availabilityJson !== undefined) module.availabilityJson = dto.availabilityJson || null;

    await module.save();
    await this.contexts.ensureContext({
      level: ContextLevel.Module,
      instanceId: module._id,
      tenantId: (await this.findById(module.course)).tenant,
      label: module.name,
    });
    return module;
  }

  async moveModule(id: string | Types.ObjectId, dto: MoveModuleDto): Promise<void> {
    const module = await this.findModule(id);
    const origin = await this.findSection(module.section);
    const target = await this.findSection(dto.sectionId);

    origin.moduleOrder = origin.moduleOrder.filter((m) => String(m) !== String(module._id));
    await origin.save();

    const order = target.moduleOrder.filter((m) => String(m) !== String(module._id));
    order.splice(Math.min(dto.position, order.length), 0, module._id);
    target.moduleOrder = order;
    await target.save();

    module.section = target._id;
    await module.save();

    await Promise.all(
      order.map((moduleId, index) =>
        this.moduleModel.updateOne({ _id: moduleId }, { $set: { sortOrder: index } }).exec(),
      ),
    );
  }

  async setModuleVisibility(id: string | Types.ObjectId, visible: boolean, stealth = false) {
    const module = await this.findModule(id);
    module.visible = visible;
    module.stealth = stealth;
    await module.save();
    return module;
  }

  async removeModule(id: string | Types.ObjectId): Promise<void> {
    const module = await this.findModule(id);
    const handler = this.registry.has(module.moduleType)
      ? this.registry.get(module.moduleType)
      : null;
    if (handler) await handler.remove(module.instance);

    await this.sectionModel
      .updateOne({ _id: module.section }, { $pull: { moduleOrder: module._id } })
      .exec();
    await this.contexts.deleteForInstance(ContextLevel.Module, module._id);
    await module.deleteOne();
  }

  async duplicateModule(id: string | Types.ObjectId, userId: string | Types.ObjectId) {
    const module = await this.findModule(id);
    const handler = this.registry.get(module.moduleType);
    if (!handler.duplicate) {
      throw new BadRequestException('Este tipo de actividad no admite duplicación.');
    }
    const newInstance = await handler.duplicate(module.instance, module.course);
    const section = await this.findSection(module.section);

    const copy = await this.moduleModel.create({
      course: module.course,
      section: section._id,
      moduleType: module.moduleType,
      instance: newInstance,
      name: `${module.name} (copia)`,
      description: module.description,
      visible: false,
      sortOrder: section.moduleOrder.length,
      groupMode: module.groupMode,
      completionTracking: module.completionTracking,
      completionRules: module.completionRules,
      availabilityJson: module.availabilityJson,
      gradeMax: module.gradeMax,
      createdBy: toObjectId(userId),
    });
    section.moduleOrder.push(copy._id);
    await section.save();

    const course = await this.findById(module.course);
    const courseContext = await this.contexts.requireByInstance(ContextLevel.Course, course._id);
    await this.contexts.ensureContext({
      level: ContextLevel.Module,
      instanceId: copy._id,
      parentId: courseContext._id,
      tenantId: course.tenant,
      label: copy.name,
    });
    return copy;
  }

  /** Catálogo de tipos de actividad disponibles. */
  activityCatalog() {
    return this.registry.catalog();
  }
}
