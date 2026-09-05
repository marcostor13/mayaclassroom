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
  AssignDto,
  AssignSubmissionDto,
  ModuleType,
  SubmissionStatus,
  fullName,
  round,
} from '@maya/shared';
import { Assign, AssignDocument } from './schemas/assign.schema';
import {
  AssignSubmission,
  AssignSubmissionDocument,
} from './schemas/assign-submission.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { FilesService } from '../../files/files.service';
import { GradesService } from '../../grades/grades.service';
import { CompletionService } from '../../completion/completion.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { CoursesService } from '../../courses/courses.service';
import { toObjectId } from '../../../common/utils';
import {
  AssignSettingsDto,
  GradeSubmissionDto,
  SubmitAssignmentDto,
} from './dto/assign.dto';

@Injectable()
export class AssignService implements ActivityHandler, OnModuleInit {
  readonly type = ModuleType.Assign;
  readonly label = 'Tarea';
  readonly icon = 'clipboard-check';
  readonly gradable = true;
  readonly description =
    'Entrega de trabajos con fecha límite: el alumnado sube archivos o escribe ' +
    'en línea y el profesorado califica y comenta.';
  readonly tags = ['Con entrega', 'Fecha límite'];

  constructor(
    @InjectModel(Assign.name) private readonly model: Model<AssignDocument>,
    @InjectModel(AssignSubmission.name)
    private readonly submissionModel: Model<AssignSubmissionDocument>,
    private readonly registry: ActivityRegistry,
    private readonly files: FilesService,
    private readonly grades: GradesService,
    private readonly completion: CompletionService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly courses: CoursesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  /* --------------------------- ActivityHandler --------------------------- */

  async create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    const settings = input.settings as AssignSettingsDto;
    const assign = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      allowSubmissionsFrom: settings.allowSubmissionsFrom
        ? new Date(settings.allowSubmissionsFrom)
        : null,
      dueDate: settings.dueDate ? new Date(settings.dueDate) : null,
      cutOffDate: settings.cutOffDate ? new Date(settings.cutOffDate) : null,
      gradingDueDate: settings.gradingDueDate ? new Date(settings.gradingDueDate) : null,
      maxGrade: settings.maxGrade ?? 100,
      gradePass: settings.gradePass ?? null,
      submissionTypes: settings.submissionTypes ?? ['online', 'file'],
      maxFiles: settings.maxFiles ?? 5,
      maxFileSize: settings.maxFileSize ?? 20 * 1024 * 1024,
      allowedFileTypes: settings.allowedFileTypes ?? [],
      blindMarking: settings.blindMarking ?? false,
      teamSubmission: settings.teamSubmission ?? false,
      requireSubmissionStatement: settings.requireSubmissionStatement ?? false,
      submissionStatement: settings.submissionStatement ?? null,
      attemptReopenMethod: settings.attemptReopenMethod ?? 'none',
      maxAttempts: settings.maxAttempts ?? 1,
      latePolicy: settings.latePolicy ?? 'allow',
      latePenaltyPercentPerDay: settings.latePenaltyPercentPerDay ?? 0,
      notifyGraders: settings.notifyGraders ?? false,
      rubric: settings.rubric ?? null,
      createdBy: input.userId,
    });
    return { id: assign._id, gradeMax: assign.maxGrade };
  }

  async update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const assign = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as AssignSettingsDto;

    if (input.name) assign.name = input.name;
    if (settings.intro !== undefined) assign.intro = settings.intro ?? null;
    else if (input.description !== undefined) assign.intro = input.description;

    const dates: (keyof AssignSettingsDto)[] = [
      'allowSubmissionsFrom',
      'dueDate',
      'cutOffDate',
      'gradingDueDate',
    ];
    for (const key of dates) {
      if (settings[key] !== undefined) {
        (assign as unknown as Record<string, unknown>)[key] = settings[key]
          ? new Date(String(settings[key]))
          : null;
      }
    }

    const plain: (keyof AssignSettingsDto)[] = [
      'maxGrade',
      'gradePass',
      'submissionTypes',
      'maxFiles',
      'maxFileSize',
      'allowedFileTypes',
      'blindMarking',
      'teamSubmission',
      'requireSubmissionStatement',
      'submissionStatement',
      'attemptReopenMethod',
      'maxAttempts',
      'latePolicy',
      'latePenaltyPercentPerDay',
      'notifyGraders',
      'rubric',
    ];
    for (const key of plain) {
      if (settings[key] !== undefined) {
        (assign as unknown as Record<string, unknown>)[key] = settings[key];
      }
    }

    await assign.save();
    return { id: assign._id, gradeMax: assign.maxGrade };
  }

  async remove(instanceId: Types.ObjectId): Promise<void> {
    const submissions = await this.submissionModel.find({ assign: instanceId }).exec();
    for (const submission of submissions) {
      for (const fileId of [...submission.files, ...submission.feedbackFiles]) {
        await this.files.remove(fileId).catch(() => undefined);
      }
    }
    await this.submissionModel.deleteMany({ assign: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async get(instanceId: Types.ObjectId): Promise<AssignDto> {
    const assign = await this.findById(instanceId);
    return this.toDto(assign);
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
    const assign = await this.findById(instanceId);
    return assign.toObject() as unknown as Record<string, unknown>;
  }

  /* ------------------------------ Consultas ------------------------------ */

  async findById(id: string | Types.ObjectId): Promise<AssignDocument> {
    const assign = await this.model.findById(toObjectId(id)).exec();
    if (!assign) throw new NotFoundException('Tarea no encontrada.');
    return assign;
  }

  async toDto(assign: AssignDocument): Promise<AssignDto> {
    const attachments = await this.files.listByArea('mod/assign', 'intro', assign._id);
    return {
      id: assign.id,
      courseId: String(assign.course),
      name: assign.name,
      intro: assign.intro,
      allowSubmissionsFrom: assign.allowSubmissionsFrom?.toISOString() ?? null,
      dueDate: assign.dueDate?.toISOString() ?? null,
      cutOffDate: assign.cutOffDate?.toISOString() ?? null,
      gradingDueDate: assign.gradingDueDate?.toISOString() ?? null,
      maxGrade: assign.maxGrade,
      gradeType: assign.gradeType,
      submissionTypes: assign.submissionTypes,
      maxFiles: assign.maxFiles,
      maxFileSize: assign.maxFileSize,
      allowedFileTypes: assign.allowedFileTypes,
      blindMarking: assign.blindMarking,
      teamSubmission: assign.teamSubmission,
      requireSubmissionStatement: assign.requireSubmissionStatement,
      submissionStatement: assign.submissionStatement,
      attemptReopenMethod: assign.attemptReopenMethod,
      maxAttempts: assign.maxAttempts,
      latePolicy: assign.latePolicy,
      latePenaltyPercentPerDay: assign.latePenaltyPercentPerDay,
      attachments: this.files.toRefs(attachments),
    };
  }

  /* ------------------------------- Entregas ------------------------------ */

  async mySubmission(
    assignId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<AssignSubmissionDto | null> {
    const submission = await this.submissionModel
      .findOne({ assign: toObjectId(assignId), user: toObjectId(userId) })
      .sort({ attempt: -1 })
      .exec();
    return submission ? this.submissionToDto(submission) : null;
  }

  async submit(
    assignId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: SubmitAssignmentDto,
  ): Promise<AssignSubmissionDto> {
    const assign = await this.findById(assignId);
    const now = new Date();

    if (assign.allowSubmissionsFrom && now < assign.allowSubmissionsFrom) {
      throw new ForbiddenException('El período de entrega aún no ha comenzado.');
    }

    const existing = await this.submissionModel
      .findOne({ assign: assign._id, user: toObjectId(userId) })
      .sort({ attempt: -1 })
      .exec();

    const effectiveDeadline = existing?.extensionDueDate ?? assign.cutOffDate ?? assign.dueDate;
    const isLate = Boolean(assign.dueDate && now > (existing?.extensionDueDate ?? assign.dueDate));

    if (
      assign.latePolicy === 'block' &&
      effectiveDeadline &&
      now > effectiveDeadline
    ) {
      throw new ForbiddenException('El plazo de entrega ha finalizado.');
    }

    if (assign.requireSubmissionStatement && !dto.draft && !dto.acceptStatement) {
      throw new BadRequestException('Debe aceptar la declaración de autoría de la entrega.');
    }

    if (
      existing &&
      existing.status === SubmissionStatus.Submitted &&
      assign.attemptReopenMethod === 'none'
    ) {
      throw new ForbiddenException('Ya ha realizado la entrega y no se admiten reintentos.');
    }

    const submission =
      existing && existing.status !== SubmissionStatus.Graded
        ? existing
        : await this.submissionModel.create({
            assign: assign._id,
            user: toObjectId(userId),
            attempt: (existing?.attempt ?? 0) + 1,
            status: SubmissionStatus.New,
          });

    if (submission.attempt > assign.maxAttempts && assign.attemptReopenMethod !== 'untilpass') {
      throw new ForbiddenException('Ha agotado el número de intentos permitidos.');
    }

    submission.onlineText = dto.onlineText ?? submission.onlineText;
    submission.url = dto.url ?? submission.url;
    submission.status = dto.draft ? SubmissionStatus.Draft : SubmissionStatus.Submitted;
    submission.submittedAt = dto.draft ? null : now;
    submission.late = dto.draft ? false : isLate;

    if (dto.fileIds) {
      if (dto.fileIds.length > assign.maxFiles) {
        throw new BadRequestException(`Solo se admiten ${assign.maxFiles} ficheros como máximo.`);
      }
      submission.files = dto.fileIds.map(toObjectId);
      await this.files.attachToItem(dto.fileIds, {
        component: 'mod/assign',
        fileArea: 'submission_files',
        itemId: submission._id,
      });
    }

    await submission.save();

    if (!dto.draft) {
      const module = await this.courses.findModuleByInstance(ModuleType.Assign, assign._id);
      if (module) {
        await this.completion.evaluate(module._id, userId, { submitted: true });
      }
      if (assign.notifyGraders) await this.notifyGraders(assign, userId);
    }

    return this.submissionToDto(submission);
  }

  private async notifyGraders(
    assign: AssignDocument,
    studentId: string | Types.ObjectId,
  ): Promise<void> {
    const student = await this.users.findById(studentId);
    const module = await this.courses.findModuleByInstance(ModuleType.Assign, assign._id);
    await this.notifications.notify({
      tenantId: assign.tenant,
      userIds: [],
      component: 'mod/assign',
      eventName: 'assign_submitted',
      subject: `Nueva entrega en «${assign.name}»`,
      body: `${fullName(student.firstName, student.lastName)} ha realizado una entrega.`,
      contextUrl: module ? `/mod/assign/${module.id}/submissions` : undefined,
    });
  }

  async submissions(
    assignId: string | Types.ObjectId,
    filter: { status?: SubmissionStatus; userIds?: Types.ObjectId[] } = {},
  ): Promise<AssignSubmissionDto[]> {
    const query: Record<string, unknown> = { assign: toObjectId(assignId) };
    if (filter.status) query.status = filter.status;
    if (filter.userIds) query.user = { $in: filter.userIds };

    const submissions = await this.submissionModel
      .find(query)
      .populate('user', 'firstName lastName avatarUrl')
      .sort({ submittedAt: -1 })
      .exec();
    return Promise.all(submissions.map((s) => this.submissionToDto(s)));
  }

  /** Resumen de estado de entregas para el profesorado. */
  async summary(assignId: string | Types.ObjectId, participantCount: number) {
    const [submitted, graded, drafts] = await Promise.all([
      this.submissionModel
        .countDocuments({ assign: toObjectId(assignId), status: SubmissionStatus.Submitted })
        .exec(),
      this.submissionModel
        .countDocuments({ assign: toObjectId(assignId), status: SubmissionStatus.Graded })
        .exec(),
      this.submissionModel
        .countDocuments({ assign: toObjectId(assignId), status: SubmissionStatus.Draft })
        .exec(),
    ]);
    return {
      participants: participantCount,
      submitted: submitted + graded,
      graded,
      drafts,
      pending: Math.max(participantCount - submitted - graded, 0),
      needsGrading: submitted,
    };
  }

  async grade(
    submissionId: string | Types.ObjectId,
    dto: GradeSubmissionDto,
    graderId: string | Types.ObjectId,
  ): Promise<AssignSubmissionDto> {
    const submission = await this.submissionModel.findById(toObjectId(submissionId)).exec();
    if (!submission) throw new NotFoundException('Entrega no encontrada.');
    const assign = await this.findById(submission.assign);

    if (dto.grade < 0 || dto.grade > assign.maxGrade) {
      throw new BadRequestException(`La calificación debe estar entre 0 y ${assign.maxGrade}.`);
    }

    let finalGrade = dto.grade;
    if (assign.latePolicy === 'penalise' && submission.late && submission.submittedAt) {
      const reference = submission.extensionDueDate ?? assign.dueDate;
      if (reference) {
        const lateDays = Math.ceil(
          (submission.submittedAt.getTime() - reference.getTime()) / 86_400_000,
        );
        const penalty = Math.min(lateDays * assign.latePenaltyPercentPerDay, 100);
        finalGrade = round(dto.grade * (1 - penalty / 100), 2);
      }
    }

    submission.grade = finalGrade;
    submission.feedbackText = dto.feedbackText ?? null;
    submission.rubricGrades = dto.rubricGrades ?? null;
    submission.status = SubmissionStatus.Graded;
    submission.gradedAt = new Date();
    submission.grader = toObjectId(graderId);

    if (dto.feedbackFileIds) {
      submission.feedbackFiles = dto.feedbackFileIds.map(toObjectId);
      await this.files.attachToItem(dto.feedbackFileIds, {
        component: 'mod/assign',
        fileArea: 'feedback_files',
        itemId: submission._id,
      });
    }
    await submission.save();

    await this.grades.recordModuleGrade({
      courseId: assign.course,
      moduleType: ModuleType.Assign,
      instanceId: assign._id,
      userId: submission.user,
      grade: finalGrade,
      feedback: dto.feedbackText ?? null,
      graderId,
    });

    const module = await this.courses.findModuleByInstance(ModuleType.Assign, assign._id);
    if (module) {
      await this.completion.evaluate(module._id, submission.user, {
        submitted: true,
        graded: true,
        passed: assign.gradePass !== null ? finalGrade >= assign.gradePass : undefined,
      });
    }

    if (assign.sendStudentNotifications) {
      await this.notifications.notify({
        tenantId: assign.tenant,
        userIds: [submission.user],
        component: 'mod/assign',
        eventName: 'assign_graded',
        subject: `Su tarea «${assign.name}» ha sido calificada`,
        body: `Ha obtenido ${finalGrade} sobre ${assign.maxGrade}.`,
        contextUrl: module ? `/mod/assign/${module.id}` : undefined,
      });
    }

    return this.submissionToDto(submission);
  }

  async grantExtension(
    assignId: string | Types.ObjectId,
    userIds: string[],
    extensionDueDate: string,
  ): Promise<{ updated: number }> {
    const assign = await this.findById(assignId);
    for (const userId of userIds) {
      await this.submissionModel
        .findOneAndUpdate(
          { assign: assign._id, user: toObjectId(userId) },
          { $set: { extensionDueDate: new Date(extensionDueDate) }, $setOnInsert: { attempt: 1 } },
          { upsert: true },
        )
        .exec();
    }
    return { updated: userIds.length };
  }

  async reopen(submissionId: string | Types.ObjectId): Promise<AssignSubmissionDto> {
    const submission = await this.submissionModel.findById(toObjectId(submissionId)).exec();
    if (!submission) throw new NotFoundException('Entrega no encontrada.');
    submission.status = SubmissionStatus.Reopened;
    await submission.save();
    return this.submissionToDto(submission);
  }

  private async submissionToDto(
    submission: AssignSubmissionDocument,
  ): Promise<AssignSubmissionDto> {
    const [files, feedbackFiles] = await Promise.all([
      this.files.listByArea('mod/assign', 'submission_files', submission._id),
      this.files.listByArea('mod/assign', 'feedback_files', submission._id),
    ]);

    const user = submission.user as unknown as {
      _id?: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    };

    return {
      id: submission.id,
      assignId: String(submission.assign),
      userId: String(user?._id ?? submission.user),
      user: user?.firstName
        ? {
            id: String(user._id),
            fullName: fullName(user.firstName, user.lastName ?? ''),
            avatarUrl: user.avatarUrl ?? null,
          }
        : undefined,
      groupId: submission.group ? String(submission.group) : null,
      attempt: submission.attempt,
      status: submission.status,
      onlineText: submission.onlineText,
      url: submission.url,
      files: this.files.toRefs(files),
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      late: submission.late,
      grade: submission.grade,
      gradedAt: submission.gradedAt?.toISOString() ?? null,
      graderId: submission.grader ? String(submission.grader) : null,
      feedbackText: submission.feedbackText,
      feedbackFiles: this.files.toRefs(feedbackFiles),
      extensionDueDate: submission.extensionDueDate?.toISOString() ?? null,
    };
  }

  /** Tareas próximas a vencer para el panel del alumno. */
  async upcomingForUser(
    courseIds: Types.ObjectId[],
    userId: string | Types.ObjectId,
    days = 14,
  ) {
    const until = new Date(Date.now() + days * 86_400_000);
    const assigns = await this.model
      .find({ course: { $in: courseIds }, dueDate: { $gte: new Date(), $lte: until } })
      .sort({ dueDate: 1 })
      .limit(20)
      .exec();

    const results = [];
    for (const assign of assigns) {
      const submission = await this.submissionModel
        .findOne({ assign: assign._id, user: toObjectId(userId) })
        .exec();
      const module = await this.courses.findModuleByInstance(ModuleType.Assign, assign._id);
      results.push({
        id: assign.id,
        moduleId: module?.id ?? null,
        courseId: String(assign.course),
        name: assign.name,
        dueDate: assign.dueDate?.toISOString() ?? null,
        submitted:
          submission?.status === SubmissionStatus.Submitted ||
          submission?.status === SubmissionStatus.Graded,
        graded: submission?.status === SubmissionStatus.Graded,
      });
    }
    return results;
  }
}
