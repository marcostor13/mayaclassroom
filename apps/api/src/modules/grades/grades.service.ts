import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ContextLevel,
  GradeAggregation,
  GradeItemType,
  GradeType,
  GraderReport,
  UserGradeReport,
  fullName,
  round,
} from '@maya/shared';
import { GradeItem, GradeItemDocument } from './schemas/grade-item.schema';
import { GradeCategory, GradeCategoryDocument } from './schemas/grade-category.schema';
import { Grade, GradeDocument } from './schemas/grade.schema';
import { GradeScale, GradeScaleDocument } from './schemas/grade-scale.schema';
import { GradeLetter, GradeLetterDocument } from './schemas/grade-letter.schema';
import { ContextsService } from '../contexts/contexts.service';
import { toObjectId } from '../../common/utils';
import {
  CreateGradeCategoryDto,
  CreateGradeItemDto,
  CreateScaleDto,
  SetGradeDto,
  UpdateGradeCategoryDto,
  UpdateGradeItemDto,
} from './dto/grade.dto';

const DEFAULT_LETTERS = [
  { letter: 'A', lowerBoundary: 90 },
  { letter: 'B', lowerBoundary: 80 },
  { letter: 'C', lowerBoundary: 70 },
  { letter: 'D', lowerBoundary: 60 },
  { letter: 'E', lowerBoundary: 50 },
  { letter: 'F', lowerBoundary: 0 },
];

/**
 * Libro de calificaciones. Implementa ítems, categorías anidadas, las
 * estrategias de agregación de Moodle, escalas y letras de calificación.
 */
@Injectable()
export class GradesService {
  private readonly logger = new Logger(GradesService.name);

  constructor(
    @InjectModel(GradeItem.name) private readonly itemModel: Model<GradeItemDocument>,
    @InjectModel(GradeCategory.name) private readonly categoryModel: Model<GradeCategoryDocument>,
    @InjectModel(Grade.name) private readonly gradeModel: Model<GradeDocument>,
    @InjectModel(GradeScale.name) private readonly scaleModel: Model<GradeScaleDocument>,
    @InjectModel(GradeLetter.name) private readonly letterModel: Model<GradeLetterDocument>,
    private readonly contexts: ContextsService,
  ) {}

  /* ------------------------- Provisión del curso ------------------------- */

  /** Crea la categoría raíz y el ítem «Total del curso». */
  async provisionCourse(courseId: string | Types.ObjectId): Promise<void> {
    const existing = await this.categoryModel
      .findOne({ course: toObjectId(courseId), parent: null })
      .exec();
    if (existing) return;

    const root = await this.categoryModel.create({
      course: toObjectId(courseId),
      parent: null,
      name: 'Total del curso',
      aggregation: GradeAggregation.Natural,
      depth: 0,
      path: '/',
    });
    root.path = `/${root._id.toString()}/`;
    await root.save();

    await this.itemModel.create({
      course: toObjectId(courseId),
      category: root._id,
      itemType: GradeItemType.Course,
      name: 'Total del curso',
      gradeType: GradeType.Value,
      grademax: 100,
      grademin: 0,
      sortOrder: 9999,
    });
  }

  async rootCategory(courseId: string | Types.ObjectId): Promise<GradeCategoryDocument> {
    const root = await this.categoryModel
      .findOne({ course: toObjectId(courseId), parent: null })
      .exec();
    if (!root) {
      await this.provisionCourse(courseId);
      return this.rootCategory(courseId);
    }
    return root;
  }

  async courseTotalItem(courseId: string | Types.ObjectId): Promise<GradeItemDocument> {
    const item = await this.itemModel
      .findOne({ course: toObjectId(courseId), itemType: GradeItemType.Course })
      .exec();
    if (!item) {
      await this.provisionCourse(courseId);
      return this.courseTotalItem(courseId);
    }
    return item;
  }

  /* ------------------------------- Ítems --------------------------------- */

  async items(courseId: string | Types.ObjectId): Promise<GradeItemDocument[]> {
    return this.itemModel
      .find({ course: toObjectId(courseId) })
      .sort({ sortOrder: 1, createdAt: 1 })
      .exec();
  }

  async findItem(id: string | Types.ObjectId): Promise<GradeItemDocument> {
    const item = await this.itemModel.findById(toObjectId(id)).exec();
    if (!item) throw new NotFoundException('Ítem de calificación no encontrado.');
    return item;
  }

  async createManualItem(
    courseId: string | Types.ObjectId,
    dto: CreateGradeItemDto,
  ): Promise<GradeItemDocument> {
    const root = await this.rootCategory(courseId);
    const count = await this.itemModel.countDocuments({ course: toObjectId(courseId) }).exec();
    return this.itemModel.create({
      course: toObjectId(courseId),
      category: dto.categoryId ? toObjectId(dto.categoryId) : root._id,
      itemType: GradeItemType.Manual,
      name: dto.name,
      gradeType: dto.gradeType ?? GradeType.Value,
      scale: dto.scaleId ? toObjectId(dto.scaleId) : null,
      grademax: dto.grademax ?? 100,
      grademin: dto.grademin ?? 0,
      gradepass: dto.gradepass ?? null,
      weight: dto.weight ?? 1,
      hidden: dto.hidden ?? false,
      decimals: dto.decimals ?? 2,
      sortOrder: count,
    });
  }

  /** Crea o actualiza el ítem asociado a una actividad calificable. */
  async syncModuleItem(params: {
    courseId: string | Types.ObjectId;
    moduleType: string;
    instanceId: string | Types.ObjectId;
    courseModuleId?: string | Types.ObjectId | null;
    name: string;
    grademax: number;
    gradepass?: number | null;
    gradeType?: GradeType;
    scaleId?: string | Types.ObjectId | null;
  }): Promise<GradeItemDocument> {
    const root = await this.rootCategory(params.courseId);
    const existing = await this.itemModel
      .findOne({ itemModule: params.moduleType, itemInstance: toObjectId(params.instanceId) })
      .exec();

    if (existing) {
      existing.name = params.name;
      existing.grademax = params.grademax;
      existing.gradepass = params.gradepass ?? existing.gradepass;
      if (params.gradeType) existing.gradeType = params.gradeType;
      if (params.courseModuleId) existing.courseModule = toObjectId(params.courseModuleId);
      await existing.save();
      return existing;
    }

    const count = await this.itemModel.countDocuments({ course: toObjectId(params.courseId) }).exec();
    return this.itemModel.create({
      course: toObjectId(params.courseId),
      category: root._id,
      itemType: GradeItemType.Module,
      itemModule: params.moduleType,
      itemInstance: toObjectId(params.instanceId),
      courseModule: params.courseModuleId ? toObjectId(params.courseModuleId) : null,
      name: params.name,
      gradeType: params.gradeType ?? GradeType.Value,
      scale: params.scaleId ? toObjectId(params.scaleId) : null,
      grademax: params.grademax,
      grademin: 0,
      gradepass: params.gradepass ?? null,
      sortOrder: count,
    });
  }

  async updateItem(
    id: string | Types.ObjectId,
    dto: UpdateGradeItemDto,
  ): Promise<GradeItemDocument> {
    const item = await this.findItem(id);
    const { categoryId, scaleId, ...rest } = dto;
    Object.assign(item, rest);
    if (categoryId !== undefined) item.category = categoryId ? toObjectId(categoryId) : null;
    if (scaleId !== undefined) item.scale = scaleId ? toObjectId(scaleId) : null;
    await item.save();
    await this.recalculateCourseTotals(item.course);
    return item;
  }

  async removeItem(id: string | Types.ObjectId): Promise<void> {
    const item = await this.findItem(id);
    if (item.itemType === GradeItemType.Course) {
      throw new BadRequestException('El total del curso no puede eliminarse.');
    }
    await this.gradeModel.deleteMany({ gradeItem: item._id }).exec();
    await item.deleteOne();
    await this.recalculateCourseTotals(item.course);
  }

  async removeItemForModule(moduleType: string, instanceId: string | Types.ObjectId): Promise<void> {
    const item = await this.itemModel
      .findOne({ itemModule: moduleType, itemInstance: toObjectId(instanceId) })
      .exec();
    if (!item) return;
    await this.gradeModel.deleteMany({ gradeItem: item._id }).exec();
    await item.deleteOne();
  }

  /* ----------------------------- Categorías ------------------------------ */

  async categories(courseId: string | Types.ObjectId): Promise<GradeCategoryDocument[]> {
    return this.categoryModel
      .find({ course: toObjectId(courseId) })
      .sort({ depth: 1, sortOrder: 1 })
      .exec();
  }

  async createCategory(
    courseId: string | Types.ObjectId,
    dto: CreateGradeCategoryDto,
  ): Promise<GradeCategoryDocument> {
    const parent = dto.parentId
      ? await this.categoryModel.findById(toObjectId(dto.parentId)).exec()
      : await this.rootCategory(courseId);
    if (!parent) throw new NotFoundException('Categoría padre no encontrada.');

    const category = await this.categoryModel.create({
      course: toObjectId(courseId),
      parent: parent._id,
      name: dto.name,
      aggregation: dto.aggregation ?? GradeAggregation.Natural,
      aggregateOnlyGraded: dto.aggregateOnlyGraded ?? true,
      dropLowest: dto.dropLowest ?? 0,
      keepHighest: dto.keepHighest ?? 0,
      depth: parent.depth + 1,
      path: parent.path,
    });
    category.path = `${parent.path}${category._id.toString()}/`;
    await category.save();
    return category;
  }

  async updateCategory(
    id: string | Types.ObjectId,
    dto: UpdateGradeCategoryDto,
  ): Promise<GradeCategoryDocument> {
    const category = await this.categoryModel.findById(toObjectId(id)).exec();
    if (!category) throw new NotFoundException('Categoría de calificación no encontrada.');
    const { parentId: _parentId, ...rest } = dto;
    Object.assign(category, rest);
    await category.save();
    await this.recalculateCourseTotals(category.course);
    return category;
  }

  async removeCategory(id: string | Types.ObjectId): Promise<void> {
    const category = await this.categoryModel.findById(toObjectId(id)).exec();
    if (!category) return;
    if (!category.parent) throw new BadRequestException('La categoría raíz no puede eliminarse.');
    const root = await this.rootCategory(category.course);
    await this.itemModel
      .updateMany({ category: category._id }, { $set: { category: root._id } })
      .exec();
    await category.deleteOne();
    await this.recalculateCourseTotals(category.course);
  }

  /* --------------------------- Calificaciones ---------------------------- */

  async userGradeForItem(
    gradeItemId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<GradeDocument | null> {
    return this.gradeModel
      .findOne({ gradeItem: toObjectId(gradeItemId), user: toObjectId(userId) })
      .exec();
  }

  async setGrade(
    gradeItemId: string | Types.ObjectId,
    dto: SetGradeDto,
    graderId?: string | Types.ObjectId,
  ): Promise<GradeDocument> {
    const item = await this.findItem(gradeItemId);
    if (item.locked) throw new BadRequestException('El ítem de calificación está bloqueado.');

    if (dto.grade !== null && dto.grade !== undefined) {
      if (dto.grade < item.grademin || dto.grade > item.grademax) {
        throw new BadRequestException(
          `La calificación debe estar entre ${item.grademin} y ${item.grademax}.`,
        );
      }
    }

    const grade = await this.gradeModel
      .findOneAndUpdate(
        { gradeItem: item._id, user: toObjectId(dto.userId) },
        {
          $set: {
            course: item.course,
            rawGrade: dto.grade ?? null,
            finalGrade: dto.grade ?? null,
            feedback: dto.feedback ?? null,
            excluded: dto.excluded ?? false,
            hidden: dto.hidden ?? false,
            overridden: item.itemType === GradeItemType.Module,
            grader: graderId ? toObjectId(graderId) : null,
            gradedAt: dto.grade === null || dto.grade === undefined ? null : new Date(),
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    await this.recalculateUserTotal(item.course, dto.userId);
    return grade;
  }

  /** Registro automático desde una actividad (tarea, cuestionario…). */
  async recordModuleGrade(params: {
    courseId: string | Types.ObjectId;
    moduleType: string;
    instanceId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    grade: number | null;
    feedback?: string | null;
    graderId?: string | Types.ObjectId | null;
  }): Promise<void> {
    const item = await this.itemModel
      .findOne({ itemModule: params.moduleType, itemInstance: toObjectId(params.instanceId) })
      .exec();
    if (!item) return;

    await this.gradeModel
      .findOneAndUpdate(
        { gradeItem: item._id, user: toObjectId(params.userId) },
        {
          $set: {
            course: item.course,
            rawGrade: params.grade,
            finalGrade: params.grade,
            feedback: params.feedback ?? null,
            grader: params.graderId ? toObjectId(params.graderId) : null,
            gradedAt: params.grade === null ? null : new Date(),
          },
        },
        { upsert: true },
      )
      .exec();

    await this.recalculateUserTotal(params.courseId, params.userId);
  }

  /* ------------------------------ Agregación ----------------------------- */

  /**
   * Aplica la estrategia de agregación de la categoría y devuelve la proporción
   * obtenida (0–1), o `null` si no hay calificaciones que agregar.
   * Es lógica pura, por lo que se expone para poder probarla y reutilizarla.
   */
  aggregate(
    values: { value: number; max: number; weight: number }[],
    category: Pick<
      GradeCategoryDocument,
      'aggregation' | 'dropLowest' | 'keepHighest'
    >,
  ): number | null {
    if (!values.length) return null;

    let working = [...values];
    if (category.dropLowest > 0) {
      working.sort((a, b) => a.value / a.max - b.value / b.max);
      working = working.slice(category.dropLowest);
    }
    if (category.keepHighest > 0) {
      working.sort((a, b) => b.value / b.max - a.value / a.max);
      working = working.slice(0, category.keepHighest);
    }
    if (!working.length) return null;

    const ratios = working.map((v) => (v.max > 0 ? v.value / v.max : 0));

    switch (category.aggregation) {
      case GradeAggregation.Mean:
        return ratios.reduce((a, b) => a + b, 0) / ratios.length;

      case GradeAggregation.WeightedMean: {
        const totalWeight = working.reduce((sum, v) => sum + v.weight, 0);
        if (!totalWeight) return null;
        return working.reduce((sum, v, i) => sum + ratios[i] * v.weight, 0) / totalWeight;
      }

      case GradeAggregation.SimpleWeightedMean:
      case GradeAggregation.Natural: {
        const totalMax = working.reduce((sum, v) => sum + v.max, 0);
        if (!totalMax) return null;
        return working.reduce((sum, v) => sum + v.value, 0) / totalMax;
      }

      case GradeAggregation.Median: {
        const sorted = [...ratios].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[middle - 1] + sorted[middle]) / 2
          : sorted[middle];
      }

      case GradeAggregation.Min:
        return Math.min(...ratios);

      case GradeAggregation.Max:
        return Math.max(...ratios);

      case GradeAggregation.Mode: {
        const counts = new Map<number, number>();
        for (const ratio of ratios) counts.set(ratio, (counts.get(ratio) ?? 0) + 1);
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }

      case GradeAggregation.Sum: {
        const totalMax = working.reduce((sum, v) => sum + v.max, 0);
        return totalMax ? working.reduce((sum, v) => sum + v.value, 0) / totalMax : null;
      }

      default:
        return ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }
  }

  /** Recalcula el total del curso para un usuario. */
  async recalculateUserTotal(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<number | null> {
    const [items, root, total] = await Promise.all([
      this.items(courseId),
      this.rootCategory(courseId),
      this.courseTotalItem(courseId),
    ]);

    const gradable = items.filter(
      (item) => item.itemType !== GradeItemType.Course && !item.excludeFromTotal,
    );
    const grades = await this.gradeModel
      .find({
        gradeItem: { $in: gradable.map((i) => i._id) },
        user: toObjectId(userId),
        excluded: false,
      })
      .lean()
      .exec();

    const gradeByItem = new Map(grades.map((g) => [String(g.gradeItem), g]));
    const values = gradable
      .map((item) => {
        const grade = gradeByItem.get(item.id);
        if (grade?.finalGrade === null || grade?.finalGrade === undefined) {
          return root.aggregateOnlyGraded
            ? null
            : { value: 0, max: item.grademax, weight: item.weight };
        }
        return { value: grade.finalGrade, max: item.grademax, weight: item.weight };
      })
      .filter((v): v is { value: number; max: number; weight: number } => v !== null);

    const ratio = this.aggregate(values, root);
    const finalGrade = ratio === null ? null : round(ratio * total.grademax, total.decimals);

    await this.gradeModel
      .findOneAndUpdate(
        { gradeItem: total._id, user: toObjectId(userId) },
        {
          $set: {
            course: toObjectId(courseId),
            rawGrade: finalGrade,
            finalGrade,
            gradedAt: finalGrade === null ? null : new Date(),
          },
        },
        { upsert: true },
      )
      .exec();

    return finalGrade;
  }

  async recalculateCourseTotals(courseId: string | Types.ObjectId): Promise<void> {
    const userIds = await this.gradeModel.distinct('user', { course: toObjectId(courseId) });
    for (const userId of userIds) await this.recalculateUserTotal(courseId, userId);
  }

  /* -------------------------------- Letras ------------------------------- */

  async letters(courseId: string | Types.ObjectId): Promise<GradeLetterDocument[]> {
    const context = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    const letters = await this.letterModel
      .find({ context: context._id })
      .sort({ lowerBoundary: -1 })
      .exec();
    if (letters.length) return letters;
    return this.letterModel.insertMany(
      DEFAULT_LETTERS.map((l) => ({ ...l, context: context._id })),
    ) as unknown as Promise<GradeLetterDocument[]>;
  }

  async setLetters(
    courseId: string | Types.ObjectId,
    letters: { letter: string; lowerBoundary: number }[],
  ): Promise<GradeLetterDocument[]> {
    const context = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    await this.letterModel.deleteMany({ context: context._id }).exec();
    return this.letterModel.insertMany(
      letters.map((l) => ({ ...l, context: context._id })),
    ) as unknown as Promise<GradeLetterDocument[]>;
  }

  private letterFor(percentage: number | null, letters: GradeLetterDocument[]): string | null {
    if (percentage === null) return null;
    const match = letters.find((l) => percentage >= l.lowerBoundary);
    return match?.letter ?? null;
  }

  /* -------------------------------- Escalas ------------------------------ */

  async scales(tenantId: string | Types.ObjectId, courseId?: string): Promise<GradeScaleDocument[]> {
    return this.scaleModel
      .find({
        tenant: toObjectId(tenantId),
        $or: [{ course: null }, ...(courseId ? [{ course: toObjectId(courseId) }] : [])],
      })
      .sort({ name: 1 })
      .exec();
  }

  async createScale(
    tenantId: string | Types.ObjectId,
    dto: CreateScaleDto,
  ): Promise<GradeScaleDocument> {
    if (dto.items.length < 2) {
      throw new BadRequestException('Una escala debe tener al menos dos elementos.');
    }
    return this.scaleModel.create({
      tenant: toObjectId(tenantId),
      name: dto.name,
      items: dto.items,
      description: dto.description ?? null,
      course: dto.courseId ? toObjectId(dto.courseId) : null,
    });
  }

  /* ------------------------------- Informes ------------------------------ */

  /** Informe del calificador: matriz completa de participantes × ítems. */
  async graderReport(
    courseId: string | Types.ObjectId,
    userIds: Types.ObjectId[],
    users: Map<string, { firstName: string; lastName: string; email: string; avatarUrl: string | null }>,
  ): Promise<GraderReport> {
    const [items, letters] = await Promise.all([this.items(courseId), this.letters(courseId)]);
    const grades = await this.gradeModel
      .find({ course: toObjectId(courseId), user: { $in: userIds } })
      .lean()
      .exec();

    const byUser = new Map<string, Map<string, { finalGrade: number | null }>>();
    for (const grade of grades) {
      const key = String(grade.user);
      if (!byUser.has(key)) byUser.set(key, new Map());
      byUser.get(key)!.set(String(grade.gradeItem), { finalGrade: grade.finalGrade });
    }

    const totalItem = items.find((i) => i.itemType === GradeItemType.Course);

    const rows = userIds.map((userId) => {
      const key = String(userId);
      const info = users.get(key);
      const userGrades = byUser.get(key) ?? new Map();
      const cells: GraderReport['rows'][number]['grades'] = {};

      for (const item of items) {
        if (item.itemType === GradeItemType.Course) continue;
        const value = userGrades.get(item.id)?.finalGrade ?? null;
        const percentage = value !== null && item.grademax > 0
          ? round((value / item.grademax) * 100, 1)
          : null;
        cells[item.id] = {
          grade: value,
          percentage,
          letter: this.letterFor(percentage, letters),
        };
      }

      const totalValue = totalItem ? (userGrades.get(totalItem.id)?.finalGrade ?? null) : null;
      const totalPercentage =
        totalValue !== null && totalItem && totalItem.grademax > 0
          ? round((totalValue / totalItem.grademax) * 100, 1)
          : null;

      return {
        user: {
          id: key,
          fullName: info ? fullName(info.firstName, info.lastName) : '—',
          email: info?.email ?? '',
          avatarUrl: info?.avatarUrl ?? null,
        },
        grades: cells,
        courseTotal: {
          grade: totalValue,
          percentage: totalPercentage,
          letter: this.letterFor(totalPercentage, letters),
        },
      };
    });

    return {
      items: items.map((i) => this.itemToDto(i)),
      rows,
      total: rows.length,
    };
  }

  /** Informe de calificaciones de un alumno. */
  async userReport(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    courseName: string,
    includeHidden = false,
  ): Promise<UserGradeReport> {
    const [items, letters] = await Promise.all([this.items(courseId), this.letters(courseId)]);
    const grades = await this.gradeModel
      .find({ course: toObjectId(courseId), user: toObjectId(userId) })
      .lean()
      .exec();
    const byItem = new Map(grades.map((g) => [String(g.gradeItem), g]));

    const visible = items.filter((i) => includeHidden || !i.hidden);
    const totalItem = items.find((i) => i.itemType === GradeItemType.Course);

    const reportItems = visible
      .filter((i) => i.itemType !== GradeItemType.Course)
      .map((item) => {
        const grade = byItem.get(item.id);
        const value = grade?.finalGrade ?? null;
        const percentage =
          value !== null && item.grademax > 0 ? round((value / item.grademax) * 100, 1) : null;
        return {
          ...this.itemToDto(item),
          grade: value,
          percentage,
          letter: this.letterFor(percentage, letters),
          feedback: grade?.feedback ?? null,
          rangeLabel: `${item.grademin}–${item.grademax}`,
          weightLabel: `${round(item.weight * 100, 0)} %`,
        };
      });

    const totalGrade = totalItem ? (byItem.get(totalItem.id)?.finalGrade ?? null) : null;
    const totalPercentage =
      totalGrade !== null && totalItem && totalItem.grademax > 0
        ? round((totalGrade / totalItem.grademax) * 100, 1)
        : null;

    return {
      courseId: String(courseId),
      courseName,
      items: reportItems,
      courseTotal: {
        grade: totalGrade,
        percentage: totalPercentage,
        letter: this.letterFor(totalPercentage, letters),
      },
    };
  }

  /** Exportación CSV del libro de calificaciones. */
  async exportCsv(
    courseId: string | Types.ObjectId,
    userIds: Types.ObjectId[],
    users: Map<string, { firstName: string; lastName: string; email: string; avatarUrl: string | null }>,
  ): Promise<string> {
    const report = await this.graderReport(courseId, userIds, users);
    const header = ['Nombre', 'Correo', ...report.items
      .filter((i) => i.itemType !== GradeItemType.Course)
      .map((i) => i.name), 'Total del curso'];

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [header.map(escape).join(',')];

    for (const row of report.rows) {
      const cells = report.items
        .filter((i) => i.itemType !== GradeItemType.Course)
        .map((item) => String(row.grades[item.id]?.grade ?? ''));
      lines.push(
        [row.user.fullName, row.user.email, ...cells, String(row.courseTotal.grade ?? '')]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }

  private itemToDto(item: GradeItemDocument) {
    return {
      id: item.id,
      courseId: String(item.course),
      categoryId: item.category ? String(item.category) : null,
      itemType: item.itemType,
      itemModule: item.itemModule,
      itemInstance: item.itemInstance ? String(item.itemInstance) : null,
      name: item.name,
      gradeType: item.gradeType,
      scaleId: item.scale ? String(item.scale) : null,
      grademax: item.grademax,
      grademin: item.grademin,
      gradepass: item.gradepass,
      weight: item.weight,
      multiplicator: item.multiplicator,
      offset: item.offset,
      hidden: item.hidden,
      locked: item.locked,
      sortOrder: item.sortOrder,
      decimals: item.decimals,
    };
  }

  /** ¿Ha superado el usuario la nota de aprobado del ítem? */
  async hasPassed(
    gradeItemId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const item = await this.findItem(gradeItemId);
    if (item.gradepass === null) return false;
    const grade = await this.userGradeForItem(gradeItemId, userId);
    return (grade?.finalGrade ?? -1) >= item.gradepass;
  }
}
