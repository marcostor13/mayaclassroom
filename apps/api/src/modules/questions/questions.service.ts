import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ContextLevel, QuestionDto, QuestionType } from '@maya/shared';
import { Question, QuestionDocument } from './schemas/question.schema';
import {
  QuestionCategory,
  QuestionCategoryDocument,
} from './schemas/question-category.schema';
import { ContextsService } from '../contexts/contexts.service';
import { PaginatedResult } from '../../common/dto';
import { searchRegex, toObjectId } from '../../common/utils';
import {
  CreateQuestionCategoryDto,
  CreateQuestionDto,
  ImportQuestionsDto,
  QuestionQueryDto,
  UpdateQuestionDto,
} from './dto/question.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name) private readonly model: Model<QuestionDocument>,
    @InjectModel(QuestionCategory.name)
    private readonly categoryModel: Model<QuestionCategoryDocument>,
    private readonly contexts: ContextsService,
  ) {}

  /* ----------------------------- Categorías ------------------------------ */

  async categories(
    tenantId: string | Types.ObjectId,
    contextId?: string,
  ): Promise<QuestionCategoryDocument[]> {
    const filter: FilterQuery<QuestionCategoryDocument> = { tenant: toObjectId(tenantId) };
    if (contextId) filter.context = toObjectId(contextId);
    return this.categoryModel.find(filter).sort({ sortOrder: 1, name: 1 }).exec();
  }

  async createCategory(
    tenantId: string | Types.ObjectId,
    dto: CreateQuestionCategoryDto,
  ): Promise<QuestionCategoryDocument> {
    return this.categoryModel.create({
      tenant: toObjectId(tenantId),
      name: dto.name,
      description: dto.description ?? null,
      parent: dto.parentId ? toObjectId(dto.parentId) : null,
      context: toObjectId(dto.contextId),
    });
  }

  /** Categoría por defecto de un curso; se crea si no existe. */
  async defaultCategoryForCourse(
    tenantId: string | Types.ObjectId,
    courseId: string | Types.ObjectId,
  ): Promise<QuestionCategoryDocument> {
    const context = await this.contexts.requireByInstance(ContextLevel.Course, courseId);
    const existing = await this.categoryModel
      .findOne({ tenant: toObjectId(tenantId), context: context._id, parent: null })
      .exec();
    if (existing) return existing;
    return this.categoryModel.create({
      tenant: toObjectId(tenantId),
      name: 'Preguntas del curso',
      context: context._id,
      parent: null,
    });
  }

  /**
   * Categoría raíz de la empresa, creándola si aún no existe. Sin ella una
   * empresa recién creada no tendría dónde guardar su primera pregunta: las
   * categorías de curso sólo nacen al abrir el banco desde un curso.
   */
  async defaultCategoryForTenant(
    tenantId: string | Types.ObjectId,
  ): Promise<QuestionCategoryDocument> {
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, tenantId);
    const existing = await this.categoryModel
      .findOne({ tenant: toObjectId(tenantId), context: context._id, parent: null })
      .exec();
    if (existing) return existing;
    return this.categoryModel.create({
      tenant: toObjectId(tenantId),
      name: 'Banco general',
      description: 'Preguntas compartidas por todos los cursos de la empresa.',
      context: context._id,
      parent: null,
    });
  }

  /* ------------------------------ Preguntas ------------------------------ */

  async paginate(
    tenantId: string | Types.ObjectId,
    query: QuestionQueryDto,
  ): Promise<PaginatedResult<QuestionDocument>> {
    const filter: FilterQuery<QuestionDocument> = { tenant: toObjectId(tenantId) };
    if (query.categoryId) filter.category = toObjectId(query.categoryId);
    if (query.courseId) filter.course = toObjectId(query.courseId);
    if (query.type) filter.type = query.type;
    if (query.tag) filter.tags = query.tag;
    if (query.search) {
      filter.$or = [{ name: searchRegex(query.search) }, { questionText: searchRegex(query.search) }];
    }

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  async findById(id: string | Types.ObjectId): Promise<QuestionDocument> {
    const question = await this.model.findById(toObjectId(id)).exec();
    if (!question) throw new NotFoundException('Pregunta no encontrada.');
    return question;
  }

  async findManyByIds(ids: (string | Types.ObjectId)[]): Promise<QuestionDocument[]> {
    return this.model.find({ _id: { $in: ids.map(toObjectId) } }).exec();
  }

  async create(
    tenantId: string | Types.ObjectId,
    dto: CreateQuestionDto,
  ): Promise<QuestionDocument> {
    this.validate(dto);
    return this.model.create({
      tenant: toObjectId(tenantId),
      category: toObjectId(dto.categoryId),
      course: dto.courseId ? toObjectId(dto.courseId) : null,
      type: dto.type,
      name: dto.name,
      questionText: dto.questionText,
      generalFeedback: dto.generalFeedback ?? null,
      defaultMark: dto.defaultMark ?? 1,
      penalty: dto.penalty ?? 0,
      shuffleAnswers: dto.shuffleAnswers ?? true,
      single: dto.single ?? true,
      answers: dto.answers ?? [],
      subquestions: dto.subquestions ?? [],
      tolerance: dto.tolerance ?? 0,
      tags: dto.tags ?? [],
    });
  }

  private validate(dto: CreateQuestionDto | UpdateQuestionDto): void {
    const type = dto.type;
    if (!type) return;

    switch (type) {
      case QuestionType.MultiChoice: {
        if (!dto.answers?.length || dto.answers.length < 2) {
          throw new BadRequestException('Una pregunta de opción múltiple necesita al menos dos respuestas.');
        }
        if (!dto.answers.some((a) => a.fraction > 0)) {
          throw new BadRequestException('Debe marcar al menos una respuesta correcta.');
        }
        break;
      }
      case QuestionType.TrueFalse: {
        if (!dto.answers || dto.answers.length !== 2) {
          throw new BadRequestException('Una pregunta de verdadero/falso necesita exactamente dos respuestas.');
        }
        break;
      }
      case QuestionType.Matching: {
        if (!dto.subquestions?.length) {
          throw new BadRequestException('Una pregunta de emparejamiento necesita pares pregunta/respuesta.');
        }
        break;
      }
      case QuestionType.ShortAnswer:
      case QuestionType.Numerical: {
        if (!dto.answers?.length) {
          throw new BadRequestException('Debe definir al menos una respuesta aceptada.');
        }
        break;
      }
      default:
        break;
    }
  }

  async update(id: string | Types.ObjectId, dto: UpdateQuestionDto): Promise<QuestionDocument> {
    const question = await this.findById(id);
    this.validate({ ...question.toObject(), ...dto } as CreateQuestionDto);
    const { categoryId, courseId, ...rest } = dto;
    Object.assign(question, rest);
    if (categoryId) question.category = toObjectId(categoryId);
    if (courseId !== undefined) question.course = courseId ? toObjectId(courseId) : null;
    await question.save();
    return question;
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }

  async duplicate(id: string | Types.ObjectId): Promise<QuestionDocument> {
    const source = await this.findById(id);
    const copy = source.toObject() as unknown as Record<string, unknown>;
    delete (copy as Record<string, unknown>)._id;
    return this.model.create({ ...copy, name: `${source.name} (copia)`, usageCount: 0 });
  }

  /* --------------------------- Corrección -------------------------------- */

  /**
   * Corrige una respuesta y devuelve la fracción obtenida (0–1) y si requiere
   * corrección manual (ensayos).
   */
  gradeAnswer(
    question: QuestionDocument,
    answer: unknown,
  ): { fraction: number; needsManual: boolean; correct: boolean } {
    switch (question.type) {
      case QuestionType.MultiChoice: {
        if (question.single) {
          const selected = question.answers.find((a) => String(a['_id' as never]) === String(answer));
          const fraction = Math.max(selected?.fraction ?? 0, 0);
          return { fraction, needsManual: false, correct: fraction >= 1 };
        }
        const selectedIds = Array.isArray(answer) ? answer.map(String) : [];
        const fraction = question.answers
          .filter((a) => selectedIds.includes(String(a['_id' as never])))
          .reduce((sum, a) => sum + a.fraction, 0);
        const clamped = Math.min(Math.max(fraction, 0), 1);
        return { fraction: clamped, needsManual: false, correct: clamped >= 1 };
      }

      case QuestionType.TrueFalse: {
        const selected = question.answers.find((a) => String(a['_id' as never]) === String(answer));
        const fraction = Math.max(selected?.fraction ?? 0, 0);
        return { fraction, needsManual: false, correct: fraction >= 1 };
      }

      case QuestionType.ShortAnswer: {
        const text = String(answer ?? '').trim().toLowerCase();
        const match = question.answers.find(
          (a) => a.text.trim().toLowerCase() === text && a.fraction > 0,
        );
        return {
          fraction: match?.fraction ?? 0,
          needsManual: false,
          correct: (match?.fraction ?? 0) >= 1,
        };
      }

      case QuestionType.Numerical: {
        const value = Number(answer);
        if (!Number.isFinite(value)) return { fraction: 0, needsManual: false, correct: false };
        const match = question.answers.find((a) => {
          const expected = Number(a.text);
          return (
            Number.isFinite(expected) &&
            Math.abs(expected - value) <= (question.tolerance || 0) &&
            a.fraction > 0
          );
        });
        return {
          fraction: match?.fraction ?? 0,
          needsManual: false,
          correct: (match?.fraction ?? 0) >= 1,
        };
      }

      case QuestionType.Matching: {
        const provided = (answer ?? {}) as Record<string, string>;
        const total = question.subquestions.length;
        if (!total) return { fraction: 0, needsManual: false, correct: false };
        const correct = question.subquestions.filter(
          (sub, index) =>
            String(provided[String(index)] ?? '').trim().toLowerCase() ===
            sub.answer.trim().toLowerCase(),
        ).length;
        const fraction = correct / total;
        return { fraction, needsManual: false, correct: fraction >= 1 };
      }

      case QuestionType.Ordering: {
        const provided = Array.isArray(answer) ? answer.map(String) : [];
        const expected = question.answers.map((a) => String(a['_id' as never]));
        const correct = expected.every((id, index) => provided[index] === id);
        return { fraction: correct ? 1 : 0, needsManual: false, correct };
      }

      case QuestionType.Essay:
        return { fraction: 0, needsManual: true, correct: false };

      case QuestionType.Description:
        return { fraction: 0, needsManual: false, correct: true };

      default:
        return { fraction: 0, needsManual: true, correct: false };
    }
  }

  /* -------------------------- Importación GIFT --------------------------- */

  /**
   * Importación en formato GIFT (subconjunto habitual) o JSON nativo.
   * GIFT: `::Nombre:: Texto {=Correcta ~Incorrecta}`
   */
  async import(
    tenantId: string | Types.ObjectId,
    dto: ImportQuestionsDto,
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    if (dto.format === 'json') {
      // Un JSON mal formado es un error de quien importa, no del servidor:
      // sin este control `JSON.parse` sube como 500.
      let parsed: CreateQuestionDto[];
      try {
        parsed = JSON.parse(dto.content) as CreateQuestionDto[];
      } catch (error) {
        throw new BadRequestException(`El JSON no es válido: ${(error as Error).message}`);
      }
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('El JSON debe ser una lista de preguntas.');
      }
      for (const item of parsed) {
        try {
          await this.create(tenantId, { ...item, categoryId: dto.categoryId });
          imported += 1;
        } catch (error) {
          errors.push(`${item.name}: ${(error as Error).message}`);
        }
      }
      return { imported, errors };
    }

    const blocks = dto.content
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter((b) => b && !b.startsWith('//'));

    for (const block of blocks) {
      try {
        const parsed = this.parseGift(block);
        await this.create(tenantId, { ...parsed, categoryId: dto.categoryId });
        imported += 1;
      } catch (error) {
        errors.push(`${block.slice(0, 40)}…: ${(error as Error).message}`);
      }
    }
    return { imported, errors };
  }

  /**
   * Analiza un bloque en formato GIFT. Se expone para poder probar el
   * analizador de forma aislada.
   */
  parseGift(block: string): CreateQuestionDto {
    const nameMatch = /^::(.+?)::/.exec(block);
    const name = nameMatch ? nameMatch[1] : block.slice(0, 40);
    const rest = nameMatch ? block.slice(nameMatch[0].length) : block;

    const braceIndex = rest.indexOf('{');
    if (braceIndex === -1) throw new Error('Formato GIFT no reconocido: falta el bloque de respuestas.');

    const questionText = rest.slice(0, braceIndex).trim();
    const body = rest.slice(braceIndex + 1, rest.lastIndexOf('}')).trim();

    if (body === '' ) {
      return { type: QuestionType.Essay, name, questionText, categoryId: '', answers: [] };
    }

    if (/^(TRUE|FALSE|T|F)$/i.test(body)) {
      const isTrue = /^(TRUE|T)$/i.test(body);
      return {
        type: QuestionType.TrueFalse,
        name,
        questionText,
        categoryId: '',
        answers: [
          { text: 'Verdadero', fraction: isTrue ? 1 : 0 },
          { text: 'Falso', fraction: isTrue ? 0 : 1 },
        ],
      };
    }

    const answers = body
      .split(/(?=[=~])/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const correct = part.startsWith('=');
        const text = part.slice(1).split('#')[0].trim();
        const feedback = part.includes('#') ? part.split('#')[1].trim() : undefined;
        return { text, fraction: correct ? 1 : 0, feedback };
      });

    const hasIncorrect = answers.some((a) => a.fraction === 0);
    return {
      type: hasIncorrect ? QuestionType.MultiChoice : QuestionType.ShortAnswer,
      name,
      questionText,
      categoryId: '',
      answers,
    };
  }

  toDto(question: QuestionDocument): QuestionDto {
    return {
      id: question.id,
      categoryId: String(question.category),
      courseId: question.course ? String(question.course) : null,
      type: question.type,
      name: question.name,
      questionText: question.questionText,
      generalFeedback: question.generalFeedback,
      defaultMark: question.defaultMark,
      penalty: question.penalty,
      shuffleAnswers: question.shuffleAnswers,
      single: question.single,
      answers: question.answers.map((a) => ({
        id: String(a['_id' as never]),
        text: a.text,
        fraction: a.fraction,
        feedback: a.feedback,
      })),
      subquestions: question.subquestions.map((s) => ({ text: s.text, answer: s.answer })),
      tolerance: question.tolerance,
      tags: question.tags,
    };
  }

  /** Versión para el alumno: sin fracciones ni retroalimentación. */
  toStudentDto(question: QuestionDocument, shuffle = false): QuestionDto {
    const dto = this.toDto(question);
    const answers = dto.answers.map((a) => ({ ...a, fraction: 0, feedback: null }));
    if (shuffle && question.shuffleAnswers) {
      for (let i = answers.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
      }
    }
    return {
      ...dto,
      answers,
      generalFeedback: null,
      subquestions: dto.subquestions?.map((s) => ({ text: s.text, answer: '' })),
    };
  }
}
