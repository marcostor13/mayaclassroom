import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SurveyDto,
  SurveyQuestionResult,
  SurveyQuestionType,
  SurveyResultsDto,
  SurveyStatus,
  SurveyTrigger,
  round,
} from '@maya/shared';
import {
  Survey,
  SurveyDocument,
  SurveyParticipation,
  SurveyParticipationDocument,
  SurveyResponse,
  SurveyResponseDocument,
} from './schemas/survey.schema';
import { CreateSurveyDto, SubmitSurveyDto, UpdateSurveyDto } from './dto/survey.dto';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { CompletionService } from '../completion/completion.service';
import { toObjectId } from '../../common/utils';

/**
 * Encuestas de curso, anónimas.
 *
 * El anonimato no es una casilla: está en cómo se guardan los datos. La
 * respuesta va a una colección sin campo de autor, y quién ha respondido va a
 * otra sin referencia a ninguna respuesta. Ni siquiera con acceso a la base de
 * datos se pueden emparejar, que es la única garantía que vale cuando lo que se
 * pide es opinar del profesorado con franqueza.
 */
@Injectable()
export class SurveysService {
  constructor(
    @InjectModel(Survey.name) private readonly model: Model<SurveyDocument>,
    @InjectModel(SurveyResponse.name)
    private readonly responseModel: Model<SurveyResponseDocument>,
    @InjectModel(SurveyParticipation.name)
    private readonly participationModel: Model<SurveyParticipationDocument>,
    private readonly enrolments: EnrolmentsService,
    private readonly completion: CompletionService,
  ) {}

  /* ------------------------------- Gestión ------------------------------- */

  async create(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
    dto: CreateSurveyDto,
    userId: string | Types.ObjectId,
  ): Promise<SurveyDto> {
    const survey = await this.model.create({
      tenant: toObjectId(tenantId),
      course: toObjectId(courseId),
      title: dto.title,
      description: dto.description ?? null,
      trigger: dto.trigger ?? SurveyTrigger.OnCompletion,
      anonymous: dto.anonymous ?? true,
      questions: (dto.questions ?? []).map((question, index) => ({
        ...question,
        help: question.help ?? null,
        required: question.required ?? false,
        options: question.options ?? [],
        scaleMax: question.scaleMax ?? (question.type === SurveyQuestionType.Scale ? 5 : null),
        scaleMinLabel: question.scaleMinLabel ?? null,
        scaleMaxLabel: question.scaleMaxLabel ?? null,
        position: index,
      })),
      opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
      closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
      createdBy: toObjectId(userId),
    });
    return this.toDto(survey);
  }

  async update(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    dto: UpdateSurveyDto,
  ): Promise<SurveyDto> {
    const survey = await this.require(tenantId, id);

    // Cambiar las preguntas de una encuesta ya respondida dejaría los datos
    // recogidos hablando de otras preguntas: se puede corregir el enunciado,
    // pero no rehacer el cuestionario.
    if (dto.questions && survey.responseCount > 0) {
      throw new BadRequestException(
        'La encuesta ya tiene respuestas: no se pueden cambiar sus preguntas. Cree una nueva.',
      );
    }

    if (dto.title !== undefined) survey.title = dto.title;
    if (dto.description !== undefined) survey.description = dto.description ?? null;
    if (dto.trigger !== undefined) survey.trigger = dto.trigger;
    if (dto.anonymous !== undefined) survey.anonymous = dto.anonymous;
    if (dto.opensAt !== undefined) survey.opensAt = dto.opensAt ? new Date(dto.opensAt) : null;
    if (dto.closesAt !== undefined) survey.closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    if (dto.questions) {
      survey.questions = dto.questions.map((question, index) => ({
        ...question,
        help: question.help ?? null,
        required: question.required ?? false,
        options: question.options ?? [],
        scaleMax: question.scaleMax ?? (question.type === SurveyQuestionType.Scale ? 5 : null),
        scaleMinLabel: question.scaleMinLabel ?? null,
        scaleMaxLabel: question.scaleMaxLabel ?? null,
        position: index,
      })) as SurveyDocument['questions'];
    }

    await survey.save();
    return this.toDto(survey);
  }

  async setStatus(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    status: SurveyStatus,
  ): Promise<SurveyDto> {
    const survey = await this.require(tenantId, id);
    if (status === SurveyStatus.Published && !survey.questions.length) {
      throw new BadRequestException('Una encuesta sin preguntas no se puede publicar.');
    }
    survey.status = status;
    await survey.save();
    return this.toDto(survey);
  }

  async remove(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
  ): Promise<void> {
    const survey = await this.require(tenantId, id);
    // Se borran también las respuestas: son suyas y no sirven sin sus preguntas.
    await this.responseModel.deleteMany({ survey: survey._id }).exec();
    await this.participationModel.deleteMany({ survey: survey._id }).exec();
    await survey.deleteOne();
  }

  /* ------------------------------ Consultas ------------------------------ */

  async require(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
  ): Promise<SurveyDocument> {
    const survey = await this.model
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId) })
      .exec();
    if (!survey) throw new NotFoundException('Encuesta no encontrada.');
    return survey;
  }

  /** Encuestas de un curso, tal como las ve quien las gestiona. */
  async forCourse(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
  ): Promise<SurveyDto[]> {
    const surveys = await this.model
      .find({ tenant: toObjectId(tenantId), course: toObjectId(courseId) })
      .sort({ createdAt: -1 })
      .exec();
    return surveys.map((survey) => this.toDto(survey));
  }

  /**
   * Encuestas que le tocan a un alumno en un curso.
   *
   * Una encuesta de fin de curso no aparece hasta que el curso está terminado:
   * enseñarla antes sería pedir una opinión sobre algo a medio hacer, y además
   * llenaría la pantalla de avisos que no se pueden atender todavía.
   */
  async forStudent(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<SurveyDto[]> {
    const surveys = await this.model
      .find({
        tenant: toObjectId(tenantId),
        course: toObjectId(courseId),
        status: SurveyStatus.Published,
      })
      .sort({ createdAt: -1 })
      .exec();
    if (!surveys.length) return [];

    const [progress, answered] = await Promise.all([
      this.completion.courseProgress(courseId, userId),
      this.participationModel
        .find({ survey: { $in: surveys.map((s) => s._id) }, user: toObjectId(userId) })
        .select('survey')
        .lean()
        .exec(),
    ]);
    const respondidas = new Set(answered.map((item) => String(item.survey)));

    const now = new Date();
    return surveys.map((survey) => {
      const dto = this.toDto(survey);
      const { available, info } = this.availability(survey, now, progress.progress);
      return {
        ...dto,
        answered: respondidas.has(survey.id),
        available,
        availabilityInfo: info,
      };
    });
  }

  /** Por qué se puede responder ahora una encuesta, o por qué no. */
  private availability(
    survey: SurveyDocument,
    now: Date,
    progress: number,
  ): { available: boolean; info: string | null } {
    if (survey.opensAt && now < survey.opensAt) {
      return { available: false, info: 'Todavía no está abierta.' };
    }
    if (survey.closesAt && now > survey.closesAt) {
      return { available: false, info: 'El plazo para responderla ha terminado.' };
    }
    if (survey.trigger === SurveyTrigger.OnCompletion && progress < 100) {
      return {
        available: false,
        info: 'Se podrá responder al terminar el curso.',
      };
    }
    return { available: true, info: null };
  }

  /* ------------------------------ Respuesta ------------------------------ */

  async submit(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SubmitSurveyDto,
  ): Promise<{ submitted: true }> {
    const survey = await this.require(tenantId, id);
    if (survey.status !== SurveyStatus.Published) {
      throw new ForbiddenException('Esta encuesta no está abierta.');
    }

    const enrolled = await this.enrolments.isEnrolled(survey.course, userId);
    if (!enrolled) {
      throw new ForbiddenException('Solo responde la encuesta quien está matriculado en el curso.');
    }

    const progress = await this.completion.courseProgress(survey.course, userId);
    const { available, info } = this.availability(survey, new Date(), progress.progress);
    if (!available) throw new ForbiddenException(info ?? 'La encuesta no está disponible.');

    // La participación se escribe **antes** que la respuesta y con índice único:
    // si dos envíos llegan a la vez, el segundo choca aquí y no llega a guardar
    // una respuesta duplicada que ya no se podría distinguir ni retirar.
    try {
      await this.participationModel.create({
        tenant: toObjectId(tenantId),
        survey: survey._id,
        user: toObjectId(userId),
      });
    } catch {
      throw new ForbiddenException('Ya ha respondido esta encuesta.');
    }

    const answers = this.sanitize(survey, dto.answers ?? {});

    await this.responseModel.create({
      tenant: toObjectId(tenantId),
      survey: survey._id,
      answers,
      submittedAt: new Date(),
    });

    await this.model.updateOne({ _id: survey._id }, { $inc: { responseCount: 1 } }).exec();
    return { submitted: true };
  }

  /**
   * Limpia las respuestas contra las preguntas de la encuesta.
   *
   * Descarta lo que no corresponde a ninguna pregunta —un cliente manipulado
   * podría mandar campos de más— y comprueba lo obligatorio. Cada tipo se
   * convierte a la forma en que se va a agregar, para que el informe no tenga
   * que adivinar si un «4» es número o cadena.
   */
  private sanitize(survey: SurveyDocument, answers: Record<string, unknown>): Record<string, unknown> {
    const limpio: Record<string, unknown> = {};

    for (const question of survey.questions) {
      const id = String(question['_id' as never]);
      const value = answers[id];
      const vacio = value === undefined || value === null || value === '';

      if (vacio) {
        if (question.required) {
          throw new BadRequestException(`Falta responder: «${question.text}».`);
        }
        continue;
      }

      switch (question.type) {
        case SurveyQuestionType.Scale: {
          const numero = Number(value);
          const tope = question.scaleMax ?? 5;
          if (!Number.isFinite(numero) || numero < 1 || numero > tope) {
            throw new BadRequestException(`Valor fuera de escala en «${question.text}».`);
          }
          limpio[id] = Math.round(numero);
          break;
        }
        case SurveyQuestionType.Boolean:
          limpio[id] = value === true || value === 'true' || value === 'si';
          break;
        case SurveyQuestionType.Single: {
          const texto = String(value);
          if (question.options.length && !question.options.includes(texto)) {
            throw new BadRequestException(`Opción no válida en «${question.text}».`);
          }
          limpio[id] = texto;
          break;
        }
        case SurveyQuestionType.Multiple: {
          const lista = (Array.isArray(value) ? value : [value]).map(String);
          limpio[id] = question.options.length
            ? lista.filter((item) => question.options.includes(item))
            : lista;
          break;
        }
        default:
          // Se recorta para que una respuesta larguísima no reviente el informe.
          limpio[id] = String(value).slice(0, 4000);
      }
    }

    return limpio;
  }

  async hasAnswered(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.participationModel
      .countDocuments({ survey: toObjectId(id), user: toObjectId(userId) })
      .exec();
    return count > 0;
  }

  /* ------------------------------ Resultados ----------------------------- */

  /**
   * Agregado de una encuesta.
   *
   * Nunca devuelve respuestas emparejadas entre sí: cada pregunta se resume por
   * su cuenta. Aunque no hay autores guardados, un volcado fila a fila con
   * todas las preguntas juntas permitiría reconocer a alguien por la
   * combinación de sus respuestas en un grupo pequeño.
   */
  async results(
    tenantId: string | Types.ObjectId,
    id: string | Types.ObjectId,
  ): Promise<SurveyResultsDto> {
    const survey = await this.require(tenantId, id);
    const responses = await this.responseModel.find({ survey: survey._id }).lean().exec();
    const invited = (await this.enrolments.activeUserIds(survey.course)).length;

    const questions: SurveyQuestionResult[] = survey.questions
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((question) => {
        const qid = String(question['_id' as never]);
        const valores = responses
          .map((response) => response.answers[qid])
          .filter((value) => value !== undefined && value !== null && value !== '');

        const base: SurveyQuestionResult = {
          questionId: qid,
          text: question.text,
          type: question.type,
          answered: valores.length,
          distribution: [],
          average: null,
          texts: [],
        };

        switch (question.type) {
          case SurveyQuestionType.Scale: {
            const numeros = valores.map(Number).filter(Number.isFinite);
            base.average = numeros.length
              ? round(numeros.reduce((a, b) => a + b, 0) / numeros.length, 2)
              : null;
            const tope = question.scaleMax ?? 5;
            base.distribution = Array.from({ length: tope }, (_, index) => {
              const punto = index + 1;
              const count = numeros.filter((n) => n === punto).length;
              return {
                label: String(punto),
                count,
                percent: numeros.length ? round((count / numeros.length) * 100, 1) : 0,
              };
            });
            break;
          }
          case SurveyQuestionType.Boolean: {
            const si = valores.filter((value) => value === true).length;
            const no = valores.length - si;
            base.distribution = [
              { label: 'Sí', count: si, percent: pct(si, valores.length) },
              { label: 'No', count: no, percent: pct(no, valores.length) },
            ];
            break;
          }
          case SurveyQuestionType.Single:
          case SurveyQuestionType.Multiple: {
            const recuento = new Map<string, number>();
            for (const value of valores) {
              for (const item of Array.isArray(value) ? value : [value]) {
                const label = String(item);
                recuento.set(label, (recuento.get(label) ?? 0) + 1);
              }
            }
            const etiquetas = question.options.length
              ? question.options
              : [...recuento.keys()].sort();
            base.distribution = etiquetas.map((label) => ({
              label,
              count: recuento.get(label) ?? 0,
              percent: pct(recuento.get(label) ?? 0, valores.length),
            }));
            break;
          }
          default:
            base.texts = valores.map(String);
        }

        return base;
      });

    return {
      survey: this.toDto(survey),
      responseCount: responses.length,
      invited,
      participation: invited ? round((responses.length / invited) * 100, 1) : 0,
      questions,
    };
  }

  /* ---------------------------- Serialización ---------------------------- */

  toDto(survey: SurveyDocument): SurveyDto {
    return {
      id: survey.id,
      courseId: String(survey.course),
      title: survey.title,
      description: survey.description,
      status: survey.status,
      trigger: survey.trigger,
      anonymous: survey.anonymous,
      questions: survey.questions
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((question) => ({
          id: String(question['_id' as never]),
          type: question.type,
          text: question.text,
          help: question.help,
          required: question.required,
          options: question.options,
          scaleMax: question.scaleMax,
          scaleMinLabel: question.scaleMinLabel,
          scaleMaxLabel: question.scaleMaxLabel,
        })),
      opensAt: survey.opensAt?.toISOString() ?? null,
      closesAt: survey.closesAt?.toISOString() ?? null,
      responseCount: survey.responseCount,
    };
  }
}

const pct = (part: number, total: number): number =>
  total ? round((part / total) * 100, 1) : 0;
