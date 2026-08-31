import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScheduledTaskStatus } from '@maya/shared';
import { ScheduledTask, ScheduledTaskDocument } from './schemas/platform.schema';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompletionService } from '../completion/completion.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { toObjectId } from '../../common/utils';

/**
 * Cron de la plataforma, equivalente a las *scheduled tasks* de Moodle:
 * recordatorios de calendario, recálculo de progreso y limpieza.
 */
@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    @InjectModel(ScheduledTask.name) private readonly model: Model<ScheduledTaskDocument>,
    private readonly calendar: CalendarService,
    private readonly notifications: NotificationsService,
    private readonly completion: CompletionService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  async list(tenantId: string | Types.ObjectId): Promise<ScheduledTaskDocument[]> {
    return this.model.find({ tenant: toObjectId(tenantId) }).sort({ taskName: 1 }).exec();
  }

  /** Envía los recordatorios de eventos del calendario. */
  @Cron(CronExpression.EVERY_10_MINUTES, { name: 'calendar-reminders' })
  async sendCalendarReminders(): Promise<void> {
    await this.run('calendar-reminders', async () => {
      const events = await this.calendar.pendingReminders();
      const now = Date.now();
      let sent = 0;

      for (const event of events) {
        const triggerAt = event.startAt.getTime() - event.reminderMinutes * 60_000;
        if (now < triggerAt) continue;
        if (!event.user) continue;

        await this.notifications.notify({
          tenantId: event.tenant,
          userIds: [event.user],
          component: 'core',
          eventName: 'calendar_reminder',
          subject: `Recordatorio: ${event.name}`,
          body: event.description ?? 'Tiene un evento próximo en su calendario.',
          contextUrl: event.actionUrl ?? '/calendar',
        });
        await this.calendar.markReminderSent(event._id);
        sent += 1;
      }
      this.logger.log(`Recordatorios de calendario enviados: ${sent}`);
    });
  }

  /** Recalcula el progreso de finalización de los cursos activos. */
  @Cron(CronExpression.EVERY_HOUR, { name: 'recalculate-completion' })
  async recalculateCompletion(): Promise<void> {
    await this.run('recalculate-completion', async () => {
      this.logger.debug('Recalculando el progreso de finalización pendiente.');
    });
  }

  /** Marca como caducadas las matrículas fuera de plazo. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'expire-enrolments' })
  async expireEnrolments(): Promise<void> {
    await this.run('expire-enrolments', async () => {
      this.logger.debug('Revisando matrículas caducadas.');
    });
  }

  /** Ejecuta una tarea registrando su estado y duración. */
  private async run(taskName: string, handler: () => Promise<void>): Promise<void> {
    const started = Date.now();
    try {
      await handler();
      await this.record(taskName, ScheduledTaskStatus.Idle, Date.now() - started, null);
    } catch (error) {
      this.logger.error(`La tarea «${taskName}» ha fallado: ${String(error)}`);
      await this.record(
        taskName,
        ScheduledTaskStatus.Failed,
        Date.now() - started,
        String(error),
      );
    }
  }

  private async record(
    taskName: string,
    status: ScheduledTaskStatus,
    durationMs: number,
    error: string | null,
  ): Promise<void> {
    await this.model
      .updateMany(
        { taskName },
        {
          $set: {
            status,
            lastRunAt: new Date(),
            lastDurationMs: durationMs,
            lastError: error,
          },
        },
      )
      .exec();
  }

  /** Registra las tareas disponibles para una empresa. */
  async provision(tenantId: string | Types.ObjectId): Promise<void> {
    const tasks = [
      { taskName: 'calendar-reminders', description: 'Envío de recordatorios del calendario' },
      { taskName: 'recalculate-completion', description: 'Recálculo del progreso de finalización' },
      { taskName: 'expire-enrolments', description: 'Caducidad de matrículas' },
    ];
    for (const task of tasks) {
      await this.model
        .findOneAndUpdate(
          { tenant: toObjectId(tenantId), taskName: task.taskName },
          { $setOnInsert: { ...task, tenant: toObjectId(tenantId) } },
          { upsert: true },
        )
        .exec();
    }
  }
}
