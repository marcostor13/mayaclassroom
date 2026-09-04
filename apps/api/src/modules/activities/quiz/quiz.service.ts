import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CompletionTracking,
  ModuleType,
  QuizAttemptDto,
  QuizAttemptState,
  QuizDto,
  QuizGradeMethod,
  QuizGradingItem,
  QuizGradingQueue,
  round,
} from '@maya/shared';
import { Quiz, QuizDocument } from './schemas/quiz.schema';
import { QuizAttempt, QuizAttemptDocument } from './schemas/quiz-attempt.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { QuestionsService } from '../../questions/questions.service';
import { GradesService } from '../../grades/grades.service';
import { CompletionService } from '../../completion/completion.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CoursesService } from '../../courses/courses.service';
import { toObjectId } from '../../../common/utils';
import {
  BulkGradeDto,
  ManualGradeDto,
  QuizSettingsDto,
  SaveResponseDto,
} from './dto/quiz.dto';

@Injectable()
export class QuizService implements ActivityHandler, OnModuleInit {
  readonly type = ModuleType.Quiz;
  readonly label = 'Cuestionario';
  readonly icon = 'help-circle';
  readonly gradable = true;

  constructor(
    @InjectModel(Quiz.name) private readonly model: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name) private readonly attemptModel: Model<QuizAttemptDocument>,
    private readonly registry: ActivityRegistry,
    private readonly questions: QuestionsService,
    private readonly grades: GradesService,
    private readonly completion: CompletionService,
    private readonly notifications: NotificationsService,
    private readonly courses: CoursesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  /* --------------------------- ActivityHandler --------------------------- */

  async create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    const settings = input.settings as QuizSettingsDto;
    const quiz = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      timeOpen: settings.timeOpen ? new Date(settings.timeOpen) : null,
      timeClose: settings.timeClose ? new Date(settings.timeClose) : null,
      timeLimitSeconds: settings.timeLimitSeconds ?? 0,
      attemptsAllowed: settings.attemptsAllowed ?? 1,
      gradeMethod: settings.gradeMethod ?? QuizGradeMethod.Highest,
      maxGrade: settings.maxGrade ?? 10,
      passingGrade: settings.passingGrade ?? null,
      shuffleQuestions: settings.shuffleQuestions ?? false,
      shuffleAnswers: settings.shuffleAnswers ?? true,
      questionsPerPage: settings.questionsPerPage ?? 1,
      navMethod: settings.navMethod ?? 'free',
      reviewAfterClose: settings.reviewAfterClose ?? true,
      showCorrectAnswers: settings.showCorrectAnswers ?? true,
      requirePassword: settings.requirePassword ?? false,
      password: settings.password ?? null,
      requiredToPass: settings.requiredToPass ?? false,
      blocksProgress: settings.blocksProgress ?? false,
      slots: [],
      createdBy: input.userId,
    });
    await this.applyRequiredPolicy(quiz);
    return { id: quiz._id, gradeMax: quiz.maxGrade };
  }

  async update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const quiz = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as QuizSettingsDto;
    if (input.name) quiz.name = input.name;
    if (settings.intro !== undefined) quiz.intro = settings.intro ?? null;
    if (settings.timeOpen !== undefined) {
      quiz.timeOpen = settings.timeOpen ? new Date(settings.timeOpen) : null;
    }
    if (settings.timeClose !== undefined) {
      quiz.timeClose = settings.timeClose ? new Date(settings.timeClose) : null;
    }
    const plain: (keyof QuizSettingsDto)[] = [
      'timeLimitSeconds',
      'attemptsAllowed',
      'gradeMethod',
      'maxGrade',
      'passingGrade',
      'shuffleQuestions',
      'shuffleAnswers',
      'questionsPerPage',
      'navMethod',
      'reviewAfterClose',
      'showCorrectAnswers',
      'requirePassword',
      'password',
      'requiredToPass',
      'blocksProgress',
    ];
    for (const key of plain) {
      if (settings[key] !== undefined) {
        (quiz as unknown as Record<string, unknown>)[key] = settings[key];
      }
    }
    await quiz.save();
    await this.applyRequiredPolicy(quiz);
    return { id: quiz._id, gradeMax: quiz.maxGrade };
  }

  async remove(instanceId: Types.ObjectId): Promise<void> {
    await this.attemptModel.deleteMany({ quiz: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async get(instanceId: Types.ObjectId): Promise<QuizDto> {
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

  async exportInstance(instanceId: Types.ObjectId): Promise<Record<string, unknown>> {
    return (await this.findById(instanceId)).toObject() as unknown as Record<string, unknown>;
  }

  /* ------------------------------ Consultas ------------------------------ */

  async findById(id: string | Types.ObjectId): Promise<QuizDocument> {
    const quiz = await this.model.findById(toObjectId(id)).exec();
    if (!quiz) throw new NotFoundException('Cuestionario no encontrado.');
    return quiz;
  }

  async toDto(quiz: QuizDocument, includeQuestions = false): Promise<QuizDto> {
    const questions = includeQuestions
      ? await this.questions.findManyByIds(quiz.slots.map((s) => s.question))
      : [];
    const byId = new Map(questions.map((q) => [q.id, q]));

    return {
      id: quiz.id,
      courseId: String(quiz.course),
      name: quiz.name,
      intro: quiz.intro,
      timeOpen: quiz.timeOpen?.toISOString() ?? null,
      timeClose: quiz.timeClose?.toISOString() ?? null,
      timeLimitSeconds: quiz.timeLimitSeconds,
      attemptsAllowed: quiz.attemptsAllowed,
      gradeMethod: quiz.gradeMethod,
      maxGrade: quiz.maxGrade,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleAnswers: quiz.shuffleAnswers,
      questionsPerPage: quiz.questionsPerPage,
      navMethod: quiz.navMethod,
      reviewAfterClose: quiz.reviewAfterClose,
      showCorrectAnswers: quiz.showCorrectAnswers,
      passingGrade: quiz.passingGrade,
      requiredToPass: quiz.requiredToPass,
      blocksProgress: quiz.blocksProgress,
      attemptsAllowedLabel:
        quiz.attemptsAllowed === 0
          ? 'Intentos ilimitados'
          : quiz.attemptsAllowed === 1
            ? 'Un solo intento'
            : `${quiz.attemptsAllowed} intentos`,
      questions: quiz.slots
        .sort((a, b) => a.slot - b.slot)
        .map((slot) => ({
          questionId: String(slot.question),
          slot: slot.slot,
          page: slot.page,
          maxMark: slot.maxMark,
          question: includeQuestions
            ? (() => {
                const q = byId.get(String(slot.question));
                return q ? this.questions.toDto(q) : undefined;
              })()
            : undefined,
        })),
      totalMarks: quiz.slots.reduce((sum, s) => sum + s.maxMark, 0),
    };
  }

  /* ------------------------ Examen obligatorio --------------------------- */

  /**
   * Traslada «este examen es obligatorio» al resto del sistema.
   *
   * Un ajuste marcado en la pantalla del examen no sirve de nada si el libro de
   * notas y el seguimiento de finalización no se enteran: sin nota de aprobado
   * en el ítem, la nota final no sabría distinguir aprobado de suspenso, y sin
   * la regla de finalización la actividad se daría por hecha con solo entregarla.
   * Por eso los tres se ajustan juntos aquí y no a mano en cada pantalla.
   */
  private async applyRequiredPolicy(quiz: QuizDocument): Promise<void> {
    // Un examen obligatorio sin nota de corte no se puede aprobar ni suspender:
    // se le pone la mitad, que es el corte por omisión más habitual, y quien
    // configura el examen puede cambiarlo.
    if (quiz.requiredToPass && quiz.passingGrade === null) {
      quiz.passingGrade = round(quiz.maxGrade / 2, 2);
      await quiz.save();
    }

    const module = await this.courses.findModuleByInstance(ModuleType.Quiz, quiz._id);
    if (!module) return;

    await this.grades.syncModuleItem({
      courseId: quiz.course,
      moduleType: ModuleType.Quiz,
      instanceId: quiz._id,
      courseModuleId: module._id,
      name: quiz.name,
      grademax: quiz.maxGrade,
      gradepass: quiz.passingGrade,
    });

    const rules = { ...((module.completionRules ?? {}) as Record<string, unknown>) };
    if (quiz.requiredToPass) {
      // Aprobar, no solo intentar: es lo que significa «obligatorio».
      rules.passGrade = true;
      rules.attempt = true;
      module.completionTracking = CompletionTracking.Automatic;
    } else {
      delete rules.passGrade;
    }
    module.completionRules = rules;
    module.gradeMax = quiz.maxGrade;
    await module.save();
  }

  /** Exámenes obligatorios de un curso, con su ítem de calificación. */
  async requiredQuizzes(courseId: string | Types.ObjectId): Promise<QuizDocument[]> {
    return this.model
      .find({ course: toObjectId(courseId), requiredToPass: true })
      .exec();
  }

  /* ---------------------------- Composición ------------------------------ */

  async addQuestions(
    quizId: string | Types.ObjectId,
    questionIds: string[],
    maxMark?: number,
  ): Promise<QuizDto> {
    const quiz = await this.findById(quizId);
    const questions = await this.questions.findManyByIds(questionIds);
    let slot = quiz.slots.length;

    for (const question of questions) {
      if (quiz.slots.some((s) => String(s.question) === question.id)) continue;
      slot += 1;
      quiz.slots.push({
        question: question._id,
        slot,
        page: quiz.questionsPerPage > 0 ? Math.ceil(slot / quiz.questionsPerPage) : 1,
        maxMark: maxMark ?? question.defaultMark,
      });
    }
    await quiz.save();
    return this.toDto(quiz);
  }

  async removeQuestion(
    quizId: string | Types.ObjectId,
    questionId: string,
  ): Promise<QuizDto> {
    const quiz = await this.findById(quizId);
    quiz.slots = quiz.slots
      .filter((s) => String(s.question) !== questionId)
      .map((s, index) => ({ ...s, slot: index + 1 }));
    await quiz.save();
    return this.toDto(quiz);
  }

  async reorderQuestions(
    quizId: string | Types.ObjectId,
    orderedQuestionIds: string[],
  ): Promise<QuizDto> {
    const quiz = await this.findById(quizId);
    quiz.slots = orderedQuestionIds
      .map((id, index) => {
        const slot = quiz.slots.find((s) => String(s.question) === id);
        if (!slot) return null;
        return {
          ...slot,
          slot: index + 1,
          page: quiz.questionsPerPage > 0 ? Math.ceil((index + 1) / quiz.questionsPerPage) : 1,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    await quiz.save();
    return this.toDto(quiz);
  }

  async setQuestionMark(
    quizId: string | Types.ObjectId,
    questionId: string,
    maxMark: number,
  ): Promise<QuizDto> {
    const quiz = await this.findById(quizId);
    const slot = quiz.slots.find((s) => String(s.question) === questionId);
    if (!slot) throw new NotFoundException('La pregunta no pertenece a este cuestionario.');
    slot.maxMark = maxMark;
    await quiz.save();
    return this.toDto(quiz);
  }

  /* ------------------------------- Intentos ------------------------------ */

  async startAttempt(
    quizId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    password?: string,
  ): Promise<QuizAttemptDto> {
    const quiz = await this.findById(quizId);
    const now = new Date();

    if (quiz.timeOpen && now < quiz.timeOpen) {
      throw new ForbiddenException('El cuestionario aún no está disponible.');
    }
    if (quiz.timeClose && now > quiz.timeClose) {
      throw new ForbiddenException('El cuestionario ya está cerrado.');
    }
    if (quiz.requirePassword && quiz.password !== password) {
      throw new ForbiddenException('La contraseña del cuestionario no es correcta.');
    }
    if (!quiz.slots.length) {
      throw new BadRequestException('El cuestionario todavía no tiene preguntas.');
    }

    const inProgress = await this.attemptModel
      .findOne({
        quiz: quiz._id,
        user: toObjectId(userId),
        state: QuizAttemptState.InProgress,
      })
      .exec();
    if (inProgress) return this.attemptToDto(inProgress);

    const previous = await this.attemptModel
      .countDocuments({ quiz: quiz._id, user: toObjectId(userId) })
      .exec();
    if (quiz.attemptsAllowed > 0 && previous >= quiz.attemptsAllowed) {
      throw new ForbiddenException('Ha agotado el número de intentos permitidos.');
    }

    const order = quiz.slots.sort((a, b) => a.slot - b.slot).map((s) => String(s.question));
    if (quiz.shuffleQuestions) {
      for (let i = order.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    const dueAt =
      quiz.timeLimitSeconds > 0
        ? new Date(Date.now() + quiz.timeLimitSeconds * 1000)
        : quiz.timeClose;

    const attempt = await this.attemptModel.create({
      quiz: quiz._id,
      user: toObjectId(userId),
      attempt: previous + 1,
      state: QuizAttemptState.InProgress,
      startedAt: now,
      dueAt,
      layout: order,
      responses: quiz.slots.map((slot) => ({
        question: slot.question,
        answer: null,
        maxMark: slot.maxMark,
      })),
    });

    const module = await this.courses.findModuleByInstance(ModuleType.Quiz, quiz._id);
    if (module) await this.completion.evaluate(module._id, userId, { attempted: true });

    return this.attemptToDto(attempt);
  }

  async saveResponse(
    attemptId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SaveResponseDto,
  ): Promise<{ saved: true }> {
    const attempt = await this.requireOwnAttempt(attemptId, userId);
    if (attempt.state !== QuizAttemptState.InProgress) {
      throw new ForbiddenException('El intento ya está finalizado.');
    }
    if (attempt.dueAt && new Date() > attempt.dueAt) {
      await this.finishAttempt(attemptId, userId, true);
      throw new ForbiddenException('El tiempo del intento ha finalizado.');
    }

    const response = attempt.responses.find((r) => String(r.question) === dto.questionId);
    if (!response) throw new NotFoundException('La pregunta no pertenece a este intento.');

    response.answer = dto.answer ?? null;
    if (dto.flagged !== undefined) response.flagged = dto.flagged;
    attempt.markModified('responses');
    await attempt.save();
    return { saved: true };
  }

  async finishAttempt(
    attemptId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    timedOut = false,
  ): Promise<QuizAttemptDto> {
    const attempt = await this.requireOwnAttempt(attemptId, userId);
    if (attempt.state === QuizAttemptState.Finished) return this.attemptToDto(attempt);

    const quiz = await this.findById(attempt.quiz);
    const questions = await this.questions.findManyByIds(
      attempt.responses.map((r) => r.question),
    );
    const byId = new Map(questions.map((q) => [q.id, q]));

    let sum = 0;
    let needsManual = false;

    for (const response of attempt.responses) {
      const question = byId.get(String(response.question));
      if (!question) continue;
      const result = this.questions.gradeAnswer(question, response.answer);
      response.mark = round(result.fraction * response.maxMark, 2);
      response.correct = result.needsManual ? null : result.correct;
      response.needsManualGrading = result.needsManual;
      response.feedback = quiz.showCorrectAnswers ? question.generalFeedback : null;
      if (result.needsManual) needsManual = true;
      sum += response.mark ?? 0;
    }

    const totalMarks = attempt.responses.reduce((total, r) => total + r.maxMark, 0);
    attempt.sumGrades = round(sum, 2);
    attempt.grade = totalMarks > 0 ? round((sum / totalMarks) * quiz.maxGrade, 2) : 0;
    attempt.state = QuizAttemptState.Finished;
    attempt.finishedAt = new Date();
    attempt.markModified('responses');
    await attempt.save();

    if (!needsManual) await this.syncGrade(quiz, userId);

    const module = await this.courses.findModuleByInstance(ModuleType.Quiz, quiz._id);
    if (module) {
      await this.completion.evaluate(module._id, userId, {
        attempted: true,
        graded: !needsManual,
        passed:
          quiz.passingGrade !== null ? (attempt.grade ?? 0) >= quiz.passingGrade : undefined,
      });
    }

    if (!needsManual) {
      await this.notifications.notify({
        tenantId: quiz.tenant,
        userIds: [toObjectId(userId)],
        component: 'mod/quiz',
        eventName: 'quiz_graded',
        subject: `Resultado de «${quiz.name}»`,
        body: `Ha obtenido ${attempt.grade} sobre ${quiz.maxGrade}${timedOut ? ' (intento finalizado por tiempo)' : ''}.`,
        contextUrl: module ? `/mod/quiz/${module.id}` : undefined,
      });
    }

    return this.attemptToDto(attempt);
  }

  /** Aplica el método de calificación configurado y lo lleva al libro de notas. */
  private async syncGrade(quiz: QuizDocument, userId: string | Types.ObjectId): Promise<void> {
    const attempts = await this.attemptModel
      .find({
        quiz: quiz._id,
        user: toObjectId(userId),
        state: QuizAttemptState.Finished,
      })
      .sort({ attempt: 1 })
      .exec();

    const grades = attempts.map((a) => a.grade ?? 0);
    if (!grades.length) return;

    let finalGrade: number;
    switch (quiz.gradeMethod) {
      case QuizGradeMethod.Average:
        finalGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
        break;
      case QuizGradeMethod.First:
        finalGrade = grades[0];
        break;
      case QuizGradeMethod.Last:
        finalGrade = grades[grades.length - 1];
        break;
      default:
        finalGrade = Math.max(...grades);
    }

    await this.grades.recordModuleGrade({
      courseId: quiz.course,
      moduleType: ModuleType.Quiz,
      instanceId: quiz._id,
      userId,
      grade: round(finalGrade, 2),
    });
  }

  async manualGrade(
    attemptId: string | Types.ObjectId,
    dto: ManualGradeDto,
  ): Promise<QuizAttemptDto> {
    const attempt = await this.attemptModel.findById(toObjectId(attemptId)).exec();
    if (!attempt) throw new NotFoundException('Intento no encontrado.');

    const response = attempt.responses.find((r) => String(r.question) === dto.questionId);
    if (!response) throw new NotFoundException('La pregunta no pertenece a este intento.');
    if (dto.mark < 0 || dto.mark > response.maxMark) {
      throw new BadRequestException(`La puntuación debe estar entre 0 y ${response.maxMark}.`);
    }

    response.mark = round(dto.mark, 2);
    response.feedback = dto.feedback ?? null;
    response.needsManualGrading = false;
    response.correct = dto.mark >= response.maxMark;

    const quiz = await this.findById(attempt.quiz);
    await this.recalculateAttempt(attempt, quiz);
    await this.afterGrading(attempt, quiz);
    return this.attemptToDto(attempt);
  }

  /**
   * Cola de corrección de un examen.
   *
   * Devuelve una fila por *respuesta* y no por intento: quien corrige treinta
   * ensayos de la misma pregunta lo hace de un tirón, comparando unos con
   * otros, y así puede ordenarlos por pregunta en la pantalla. `blockedAttempts`
   * cuenta los intentos que todavía no tienen nota final porque les falta
   * evaluar algo.
   */
  async gradingQueue(
    quizId: string | Types.ObjectId,
    users: Map<string, { firstName: string; lastName: string; email: string; avatarUrl: string | null }>,
  ): Promise<QuizGradingQueue> {
    const quiz = await this.findById(quizId);
    const module = await this.courses.findModuleByInstance(ModuleType.Quiz, quiz._id);
    const attempts = await this.attemptModel
      .find({ quiz: quiz._id, state: QuizAttemptState.Finished })
      .sort({ finishedAt: 1 })
      .exec();

    const questionIds = new Set<string>();
    for (const attempt of attempts) {
      for (const response of attempt.responses) questionIds.add(String(response.question));
    }
    const questions = await this.questions.findManyByIds([...questionIds]);
    const byId = new Map(questions.map((q) => [q.id, q]));

    const pending: QuizGradingItem[] = [];
    const graded: QuizGradingItem[] = [];
    let blocked = 0;

    for (const attempt of attempts) {
      const user = users.get(String(attempt.user));
      const student = {
        id: String(attempt.user),
        fullName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Alumno',
        email: user?.email ?? '',
        avatarUrl: user?.avatarUrl ?? null,
      };
      if (attempt.responses.some((r) => r.needsManualGrading)) blocked += 1;

      for (const response of attempt.responses) {
        const question = byId.get(String(response.question));
        // Solo las que pide una persona: el resto ya tiene nota automática y
        // llenar la cola con ellas escondería lo que de verdad falta.
        if (!question || !this.questions.needsManualGrading(question)) continue;

        const item: QuizGradingItem = {
          attemptId: attempt.id,
          moduleId: module ? module.id : '',
          quizId: quiz.id,
          quizName: quiz.name,
          courseId: String(quiz.course),
          attempt: attempt.attempt,
          finishedAt: attempt.finishedAt?.toISOString() ?? null,
          student,
          questionId: question.id,
          questionName: question.name,
          questionText: question.questionText,
          questionType: question.type,
          answer: response.answer,
          maxMark: response.maxMark,
          mark: response.mark,
          feedback: response.feedback,
          rubric: question.rubric,
        };
        if (response.needsManualGrading) pending.push(item);
        else graded.push(item);
      }
    }

    return { pending, graded, blockedAttempts: blocked };
  }

  /**
   * Guarda una tanda de correcciones.
   *
   * Se agrupan por intento para recalcular la nota una sola vez por alumno:
   * hacerlo respuesta a respuesta escribiría en el libro de notas tantas veces
   * como preguntas tenga el examen.
   */
  async bulkGrade(dto: BulkGradeDto): Promise<{ graded: number }> {
    const byAttempt = new Map<string, BulkGradeDto['grades']>();
    for (const grade of dto.grades) {
      if (!byAttempt.has(grade.attemptId)) byAttempt.set(grade.attemptId, []);
      byAttempt.get(grade.attemptId)!.push(grade);
    }

    let count = 0;
    for (const [attemptId, grades] of byAttempt) {
      const attempt = await this.attemptModel.findById(toObjectId(attemptId)).exec();
      if (!attempt) continue;
      const quiz = await this.findById(attempt.quiz);

      for (const grade of grades) {
        const response = attempt.responses.find((r) => String(r.question) === grade.questionId);
        if (!response) continue;
        if (grade.mark < 0 || grade.mark > response.maxMark) {
          throw new BadRequestException(
            `La puntuación debe estar entre 0 y ${response.maxMark}.`,
          );
        }
        response.mark = round(grade.mark, 2);
        response.feedback = grade.feedback ?? null;
        response.needsManualGrading = false;
        response.correct = grade.mark >= response.maxMark;
        count += 1;
      }

      await this.recalculateAttempt(attempt, quiz);
      await this.afterGrading(attempt, quiz);
    }
    return { graded: count };
  }

  /** Recalcula la nota del intento a partir de las puntuaciones actuales. */
  private async recalculateAttempt(
    attempt: QuizAttemptDocument,
    quiz: QuizDocument,
  ): Promise<void> {
    const sum = attempt.responses.reduce((total, r) => total + (r.mark ?? 0), 0);
    const totalMarks = attempt.responses.reduce((total, r) => total + r.maxMark, 0);
    attempt.sumGrades = round(sum, 2);
    attempt.grade = totalMarks > 0 ? round((sum / totalMarks) * quiz.maxGrade, 2) : 0;
    attempt.markModified('responses');
    await attempt.save();
  }

  /**
   * Cierra el círculo tras corregir: nota al libro, finalización y aviso.
   *
   * Solo cuando ya no queda nada por evaluar; con una pregunta pendiente, la
   * nota que se publicaría sería falsa y el alumno la vería antes de tiempo.
   */
  private async afterGrading(
    attempt: QuizAttemptDocument,
    quiz: QuizDocument,
  ): Promise<void> {
    if (attempt.responses.some((r) => r.needsManualGrading)) return;

    await this.syncGrade(quiz, attempt.user);

    const module = await this.courses.findModuleByInstance(ModuleType.Quiz, quiz._id);
    if (module) {
      await this.completion.evaluate(module._id, attempt.user, {
        attempted: true,
        graded: true,
        passed:
          quiz.passingGrade !== null ? (attempt.grade ?? 0) >= quiz.passingGrade : undefined,
      });
    }

    await this.notifications.notify({
      tenantId: quiz.tenant,
      userIds: [attempt.user],
      component: 'mod/quiz',
      eventName: 'quiz_graded',
      subject: `Resultado de «${quiz.name}»`,
      body: `Su examen ya está corregido: ${attempt.grade} sobre ${quiz.maxGrade}.`,
      contextUrl: module ? `/mod/quiz/${module.id}` : undefined,
    });
  }

  /** Cuántos intentos esperan corrección, para avisar en la pantalla del examen. */
  async pendingManualGrading(quizId: string | Types.ObjectId): Promise<number> {
    return this.attemptModel
      .countDocuments({
        quiz: toObjectId(quizId),
        state: QuizAttemptState.Finished,
        'responses.needsManualGrading': true,
      })
      .exec();
  }

  async attemptsOfUser(
    quizId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<QuizAttemptDto[]> {
    const attempts = await this.attemptModel
      .find({ quiz: toObjectId(quizId), user: toObjectId(userId) })
      .sort({ attempt: 1 })
      .exec();
    return attempts.map((a) => this.attemptToDto(a));
  }

  async allAttempts(quizId: string | Types.ObjectId) {
    return this.attemptModel
      .find({ quiz: toObjectId(quizId) })
      .populate('user', 'firstName lastName email avatarUrl')
      .sort({ startedAt: -1 })
      .exec();
  }

  /** Estadísticas por pregunta para el informe del profesorado. */
  async statistics(quizId: string | Types.ObjectId) {
    const attempts = await this.attemptModel
      .find({ quiz: toObjectId(quizId), state: QuizAttemptState.Finished })
      .lean()
      .exec();

    const perQuestion = new Map<string, { correct: number; total: number; marks: number[] }>();
    for (const attempt of attempts) {
      for (const response of attempt.responses) {
        const key = String(response.question);
        const entry = perQuestion.get(key) ?? { correct: 0, total: 0, marks: [] };
        entry.total += 1;
        if (response.correct) entry.correct += 1;
        entry.marks.push(response.mark ?? 0);
        perQuestion.set(key, entry);
      }
    }

    const grades = attempts.map((a) => a.grade ?? 0);
    return {
      attempts: attempts.length,
      averageGrade: grades.length ? round(grades.reduce((a, b) => a + b, 0) / grades.length, 2) : null,
      highestGrade: grades.length ? Math.max(...grades) : null,
      lowestGrade: grades.length ? Math.min(...grades) : null,
      questions: [...perQuestion.entries()].map(([questionId, entry]) => ({
        questionId,
        attempts: entry.total,
        successRate: entry.total ? round((entry.correct / entry.total) * 100, 1) : 0,
        averageMark: entry.marks.length
          ? round(entry.marks.reduce((a, b) => a + b, 0) / entry.marks.length, 2)
          : 0,
      })),
    };
  }

  async deleteAttempt(attemptId: string | Types.ObjectId): Promise<void> {
    const attempt = await this.attemptModel.findById(toObjectId(attemptId)).exec();
    if (!attempt) return;
    const quiz = await this.findById(attempt.quiz);
    await attempt.deleteOne();
    await this.syncGrade(quiz, attempt.user);
  }

  private async requireOwnAttempt(
    attemptId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<QuizAttemptDocument> {
    const attempt = await this.attemptModel.findById(toObjectId(attemptId)).exec();
    if (!attempt) throw new NotFoundException('Intento no encontrado.');
    if (String(attempt.user) !== String(userId)) {
      throw new ForbiddenException('Este intento pertenece a otro usuario.');
    }
    return attempt;
  }

  private attemptToDto(attempt: QuizAttemptDocument): QuizAttemptDto {
    return {
      id: attempt.id,
      quizId: String(attempt.quiz),
      userId: String(attempt.user),
      attempt: attempt.attempt,
      state: attempt.state,
      startedAt: attempt.startedAt.toISOString(),
      finishedAt: attempt.finishedAt?.toISOString() ?? null,
      dueAt: attempt.dueAt?.toISOString() ?? null,
      sumGrades: attempt.sumGrades,
      grade: attempt.grade,
      layout: attempt.layout,
      responses: attempt.responses.map((r) => ({
        questionId: String(r.question),
        answer: r.answer,
        mark: r.mark,
        maxMark: r.maxMark,
        correct: r.correct,
        feedback: r.feedback,
        needsManualGrading: r.needsManualGrading,
      })),
    };
  }

  /** Preguntas para responder durante un intento (sin soluciones). */
  async attemptQuestions(attemptId: string | Types.ObjectId, userId: string | Types.ObjectId) {
    const attempt = await this.requireOwnAttempt(attemptId, userId);
    const quiz = await this.findById(attempt.quiz);
    const questions = await this.questions.findManyByIds(attempt.layout);
    const byId = new Map(questions.map((q) => [q.id, q]));

    return attempt.layout
      .map((id) => byId.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q) => this.questions.toStudentDto(q, quiz.shuffleAnswers));
  }
}
