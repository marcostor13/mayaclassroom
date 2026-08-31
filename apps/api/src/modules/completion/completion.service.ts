import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CompletionState, CompletionTracking } from '@maya/shared';
import { ModuleCompletion, ModuleCompletionDocument } from './schemas/completion.schema';
import {
  CourseCompletion,
  CourseCompletionDocument,
} from './schemas/course-completion.schema';
import { CourseModule, CourseModuleDocument } from '../courses/schemas/course-module.schema';
import { toObjectId } from '../../common/utils';

export interface CompletionRules {
  /** Requiere que el alumno vea la actividad. */
  view?: boolean;
  /** Requiere una calificación registrada. */
  grade?: boolean;
  /** Requiere alcanzar la nota de aprobado. */
  passGrade?: boolean;
  /** Número mínimo de mensajes en foro. */
  posts?: number;
  /** Requiere haber entregado (tareas). */
  submit?: boolean;
  /** Requiere haber realizado un intento (cuestionarios). */
  attempt?: boolean;
}

/**
 * Seguimiento de finalización, réplica del *completion API* de Moodle:
 * finalización manual, automática por condiciones y agregación a nivel de curso.
 */
@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);

  constructor(
    @InjectModel(ModuleCompletion.name)
    private readonly moduleModel: Model<ModuleCompletionDocument>,
    @InjectModel(CourseCompletion.name)
    private readonly courseModel: Model<CourseCompletionDocument>,
    @InjectModel(CourseModule.name)
    private readonly courseModuleModel: Model<CourseModuleDocument>,
    private readonly events: EventEmitter2,
  ) {}

  async stateFor(
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<CompletionState> {
    const record = await this.moduleModel
      .findOne({ courseModule: toObjectId(moduleId), user: toObjectId(userId) })
      .lean()
      .exec();
    return record?.state ?? CompletionState.Incomplete;
  }

  /** Mapa de estados de finalización de todos los módulos de un curso. */
  async statesForCourse(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<Map<string, CompletionState>> {
    const records = await this.moduleModel
      .find({ course: toObjectId(courseId), user: toObjectId(userId) })
      .lean()
      .exec();
    return new Map(records.map((r) => [String(r.courseModule), r.state]));
  }

  /** Marca (o desmarca) manualmente una actividad. */
  async setManual(
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    completed: boolean,
    byTeacher = false,
  ): Promise<ModuleCompletionDocument> {
    const module = await this.courseModuleModel.findById(toObjectId(moduleId)).exec();
    if (!module) throw new Error('Actividad no encontrada.');

    const record = await this.moduleModel
      .findOneAndUpdate(
        { courseModule: module._id, user: toObjectId(userId) },
        {
          $set: {
            course: module.course,
            state: completed ? CompletionState.Complete : CompletionState.Incomplete,
            completedAt: completed ? new Date() : null,
            overrideByTeacher: byTeacher,
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    await this.recalculateCourse(module.course, userId);
    return record;
  }

  /** Registra una visita y evalúa la condición «ver la actividad». */
  async registerView(
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const module = await this.courseModuleModel.findById(toObjectId(moduleId)).exec();
    if (!module) return;

    const record = await this.moduleModel
      .findOneAndUpdate(
        { courseModule: module._id, user: toObjectId(userId) },
        { $inc: { viewCount: 1 }, $set: { course: module.course } },
        { upsert: true, new: true },
      )
      .exec();

    const rules = module.completionRules as CompletionRules;
    if (
      module.completionTracking === CompletionTracking.Automatic &&
      rules?.view &&
      record.state === CompletionState.Incomplete &&
      !this.hasOtherConditions(rules)
    ) {
      await this.markAutomatic(module, userId, CompletionState.Complete);
    }
  }

  private hasOtherConditions(rules: CompletionRules): boolean {
    return Boolean(rules.grade || rules.passGrade || rules.posts || rules.submit || rules.attempt);
  }

  /**
   * Evalúa las condiciones automáticas tras un evento de la actividad
   * (entrega, intento, mensaje, calificación).
   */
  async evaluate(
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    signals: {
      submitted?: boolean;
      attempted?: boolean;
      graded?: boolean;
      passed?: boolean;
      posts?: number;
    },
  ): Promise<void> {
    const module = await this.courseModuleModel.findById(toObjectId(moduleId)).exec();
    if (!module || module.completionTracking !== CompletionTracking.Automatic) return;

    const rules = (module.completionRules ?? {}) as CompletionRules;
    const record = await this.moduleModel
      .findOne({ courseModule: module._id, user: toObjectId(userId) })
      .exec();

    const checks: boolean[] = [];
    if (rules.view) checks.push((record?.viewCount ?? 0) > 0);
    if (rules.submit) checks.push(Boolean(signals.submitted));
    if (rules.attempt) checks.push(Boolean(signals.attempted));
    if (rules.grade) checks.push(Boolean(signals.graded));
    if (rules.passGrade) checks.push(Boolean(signals.passed));
    if (rules.posts) checks.push((signals.posts ?? 0) >= rules.posts);

    if (!checks.length) return;

    const complete = checks.every(Boolean);
    const state = complete
      ? rules.passGrade
        ? signals.passed
          ? CompletionState.CompletePass
          : CompletionState.CompleteFail
        : CompletionState.Complete
      : CompletionState.Incomplete;

    await this.markAutomatic(module, userId, state);
  }

  private async markAutomatic(
    module: CourseModuleDocument,
    userId: string | Types.ObjectId,
    state: CompletionState,
  ): Promise<void> {
    await this.moduleModel
      .findOneAndUpdate(
        { courseModule: module._id, user: toObjectId(userId) },
        {
          $set: {
            course: module.course,
            state,
            completedAt: state === CompletionState.Incomplete ? null : new Date(),
          },
        },
        { upsert: true },
      )
      .exec();
    await this.recalculateCourse(module.course, userId);
  }

  /** Recalcula el progreso del curso y emite el evento de finalización. */
  async recalculateCourse(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<CourseCompletionDocument> {
    const trackedModules = await this.courseModuleModel
      .find({
        course: toObjectId(courseId),
        completionTracking: { $ne: CompletionTracking.None },
        visible: true,
      })
      .select('_id')
      .lean()
      .exec();

    const total = trackedModules.length;
    const completed = total
      ? await this.moduleModel
          .countDocuments({
            course: toObjectId(courseId),
            user: toObjectId(userId),
            courseModule: { $in: trackedModules.map((m) => m._id) },
            state: { $in: [CompletionState.Complete, CompletionState.CompletePass] },
          })
          .exec()
      : 0;

    const progress = total ? Math.round((completed / total) * 100) : 0;
    const isComplete = total > 0 && completed === total;

    const record = await this.courseModel
      .findOneAndUpdate(
        { course: toObjectId(courseId), user: toObjectId(userId) },
        {
          $set: {
            progress,
            completedModules: completed,
            totalModules: total,
            ...(isComplete ? { completedAt: new Date() } : { completedAt: null }),
          },
        },
        { upsert: true, new: true },
      )
      .exec();

    if (isComplete && !record.notified) {
      record.notified = true;
      await record.save();
      this.events.emit('course.completed', {
        courseId: String(courseId),
        userId: String(userId),
      });
    }

    return record;
  }

  async courseProgress(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<CourseCompletionDocument> {
    const existing = await this.courseModel
      .findOne({ course: toObjectId(courseId), user: toObjectId(userId) })
      .exec();
    return existing ?? this.recalculateCourse(courseId, userId);
  }

  /** Informe de finalización de todos los participantes. */
  async courseReport(courseId: string | Types.ObjectId) {
    return this.courseModel
      .find({ course: toObjectId(courseId) })
      .populate('user', 'firstName lastName email avatarUrl')
      .sort({ progress: -1 })
      .exec();
  }

  async moduleReport(moduleId: string | Types.ObjectId) {
    return this.moduleModel
      .find({ courseModule: toObjectId(moduleId) })
      .populate('user', 'firstName lastName email avatarUrl')
      .exec();
  }
}
