import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FeedbackDto, ModuleType } from '@maya/shared';
import {
  Feedback,
  FeedbackDocument,
  FeedbackResponse,
  FeedbackResponseDocument,
} from './schemas/feedback.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { CompletionService } from '../../completion/completion.service';
import { CoursesService } from '../../courses/courses.service';
import { toObjectId } from '../../../common/utils';

interface FeedbackSettings {
  intro?: string;
  anonymous?: boolean;
  multipleSubmit?: boolean;
  timeOpen?: string;
  timeClose?: string;
  items?: {
    type: 'textfield' | 'textarea' | 'multichoice' | 'numeric' | 'info' | 'label';
    label: string;
    required?: boolean;
    options?: string[];
  }[];
}

@Injectable()
export class FeedbackService implements ActivityHandler, OnModuleInit {
  readonly type = ModuleType.Feedback;
  readonly label = 'Encuesta';
  readonly icon = 'clipboard-list';
  readonly gradable = false;
  readonly description =
    'Cuestionario de opinión con preguntas propias. Sirve para recoger la ' +
    'valoración del curso o sondear al grupo, sin nota.';
  readonly tags = ['Anónima opcional', 'Preguntas propias'];

  constructor(
    @InjectModel(Feedback.name) private readonly model: Model<FeedbackDocument>,
    @InjectModel(FeedbackResponse.name)
    private readonly responseModel: Model<FeedbackResponseDocument>,
    private readonly registry: ActivityRegistry,
    private readonly completion: CompletionService,
    private readonly courses: CoursesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    const settings = input.settings as FeedbackSettings;
    const feedback = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      anonymous: settings.anonymous ?? true,
      multipleSubmit: settings.multipleSubmit ?? false,
      timeOpen: settings.timeOpen ? new Date(settings.timeOpen) : null,
      timeClose: settings.timeClose ? new Date(settings.timeClose) : null,
      items: (settings.items ?? []).map((item, index) => ({
        ...item,
        required: item.required ?? false,
        options: item.options ?? [],
        position: index,
      })),
      createdBy: input.userId,
    });
    return { id: feedback._id, gradeMax: null };
  }

  async update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const feedback = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as FeedbackSettings;
    if (input.name) feedback.name = input.name;
    if (settings.intro !== undefined) feedback.intro = settings.intro ?? null;
    if (settings.anonymous !== undefined) feedback.anonymous = settings.anonymous;
    if (settings.multipleSubmit !== undefined) feedback.multipleSubmit = settings.multipleSubmit;
    if (settings.timeOpen !== undefined) {
      feedback.timeOpen = settings.timeOpen ? new Date(settings.timeOpen) : null;
    }
    if (settings.timeClose !== undefined) {
      feedback.timeClose = settings.timeClose ? new Date(settings.timeClose) : null;
    }
    if (settings.items) {
      feedback.items = settings.items.map((item, index) => ({
        ...item,
        required: item.required ?? false,
        options: item.options ?? [],
        position: index,
      }));
    }
    await feedback.save();
    return { id: feedback._id, gradeMax: null };
  }

  async remove(instanceId: Types.ObjectId): Promise<void> {
    await this.responseModel.deleteMany({ feedback: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async get(instanceId: Types.ObjectId): Promise<FeedbackDto> {
    return this.toDto(await this.findById(instanceId));
  }

  async duplicate(
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
    return copy._id;
  }

  async findById(id: string | Types.ObjectId): Promise<FeedbackDocument> {
    const feedback = await this.model.findById(toObjectId(id)).exec();
    if (!feedback) throw new NotFoundException('Encuesta no encontrada.');
    return feedback;
  }

  async toDto(feedback: FeedbackDocument): Promise<FeedbackDto> {
    const responseCount = await this.responseModel
      .countDocuments({ feedback: feedback._id })
      .exec();
    return {
      id: feedback.id,
      courseId: String(feedback.course),
      name: feedback.name,
      intro: feedback.intro,
      anonymous: feedback.anonymous,
      multipleSubmit: feedback.multipleSubmit,
      timeOpen: feedback.timeOpen?.toISOString() ?? null,
      timeClose: feedback.timeClose?.toISOString() ?? null,
      items: feedback.items
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          id: String(item['_id' as never]),
          type: item.type,
          label: item.label,
          required: item.required,
          position: item.position,
          options: item.options,
        })),
      responseCount,
    };
  }

  async submit(
    feedbackId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    answers: Record<string, unknown>,
  ): Promise<{ submitted: true }> {
    const feedback = await this.findById(feedbackId);
    const now = new Date();

    if (feedback.timeOpen && now < feedback.timeOpen) {
      throw new ForbiddenException('La encuesta aún no está abierta.');
    }
    if (feedback.timeClose && now > feedback.timeClose) {
      throw new ForbiddenException('La encuesta ya está cerrada.');
    }

    for (const item of feedback.items) {
      const id = String(item['_id' as never]);
      if (item.required && (answers[id] === undefined || answers[id] === '')) {
        throw new ForbiddenException(`La pregunta «${item.label}» es obligatoria.`);
      }
    }

    const existing = await this.responseModel
      .findOne({ feedback: feedback._id, user: toObjectId(userId) })
      .exec();
    if (existing && !feedback.multipleSubmit) {
      existing.answers = answers;
      await existing.save();
    } else {
      await this.responseModel.create({
        feedback: feedback._id,
        user: feedback.anonymous ? null : toObjectId(userId),
        answers,
      });
    }

    const module = await this.courses.findModuleByInstance(ModuleType.Feedback, feedback._id);
    if (module) await this.completion.evaluate(module._id, userId, { submitted: true });

    return { submitted: true };
  }

  /** Resumen agregado de respuestas para el informe. */
  async analysis(feedbackId: string | Types.ObjectId) {
    const feedback = await this.findById(feedbackId);
    const responses = await this.responseModel.find({ feedback: feedback._id }).lean().exec();

    return feedback.items
      .filter((item) => item.type !== 'info' && item.type !== 'label')
      .map((item) => {
        const id = String(item['_id' as never]);
        const values = responses
          .map((r) => r.answers[id])
          .filter((v) => v !== undefined && v !== null && v !== '');

        if (item.type === 'multichoice') {
          const counts = new Map<string, number>();
          for (const value of values) {
            const key = String(value);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          return {
            itemId: id,
            label: item.label,
            type: item.type,
            total: values.length,
            distribution: item.options.map((option) => ({
              option,
              count: counts.get(option) ?? 0,
            })),
          };
        }

        if (item.type === 'numeric') {
          const numbers = values.map(Number).filter(Number.isFinite);
          const average = numbers.length
            ? numbers.reduce((a, b) => a + b, 0) / numbers.length
            : null;
          return {
            itemId: id,
            label: item.label,
            type: item.type,
            total: numbers.length,
            average,
            min: numbers.length ? Math.min(...numbers) : null,
            max: numbers.length ? Math.max(...numbers) : null,
          };
        }

        return {
          itemId: id,
          label: item.label,
          type: item.type,
          total: values.length,
          answers: values.map(String).slice(0, 200),
        };
      });
  }

  async hasResponded(
    feedbackId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.responseModel
      .countDocuments({ feedback: toObjectId(feedbackId), user: toObjectId(userId) })
      .exec();
    return count > 0;
  }
}
