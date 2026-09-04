import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CompletionState,
  ModuleType,
  QuizAttemptState,
  SignatureUse,
  StudentActivityRow,
  StudentAttendanceRow,
  StudentCourseRow,
  StudentExamRow,
  StudentKpi,
  StudentReportDto,
  round,
} from '@maya/shared';
import { Enrolment, EnrolmentDocument } from '../enrolments/schemas/enrolment.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { CourseModule, CourseModuleDocument } from '../courses/schemas/course-module.schema';
import {
  ModuleCompletion,
  ModuleCompletionDocument,
} from '../completion/schemas/completion.schema';
import { Quiz, QuizDocument } from '../activities/quiz/schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from '../activities/quiz/schemas/quiz-attempt.schema';
import {
  LiveAttendance,
  LiveAttendanceDocument,
} from '../live/schemas/live-attendance.schema';
import { LiveSession, LiveSessionDocument } from '../live/schemas/live-session.schema';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CourseGradingService } from '../grades/course-grading.service';
import { MediaProgressService } from '../media-progress/media-progress.service';
import { SignaturesService } from '../signatures/signatures.service';
import { CertificatesService } from '../certificates/certificates.service';
import { toObjectId } from '../../common/utils';

/**
 * Expediente completo de un alumno.
 *
 * Reúne en una sola respuesta lo que hoy vive repartido —matrículas, avance,
 * notas, exámenes, asistencia, firma y certificados— porque la pregunta que se
 * hace quien lo abre es una sola: «¿cómo va esta persona?». Pedirlo pantalla a
 * pantalla obligaba a cruzar datos a mano y era justo lo que se pedía para una
 * reclamación o una auditoría.
 *
 * Es una consulta cara por naturaleza, así que se hace en paralelo por curso y
 * se acota a la empresa de quien pregunta: el aislamiento entre empresas manda
 * también aquí.
 */
@Injectable()
export class StudentReportService {
  constructor(
    @InjectModel(Enrolment.name) private readonly enrolmentModel: Model<EnrolmentDocument>,
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(CourseModule.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(ModuleCompletion.name)
    private readonly completionModel: Model<ModuleCompletionDocument>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly attemptModel: Model<QuizAttemptDocument>,
    @InjectModel(LiveAttendance.name)
    private readonly attendanceModel: Model<LiveAttendanceDocument>,
    @InjectModel(LiveSession.name)
    private readonly sessionModel: Model<LiveSessionDocument>,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    private readonly courseGrading: CourseGradingService,
    private readonly media: MediaProgressService,
    private readonly signatures: SignaturesService,
    private readonly certificates: CertificatesService,
  ) {}

  async build(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<StudentReportDto> {
    const [user, tenant, signature] = await Promise.all([
      this.users.findById(userId),
      this.tenants.findById(tenantId),
      this.signatures.findOfUser(tenantId, userId),
    ]);

    const enrolments = await this.enrolmentModel
      .find({ user: toObjectId(userId), tenant: toObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const courses = await this.courseModel
      .find({ _id: { $in: enrolments.map((e) => e.course) }, tenant: toObjectId(tenantId) })
      .lean()
      .exec();
    const courseById = new Map(courses.map((c) => [String(c._id), c]));

    const perCourse = await Promise.all(
      enrolments
        .filter((enrolment) => courseById.has(String(enrolment.course)))
        .map((enrolment) => this.forCourse(enrolment, courseById.get(String(enrolment.course))!, userId)),
    );

    const courseRows = perCourse.map((entry) => entry.row);
    const activities = perCourse.flatMap((entry) => entry.activities);
    const exams = perCourse.flatMap((entry) => entry.exams);

    const attendance = await this.attendance(tenantId, userId, courseById);

    // La asistencia se resuelve de una vez para toda la persona —una consulta,
    // no una por curso— y se reparte después entre sus filas.
    for (const row of courseRows) {
      const suyas = attendance.filter((item) => item.courseId === row.courseId);
      row.attendanceSessions = suyas.length;
      row.attendanceHours = round(
        suyas.reduce((sum, item) => sum + item.minutes, 0) / 60,
        2,
      );
    }

    return {
      generatedAt: new Date().toISOString(),
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: tenant.branding?.logoUrl ?? null,
        primaryColor: tenant.branding?.primaryColor ?? null,
      },
      student: {
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        idNumber: user.idNumber ?? null,
        phone: user.phone ?? null,
        city: user.city ?? null,
        country: user.country ?? null,
        department: user.department ?? null,
        institution: user.institution ?? null,
        avatarUrl: user.avatarUrl ?? null,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        lastAccessAt: user.lastAccessAt?.toISOString() ?? null,
      },
      kpis: this.kpis(courseRows, exams, attendance),
      courses: courseRows,
      activities,
      exams,
      attendance,
      signature: signature ? this.signatures.toDto(signature) : null,
    };
  }

  /* ----------------------------- Por curso ------------------------------- */

  private async forCourse(
    enrolment: Enrolment,
    course: Course & { _id: Types.ObjectId },
    userId: string | Types.ObjectId,
  ): Promise<{ row: StudentCourseRow; activities: StudentActivityRow[]; exams: StudentExamRow[] }> {
    const courseId = course._id;

    const [summary, videoProgress, modules, completions, certificate] = await Promise.all([
      this.courseGrading.summary(courseId, userId),
      this.media.forUser(courseId, userId),
      this.moduleModel.find({ course: courseId }).lean().exec(),
      this.completionModel.find({ course: courseId, user: toObjectId(userId) }).lean().exec(),
      this.certificates.forCourseAndUser(courseId, userId),
    ]);

    const completionByModule = new Map(completions.map((c) => [String(c.courseModule), c]));
    const gradeByModule = new Map(
      summary.items.filter((item) => item.moduleId).map((item) => [item.moduleId!, item]),
    );

    const activities: StudentActivityRow[] = modules.map((module) => {
      const completion = completionByModule.get(String(module._id));
      const grade = gradeByModule.get(String(module._id));
      return {
        courseId: String(courseId),
        courseName: course.fullName,
        moduleId: String(module._id),
        moduleName: module.name,
        moduleType: module.moduleType,
        completionState: completion?.state ?? CompletionState.Incomplete,
        completedAt: completion?.completedAt?.toISOString() ?? null,
        grade: grade?.grade ?? null,
        gradeMax: grade?.grademax ?? module.gradeMax ?? null,
      };
    });

    const exams = await this.exams(courseId, course.fullName, userId);

    return {
      row: {
        courseId: String(courseId),
        shortName: course.shortName,
        fullName: course.fullName,
        enrolledAt: enrolment.createdAt?.toISOString() ?? null,
        lastAccessAt: enrolment.lastAccess?.toISOString() ?? null,
        progress: summary.progress,
        completedModules: activities.filter(
          (a) =>
            a.completionState === CompletionState.Complete ||
            a.completionState === CompletionState.CompletePass,
        ).length,
        totalModules: activities.length,
        completedAt: summary.completedAt,
        finalGrade: summary.finalGrade,
        passingGrade: summary.passingGrade,
        passed: summary.passed,
        videoPercent: videoProgress.totalVideos ? videoProgress.percent : null,
        videoHours: round(videoProgress.watchedSeconds / 3600, 2),
        // Se rellenan en `build`, cuando ya se conoce la asistencia completa.
        attendanceSessions: 0,
        attendanceHours: 0,
        certificateCode: certificate?.code ?? null,
      },
      activities,
      exams,
    };
  }

  private async exams(
    courseId: Types.ObjectId,
    courseName: string,
    userId: string | Types.ObjectId,
  ): Promise<StudentExamRow[]> {
    const quizzes = await this.quizModel.find({ course: courseId }).lean().exec();
    if (!quizzes.length) return [];

    const attempts = await this.attemptModel
      .find({ quiz: { $in: quizzes.map((q) => q._id) }, user: toObjectId(userId) })
      .sort({ startedAt: 1 })
      .lean()
      .exec();
    const quizById = new Map(quizzes.map((q) => [String(q._id), q]));

    return attempts.map((attempt) => {
      const quiz = quizById.get(String(attempt.quiz))!;
      const pending = attempt.responses.some((r) => r.needsManualGrading);
      return {
        courseId: String(courseId),
        courseName,
        quizName: quiz.name,
        attempt: attempt.attempt,
        state: attempt.state as QuizAttemptState,
        startedAt: attempt.startedAt.toISOString(),
        finishedAt: attempt.finishedAt?.toISOString() ?? null,
        grade: attempt.grade,
        maxGrade: quiz.maxGrade,
        passingGrade: quiz.passingGrade,
        // Con algo por evaluar, la nota que hay no es definitiva y decir si
        // aprueba sería adelantar un resultado que puede cambiar.
        passed:
          pending || quiz.passingGrade === null || attempt.grade === null
            ? null
            : attempt.grade >= quiz.passingGrade,
        pendingManualGrading: pending,
      };
    });
  }

  /* ----------------------------- Asistencia ------------------------------ */

  private async attendance(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    courseById: Map<string, Course & { _id: Types.ObjectId }>,
  ): Promise<StudentAttendanceRow[]> {
    const records = await this.attendanceModel
      .find({ tenant: toObjectId(tenantId), user: toObjectId(userId) })
      .sort({ firstJoinAt: -1 })
      .lean()
      .exec();
    if (!records.length) return [];

    const sessions = await this.sessionModel
      .find({ _id: { $in: records.map((r) => r.session) } })
      .lean()
      .exec();
    const sessionById = new Map(sessions.map((s) => [String(s._id), s]));

    const signed = await this.signatures.recordsOfUser(tenantId, userId);
    const signedByReference = new Map(
      signed
        .filter((record) => record.use === SignatureUse.Attendance && record.reference)
        .map((record) => [String(record.reference), record]),
    );

    return records.map((record) => {
      const session = sessionById.get(String(record.session));
      const courseId = session?.course ? String(session.course) : null;
      const firma = signedByReference.get(String(record.session));
      return {
        courseId,
        courseName: courseId ? (courseById.get(courseId)?.fullName ?? null) : null,
        sessionTitle: session?.title ?? 'Sesión',
        startedAt: (session?.scheduledStart ?? record.firstJoinAt).toISOString(),
        minutes: Math.round(record.totalSeconds / 60),
        signed: Boolean(firma),
        signedAt: firma?.signedAt.toISOString() ?? null,
      };
    });
  }

  /* -------------------------------- KPI ---------------------------------- */

  /**
   * Indicadores de cabecera.
   *
   * Se eligen los que responden a «¿va bien esta persona?» sin tener que leer
   * la tabla: cuántos cursos lleva, cuántos ha superado, cuánto avanza de
   * media, qué nota saca y cuánto tiempo dedica.
   */
  private kpis(
    courses: StudentCourseRow[],
    exams: StudentExamRow[],
    attendance: StudentAttendanceRow[],
  ): StudentKpi[] {
    const conNota = courses.filter((c) => c.finalGrade !== null);
    const aprobados = courses.filter((c) => c.passed === true).length;
    const horasVideo = courses.reduce((sum, c) => sum + c.videoHours, 0);
    const horasClase = attendance.reduce((sum, a) => sum + a.minutes, 0) / 60;

    return [
      {
        key: 'courses',
        label: 'Cursos matriculados',
        value: courses.length,
        unit: 'count',
      },
      {
        key: 'passed',
        label: 'Cursos superados',
        value: aprobados,
        unit: 'count',
        hint: courses.length ? `de ${courses.length}` : null,
      },
      {
        key: 'progress',
        label: 'Avance medio',
        value: courses.length
          ? round(courses.reduce((sum, c) => sum + c.progress, 0) / courses.length, 0)
          : 0,
        unit: 'percent',
      },
      {
        key: 'grade',
        label: 'Nota media',
        value: conNota.length
          ? round(conNota.reduce((sum, c) => sum + (c.finalGrade ?? 0), 0) / conNota.length, 2)
          : 0,
        unit: 'grade',
        hint: conNota.length ? null : 'todavía sin calificaciones',
      },
      {
        key: 'exams',
        label: 'Exámenes realizados',
        value: exams.filter((e) => e.state === QuizAttemptState.Finished).length,
        unit: 'count',
        hint: exams.some((e) => e.pendingManualGrading) ? 'alguno sin corregir' : null,
      },
      {
        key: 'hours',
        label: 'Horas de estudio registradas',
        value: round(horasVideo + horasClase, 1),
        unit: 'hours',
        hint: 'vídeo y clases en vivo',
      },
      {
        key: 'attendance',
        label: 'Clases en vivo asistidas',
        value: attendance.length,
        unit: 'count',
        hint: attendance.length
          ? `${attendance.filter((a) => a.signed).length} firmadas`
          : null,
      },
    ];
  }

  /** Etiqueta legible de un tipo de actividad, para las exportaciones. */
  static moduleLabel(type: string): string {
    const labels: Partial<Record<ModuleType, string>> = {
      [ModuleType.Quiz]: 'Examen',
      [ModuleType.Assign]: 'Tarea',
      [ModuleType.Forum]: 'Foro',
      [ModuleType.Page]: 'Lección',
      [ModuleType.Book]: 'Libro',
      [ModuleType.Resource]: 'Archivo',
      [ModuleType.Url]: 'Enlace',
      [ModuleType.Feedback]: 'Encuesta',
      [ModuleType.Choice]: 'Consulta',
      [ModuleType.Attendance]: 'Asistencia',
    };
    return labels[type as ModuleType] ?? type;
  }
}
