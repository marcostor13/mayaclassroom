import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CourseVisibility } from '@maya/shared';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { CoursesService } from '../courses/courses.service';
import { CompletionService } from '../completion/completion.service';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagingService } from '../messaging/messaging.service';
import { AssignService } from '../activities/assign/assign.service';
import { GradesService } from '../grades/grades.service';
import { UsersService } from '../users/users.service';
import type { RequestUser } from '../../common/types/request-context';

/**
 * Agrega la información del panel principal: mis cursos, línea de tiempo,
 * próximas entregas, progreso y avisos.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly enrolments: EnrolmentsService,
    private readonly courses: CoursesService,
    private readonly completion: CompletionService,
    private readonly calendar: CalendarService,
    private readonly notifications: NotificationsService,
    private readonly messaging: MessagingService,
    private readonly assign: AssignService,
    private readonly grades: GradesService,
    private readonly users: UsersService,
  ) {}

  async overview(user: RequestUser) {
    const [courseIds, profile] = await Promise.all([
      this.enrolments.courseIdsOfUser(user.id),
      this.users.findById(user.id),
    ]);

    const [courses, upcomingEvents, deadlines, unreadNotifications, unreadMessages] =
      await Promise.all([
        this.myCourses(courseIds, user, profile.favouriteCourses),
        this.calendar.upcoming({
          tenantId: user.tenantId,
          userId: user.id,
          courseIds,
          days: 30,
          limit: 8,
        }),
        this.assign.upcomingForUser(courseIds, user.id, 14),
        this.notifications.unreadCount(user.id),
        this.messaging.unreadTotal(user.id),
      ]);

    const averageProgress = courses.length
      ? Math.round(courses.reduce((sum, c) => sum + (c.progress ?? 0), 0) / courses.length)
      : 0;

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      stats: {
        courses: courses.length,
        completedCourses: courses.filter((c) => (c.progress ?? 0) >= 100).length,
        averageProgress,
        pendingDeadlines: deadlines.filter((d) => !d.submitted).length,
        unreadNotifications,
        unreadMessages,
      },
      courses,
      upcomingEvents,
      deadlines,
    };
  }

  private async myCourses(
    courseIds: Types.ObjectId[],
    user: RequestUser,
    favourites: Types.ObjectId[],
  ) {
    const result = await this.courses.paginate(
      user.tenantId,
      { page: 1, limit: 50, order: 'desc', onlyMine: true } as never,
      { enrolledCourseIds: courseIds, canSeeHidden: true, favouriteIds: favourites },
    );

    const favouriteSet = new Set(favourites.map(String));

    return Promise.all(
      result.items.map(async (course) => {
        const progress = await this.completion.courseProgress(course._id, user.id);
        return {
          id: course.id,
          shortName: course.shortName,
          fullName: course.fullName,
          summary: course.summary,
          imageUrl: course.imageUrl,
          categoryId: String(course.category),
          format: course.format,
          visibility: course.visibility,
          startDate: course.startDate?.toISOString() ?? null,
          endDate: course.endDate?.toISOString() ?? null,
          progress: progress.progress,
          favourite: favouriteSet.has(course.id),
          hidden: course.visibility === CourseVisibility.Hidden,
        };
      }),
    );
  }

  /** Panel del profesorado: entregas por corregir y actividad de sus cursos. */
  async teachingOverview(user: RequestUser) {
    const courseIds = await this.enrolments.courseIdsOfUser(user.id);
    const summaries = [];

    for (const courseId of courseIds.slice(0, 20)) {
      const course = await this.courses.findById(courseId).catch(() => null);
      if (!course) continue;
      const participants = await this.enrolments.countActive(courseId);
      summaries.push({
        courseId: course.id,
        courseName: course.fullName,
        participants,
      });
    }

    return { courses: summaries };
  }
}
