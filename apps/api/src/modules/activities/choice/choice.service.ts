import { ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChoiceDto, ModuleType } from '@maya/shared';
import {
  Choice,
  ChoiceAnswer,
  ChoiceAnswerDocument,
  ChoiceDocument,
} from './schemas/choice.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { CompletionService } from '../../completion/completion.service';
import { CoursesService } from '../../courses/courses.service';
import { toObjectId } from '../../../common/utils';

interface ChoiceSettings {
  intro?: string;
  options?: { text: string; maxAnswers?: number }[];
  allowMultiple?: boolean;
  allowUpdate?: boolean;
  limitAnswers?: boolean;
  showResults?: 'always' | 'afteranswer' | 'afterclose' | 'never';
  publishAnonymous?: boolean;
  timeOpen?: string;
  timeClose?: string;
}

@Injectable()
export class ChoiceService implements ActivityHandler, OnModuleInit {
  readonly type = ModuleType.Choice;
  readonly label = 'Consulta';
  readonly icon = 'list-checks';
  readonly gradable = false;
  readonly description =
    'Una sola pregunta con opciones para que el grupo elija: turno de ' +
    'exposición, tema del trabajo o un sondeo rápido.';
  readonly tags = ['Una pregunta', 'Resultado en vivo'];

  constructor(
    @InjectModel(Choice.name) private readonly model: Model<ChoiceDocument>,
    @InjectModel(ChoiceAnswer.name) private readonly answerModel: Model<ChoiceAnswerDocument>,
    private readonly registry: ActivityRegistry,
    private readonly completion: CompletionService,
    private readonly courses: CoursesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    const settings = input.settings as ChoiceSettings;
    const choice = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      options: (settings.options ?? []).map((o) => ({ text: o.text, maxAnswers: o.maxAnswers ?? 0 })),
      allowMultiple: settings.allowMultiple ?? false,
      allowUpdate: settings.allowUpdate ?? true,
      limitAnswers: settings.limitAnswers ?? false,
      showResults: settings.showResults ?? 'afteranswer',
      publishAnonymous: settings.publishAnonymous ?? false,
      timeOpen: settings.timeOpen ? new Date(settings.timeOpen) : null,
      timeClose: settings.timeClose ? new Date(settings.timeClose) : null,
      createdBy: input.userId,
    });
    return { id: choice._id, gradeMax: null };
  }

  async update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const choice = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as ChoiceSettings;
    if (input.name) choice.name = input.name;
    if (settings.intro !== undefined) choice.intro = settings.intro ?? null;
    if (settings.options) {
      choice.options = settings.options.map((o) => ({ text: o.text, maxAnswers: o.maxAnswers ?? 0 }));
    }
    if (settings.allowMultiple !== undefined) choice.allowMultiple = settings.allowMultiple;
    if (settings.allowUpdate !== undefined) choice.allowUpdate = settings.allowUpdate;
    if (settings.limitAnswers !== undefined) choice.limitAnswers = settings.limitAnswers;
    if (settings.showResults) choice.showResults = settings.showResults;
    if (settings.publishAnonymous !== undefined) choice.publishAnonymous = settings.publishAnonymous;
    if (settings.timeOpen !== undefined) {
      choice.timeOpen = settings.timeOpen ? new Date(settings.timeOpen) : null;
    }
    if (settings.timeClose !== undefined) {
      choice.timeClose = settings.timeClose ? new Date(settings.timeClose) : null;
    }
    await choice.save();
    return { id: choice._id, gradeMax: null };
  }

  async remove(instanceId: Types.ObjectId): Promise<void> {
    await this.answerModel.deleteMany({ choice: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async get(instanceId: Types.ObjectId): Promise<ChoiceDto> {
    return this.toDto(await this.findById(instanceId), true);
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

  async findById(id: string | Types.ObjectId): Promise<ChoiceDocument> {
    const choice = await this.model.findById(toObjectId(id)).exec();
    if (!choice) throw new NotFoundException('Consulta no encontrada.');
    return choice;
  }

  async toDto(choice: ChoiceDocument, withCounts = false): Promise<ChoiceDto> {
    const counts = withCounts ? await this.optionCounts(choice._id) : new Map<string, number>();
    return {
      id: choice.id,
      courseId: String(choice.course),
      name: choice.name,
      intro: choice.intro,
      allowMultiple: choice.allowMultiple,
      allowUpdate: choice.allowUpdate,
      limitAnswers: choice.limitAnswers,
      showResults: choice.showResults,
      publishAnonymous: choice.publishAnonymous,
      timeOpen: choice.timeOpen?.toISOString() ?? null,
      timeClose: choice.timeClose?.toISOString() ?? null,
      options: choice.options.map((option) => {
        const id = String(option['_id' as never]);
        return {
          id,
          text: option.text,
          maxAnswers: option.maxAnswers,
          count: withCounts ? (counts.get(id) ?? 0) : undefined,
        };
      }),
    };
  }

  private async optionCounts(choiceId: Types.ObjectId): Promise<Map<string, number>> {
    const answers = await this.answerModel.find({ choice: choiceId }).lean().exec();
    const counts = new Map<string, number>();
    for (const answer of answers) {
      for (const optionId of answer.optionIds) {
        counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
      }
    }
    return counts;
  }

  async answer(
    choiceId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    optionIds: string[],
  ): Promise<ChoiceDto> {
    const choice = await this.findById(choiceId);
    const now = new Date();

    if (choice.timeOpen && now < choice.timeOpen) {
      throw new ForbiddenException('La consulta aún no está abierta.');
    }
    if (choice.timeClose && now > choice.timeClose) {
      throw new ForbiddenException('La consulta ya está cerrada.');
    }
    if (!choice.allowMultiple && optionIds.length > 1) {
      throw new ForbiddenException('Solo puede seleccionar una opción.');
    }

    const existing = await this.answerModel
      .findOne({ choice: choice._id, user: toObjectId(userId) })
      .exec();
    if (existing && !choice.allowUpdate) {
      throw new ForbiddenException('No se permite modificar la respuesta.');
    }

    if (choice.limitAnswers) {
      const counts = await this.optionCounts(choice._id);
      for (const optionId of optionIds) {
        const option = choice.options.find((o) => String(o['_id' as never]) === optionId);
        const already = existing?.optionIds.includes(optionId) ?? false;
        if (option?.maxAnswers && !already && (counts.get(optionId) ?? 0) >= option.maxAnswers) {
          throw new ForbiddenException(`La opción «${option.text}» ya está completa.`);
        }
      }
    }

    await this.answerModel
      .findOneAndUpdate(
        { choice: choice._id, user: toObjectId(userId) },
        { $set: { optionIds } },
        { upsert: true },
      )
      .exec();

    const module = await this.courses.findModuleByInstance(ModuleType.Choice, choice._id);
    if (module) await this.completion.evaluate(module._id, userId, { submitted: true });

    return this.toDto(choice, true);
  }

  async myAnswer(
    choiceId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<string[]> {
    const answer = await this.answerModel
      .findOne({ choice: toObjectId(choiceId), user: toObjectId(userId) })
      .lean()
      .exec();
    return answer?.optionIds ?? [];
  }

  async responses(choiceId: string | Types.ObjectId) {
    return this.answerModel
      .find({ choice: toObjectId(choiceId) })
      .populate('user', 'firstName lastName email avatarUrl')
      .exec();
  }
}
