import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CourseGradeRequirement,
  CourseGradeSummaryDto,
  GradeItemType,
  ModuleType,
  round,
} from '@maya/shared';
import { GradesService } from './grades.service';
import { GradeItem, GradeItemDocument } from './schemas/grade-item.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { Quiz, QuizDocument } from '../activities/quiz/schemas/quiz.schema';
import {
  QuizAttempt,
  QuizAttemptDocument,
} from '../activities/quiz/schemas/quiz-attempt.schema';
import { CompletionService } from '../completion/completion.service';
import { MediaProgressService } from '../media-progress/media-progress.service';
import { toObjectId } from '../../common/utils';

/**
 * Situación académica de un alumno en un curso: la nota final y si aprueba.
 *
 * Va aparte de `GradesService` porque responde a otra pregunta. El libro de
 * notas dice cuánto ha sacado en cada cosa; esto dice si el curso está
 * superado, que además de la nota puede depender de los exámenes obligatorios,
 * de haber completado las actividades y de haber visto los vídeos.
 *
 * La nota final se toma del ítem «total del curso», que ya calcula
 * `GradesService` con la agregación configurada, y se reescala a la escala del
 * curso: son dos escalas distintas —el total suma los puntos de las
 * actividades, y el curso se califica sobre 20— y confundirlas daría notas de
 * 87 sobre 20.
 */
@Injectable()
export class CourseGradingService {
  constructor(
    @InjectModel(Course.name) private readonly courseModel: Model<CourseDocument>,
    @InjectModel(GradeItem.name) private readonly itemModel: Model<GradeItemDocument>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<QuizDocument>,
    @InjectModel(QuizAttempt.name)
    private readonly attemptModel: Model<QuizAttemptDocument>,
    private readonly grades: GradesService,
    private readonly completion: CompletionService,
    private readonly media: MediaProgressService,
  ) {}

  async summary(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<CourseGradeSummaryDto> {
    const course = await this.courseModel.findById(toObjectId(courseId)).exec();
    const settings = course?.gradeSettings;
    const gradeMax = settings?.gradeMax ?? 20;
    const passingGrade = settings?.passingGrade ?? null;

    const [totalItem, items, progress, videoProgress] = await Promise.all([
      this.grades.courseTotalItem(courseId),
      this.grades.items(courseId),
      this.completion.courseProgress(courseId, userId),
      this.media.forUser(courseId, userId),
    ]);

    const total = await this.grades.userGradeForItem(totalItem._id, userId);

    // El total del curso vive en su propia escala (la suma de los máximos de
    // las actividades). Se pasa a la del curso para que la nota que se enseña
    // sea la que el alumno espera.
    const rawTotal = total?.finalGrade ?? null;
    const scale = totalItem.grademax > 0 ? gradeMax / totalItem.grademax : 0;
    const finalGrade = rawTotal === null ? null : round(rawTotal * scale, 2);
    const percentage =
      rawTotal === null || totalItem.grademax === 0
        ? null
        : round((rawTotal / totalItem.grademax) * 100, 1);

    const [quizzes, letters] = await Promise.all([
      this.quizModel.find({ course: toObjectId(courseId) }).lean().exec(),
      this.grades.letters(courseId),
    ]);
    const quizByInstance = new Map(quizzes.map((q) => [String(q._id), q]));

    const moduleItems = items.filter((item) => item.itemType !== GradeItemType.Course);
    const userGrades = await Promise.all(
      moduleItems.map((item) => this.grades.userGradeForItem(item._id, userId)),
    );
    const pendingByQuiz = await this.pendingManualByQuiz(quizzes.map((q) => q._id), userId);

    const detail = moduleItems.map((item, index) => {
      const quiz =
        item.itemModule === ModuleType.Quiz && item.itemInstance
          ? quizByInstance.get(String(item.itemInstance))
          : undefined;
      const grade = userGrades[index]?.finalGrade ?? null;
      return {
        itemId: item.id,
        name: item.name,
        moduleType: item.itemModule ?? null,
        moduleId: item.courseModule ? String(item.courseModule) : null,
        grade,
        grademax: item.grademax,
        gradepass: item.gradepass ?? null,
        weight: item.weight,
        required: Boolean(quiz?.requiredToPass),
        passed:
          item.gradepass === null || item.gradepass === undefined || grade === null
            ? null
            : grade >= item.gradepass,
        pendingManualGrading: quiz ? pendingByQuiz.has(String(quiz._id)) : false,
      };
    });

    /* --------------------------- Requisitos ----------------------------- */

    const requirements: CourseGradeRequirement[] = [];

    if (passingGrade !== null) {
      requirements.push({
        key: 'grade',
        label: 'Nota final',
        met: finalGrade !== null && finalGrade >= passingGrade,
        actual: finalGrade === null ? 'sin calificar' : String(finalGrade),
        required: `${passingGrade} de ${gradeMax}`,
      });
    }

    if (settings?.requireRequiredExams) {
      const required = detail.filter((item) => item.required);
      const passed = required.filter((item) => item.passed === true).length;
      // Sin exámenes obligatorios el requisito se cumple solo: no hay nada que
      // exigir, y darlo por incumplido bloquearía el curso sin motivo.
      requirements.push({
        key: 'exams',
        label: 'Exámenes obligatorios',
        met: required.length === 0 || passed === required.length,
        actual: `${passed} aprobados`,
        required: `${required.length} de ${required.length}`,
      });
    }

    if (settings?.requireCompletion) {
      requirements.push({
        key: 'completion',
        label: 'Actividades completadas',
        met: progress.progress >= 100,
        actual: `${progress.progress} %`,
        required: '100 %',
      });
    }

    if (settings?.requiredVideoPercent) {
      requirements.push({
        key: 'video',
        label: 'Vídeos vistos',
        met: videoProgress.percent >= settings.requiredVideoPercent,
        actual: `${videoProgress.percent} %`,
        required: `${settings.requiredVideoPercent} %`,
      });
    }

    // Sin ningún requisito configurado no hay aprobado ni suspenso que dar: el
    // curso se limita a informar de la nota, y `null` lo dice mejor que `false`.
    const passed = requirements.length ? requirements.every((r) => r.met) : null;

    const letter =
      percentage === null
        ? null
        : (letters
            .filter((l) => percentage >= l.lowerBoundary)
            .sort((a, b) => b.lowerBoundary - a.lowerBoundary)[0]?.letter ?? null);

    return {
      courseId: String(courseId),
      userId: String(userId),
      gradeMax,
      passingGrade,
      finalGrade,
      percentage,
      letter,
      passed,
      requirements,
      items: detail,
      progress: progress.progress,
      completedAt: progress.completedAt?.toISOString() ?? null,
      // Lo rellena el módulo de certificados, que es quien sabe si hay uno
      // emitido y cómo puede verse.
      certificate: null,
    };
  }

  /** Exámenes de esta persona con alguna respuesta todavía sin evaluar. */
  private async pendingManualByQuiz(
    quizIds: Types.ObjectId[],
    userId: string | Types.ObjectId,
  ): Promise<Set<string>> {
    if (!quizIds.length) return new Set();
    const attempts = await this.attemptModel
      .find({
        quiz: { $in: quizIds },
        user: toObjectId(userId),
        'responses.needsManualGrading': true,
      })
      .select('quiz')
      .lean()
      .exec();
    return new Set(attempts.map((a) => String(a.quiz)));
  }

  /** ¿Ha superado el curso? Atajo para quien solo necesita el veredicto. */
  async hasPassed(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<boolean> {
    return (await this.summary(courseId, userId)).passed === true;
  }
}
