import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { AnalyticsCourseOverview, fullName, round } from '@maya/shared';
import { LogsService } from '../logs/logs.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { CompletionService } from '../completion/completion.service';
import { GradesService } from '../grades/grades.service';
import { CoursesService } from '../courses/courses.service';
import { UsersService } from '../users/users.service';

/**
 * Analíticas del curso: participación, progreso, rendimiento e indicadores de
 * riesgo de abandono, calculados a partir del registro de eventos.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly logs: LogsService,
    private readonly enrolments: EnrolmentsService,
    private readonly completion: CompletionService,
    private readonly grades: GradesService,
    private readonly courses: CoursesService,
    private readonly users: UsersService,
  ) {}

  async courseOverview(courseId: string | Types.ObjectId): Promise<AnalyticsCourseOverview> {
    const course = await this.courses.findById(courseId);
    const [userIds, active7d, activityByDay, completions] = await Promise.all([
      this.enrolments.activeUserIds(courseId),
      this.logs.countActiveUsers(courseId, 7),
      this.logs.activityByDay(courseId, 30),
      this.completion.courseReport(courseId),
    ]);

    const totalItem = await this.grades.courseTotalItem(courseId);
    const gradeValues: number[] = [];
    for (const userId of userIds) {
      const grade = await this.grades.userGradeForItem(totalItem._id, userId);
      if (grade?.finalGrade !== null && grade?.finalGrade !== undefined) {
        gradeValues.push(grade.finalGrade);
      }
    }

    const completed = completions.filter((c) => c.progress >= 100).length;
    const atRisk = await this.atRiskUsers(courseId, userIds);

    return {
      courseId: course.id,
      courseName: course.fullName,
      enrolled: userIds.length,
      active7d,
      completionRate: userIds.length ? round((completed / userIds.length) * 100, 1) : 0,
      averageGrade: gradeValues.length
        ? round(gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length, 2)
        : null,
      submissionsPending: 0,
      atRiskUsers: atRisk,
      activityByDay: activityByDay as { date: string; views: number; posts: number; submissions: number }[],
    };
  }

  /**
   * Indicador de riesgo simple y explicable: combina inactividad reciente,
   * progreso bajo y calificación por debajo del aprobado.
   */
  private async atRiskUsers(courseId: string | Types.ObjectId, userIds: Types.ObjectId[]) {
    const participation = await this.logs.participation(courseId);
    const byUser = new Map(
      (participation as { _id: Types.ObjectId; total: number; lastAccess: Date }[]).map((p) => [
        String(p._id),
        p,
      ]),
    );

    const totalItem = await this.grades.courseTotalItem(courseId);
    const results = [];

    for (const userId of userIds.slice(0, 200)) {
      const reasons: string[] = [];
      let risk = 0;

      const stats = byUser.get(String(userId));
      const daysSinceAccess = stats?.lastAccess
        ? Math.floor((Date.now() - new Date(stats.lastAccess).getTime()) / 86_400_000)
        : 999;

      if (daysSinceAccess > 14) {
        risk += 40;
        reasons.push(`Sin actividad desde hace ${daysSinceAccess === 999 ? 'siempre' : `${daysSinceAccess} días`}`);
      } else if (daysSinceAccess > 7) {
        risk += 20;
        reasons.push('Poca actividad en las últimas dos semanas');
      }

      const progress = await this.completion.courseProgress(courseId, userId);
      if (progress.progress < 25) {
        risk += 30;
        reasons.push(`Progreso del ${progress.progress} %`);
      }

      const grade = await this.grades.userGradeForItem(totalItem._id, userId);
      if (totalItem.gradepass !== null && (grade?.finalGrade ?? 0) < totalItem.gradepass) {
        risk += 30;
        reasons.push('Calificación por debajo del aprobado');
      }

      if (risk >= 40) {
        const user = await this.users.findById(userId).catch(() => null);
        if (user) {
          results.push({
            id: user.id,
            fullName: fullName(user.firstName, user.lastName),
            risk: Math.min(risk, 100),
            reasons,
          });
        }
      }
    }

    return results.sort((a, b) => b.risk - a.risk).slice(0, 20);
  }

  /** Resumen de la empresa para el panel de administración. */
  async tenantOverview(tenantId: string | Types.ObjectId) {
    const [users, logs] = await Promise.all([
      this.users.countInTenant(tenantId),
      this.logs.paginate(tenantId, { page: 1, limit: 1, order: 'desc' } as never),
    ]);
    return {
      users,
      events: logs.total,
      generatedAt: new Date().toISOString(),
    };
  }
}
