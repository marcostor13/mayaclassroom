import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CalendarEventDto, CalendarEventType, MAYA_BRAND } from '@maya/shared';
import { CalendarEvent, CalendarEventDocument } from './schemas/calendar-event.schema';
import { dayjs, toObjectId } from '../../common/utils';

export interface CreateEventInput {
  tenantId: string | Types.ObjectId;
  name: string;
  description?: string | null;
  eventType: CalendarEventType;
  courseId?: string | Types.ObjectId | null;
  groupId?: string | Types.ObjectId | null;
  userId?: string | Types.ObjectId | null;
  courseModuleId?: string | Types.ObjectId | null;
  moduleType?: string | null;
  startAt: Date | string;
  endAt?: Date | string | null;
  allDay?: boolean;
  location?: string | null;
  color?: string | null;
  actionable?: boolean;
  actionUrl?: string | null;
  reminderMinutes?: number;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(CalendarEvent.name) private readonly model: Model<CalendarEventDocument>,
  ) {}

  async create(input: CreateEventInput): Promise<CalendarEventDocument> {
    return this.model.create({
      tenant: toObjectId(input.tenantId),
      name: input.name,
      description: input.description ?? null,
      eventType: input.eventType,
      course: input.courseId ? toObjectId(input.courseId) : null,
      group: input.groupId ? toObjectId(input.groupId) : null,
      user: input.userId ? toObjectId(input.userId) : null,
      courseModule: input.courseModuleId ? toObjectId(input.courseModuleId) : null,
      moduleType: input.moduleType ?? null,
      startAt: new Date(input.startAt),
      endAt: input.endAt ? new Date(input.endAt) : null,
      allDay: input.allDay ?? false,
      location: input.location ?? null,
      color: input.color ?? MAYA_BRAND.colors.primary,
      actionable: input.actionable ?? false,
      actionUrl: input.actionUrl ?? null,
      reminderMinutes: input.reminderMinutes ?? 0,
    });
  }

  /** Crea o actualiza el evento asociado a una actividad (fecha de entrega). */
  async syncModuleEvent(params: {
    tenantId: string | Types.ObjectId;
    courseId: string | Types.ObjectId;
    courseModuleId: string | Types.ObjectId;
    moduleType: string;
    name: string;
    startAt: Date | null;
    actionUrl?: string;
  }): Promise<void> {
    if (!params.startAt) {
      await this.model
        .deleteMany({ courseModule: toObjectId(params.courseModuleId) })
        .exec();
      return;
    }
    await this.model
      .findOneAndUpdate(
        { courseModule: toObjectId(params.courseModuleId) },
        {
          $set: {
            tenant: toObjectId(params.tenantId),
            course: toObjectId(params.courseId),
            moduleType: params.moduleType,
            eventType: CalendarEventType.Course,
            name: params.name,
            startAt: params.startAt,
            actionable: true,
            actionUrl: params.actionUrl ?? null,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  /** Eventos visibles para un usuario en un rango de fechas. */
  async events(params: {
    tenantId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    courseIds: Types.ObjectId[];
    groupIds?: Types.ObjectId[];
    from: Date;
    to: Date;
    courseId?: string;
  }): Promise<CalendarEventDto[]> {
    const filter: FilterQuery<CalendarEventDocument> = {
      tenant: toObjectId(params.tenantId),
      startAt: { $gte: params.from, $lte: params.to },
    };

    if (params.courseId) {
      filter.course = toObjectId(params.courseId);
    } else {
      filter.$or = [
        { eventType: CalendarEventType.Site },
        { eventType: CalendarEventType.Tenant },
        { user: toObjectId(params.userId) },
        { course: { $in: params.courseIds } },
        ...(params.groupIds?.length ? [{ group: { $in: params.groupIds } }] : []),
      ];
    }

    const events = await this.model.find(filter).sort({ startAt: 1 }).exec();
    return events.map((e) => this.toDto(e));
  }

  /** Próximos eventos para la línea de tiempo del panel. */
  async upcoming(params: {
    tenantId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    courseIds: Types.ObjectId[];
    days?: number;
    limit?: number;
  }): Promise<CalendarEventDto[]> {
    const from = new Date();
    const to = dayjs(from).add(params.days ?? 30, 'day').toDate();
    const events = await this.model
      .find({
        tenant: toObjectId(params.tenantId),
        startAt: { $gte: from, $lte: to },
        $or: [
          { eventType: CalendarEventType.Site },
          { eventType: CalendarEventType.Tenant },
          { user: toObjectId(params.userId) },
          { course: { $in: params.courseIds } },
        ],
      })
      .sort({ startAt: 1 })
      .limit(params.limit ?? 10)
      .exec();
    return events.map((e) => this.toDto(e));
  }

  async findById(id: string | Types.ObjectId): Promise<CalendarEventDocument> {
    const event = await this.model.findById(toObjectId(id)).exec();
    if (!event) throw new NotFoundException('Evento no encontrado.');
    return event;
  }

  async update(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: Partial<CreateEventInput>,
    canManageCourseEvents = false,
  ): Promise<CalendarEventDocument> {
    const event = await this.findById(id);
    if (
      event.eventType === CalendarEventType.User &&
      String(event.user) !== String(userId)
    ) {
      throw new ForbiddenException('Solo puede editar sus propios eventos.');
    }
    if (event.eventType !== CalendarEventType.User && !canManageCourseEvents) {
      throw new ForbiddenException('No tiene permisos para editar este evento.');
    }

    if (input.name) event.name = input.name;
    if (input.description !== undefined) event.description = input.description ?? null;
    if (input.startAt) event.startAt = new Date(input.startAt);
    if (input.endAt !== undefined) event.endAt = input.endAt ? new Date(input.endAt) : null;
    if (input.allDay !== undefined) event.allDay = input.allDay;
    if (input.location !== undefined) event.location = input.location ?? null;
    if (input.color !== undefined) event.color = input.color ?? null;
    if (input.reminderMinutes !== undefined) event.reminderMinutes = input.reminderMinutes;
    await event.save();
    return event;
  }

  async remove(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    canManageCourseEvents = false,
  ): Promise<void> {
    const event = await this.findById(id);
    if (
      event.eventType === CalendarEventType.User &&
      String(event.user) !== String(userId)
    ) {
      throw new ForbiddenException('Solo puede eliminar sus propios eventos.');
    }
    if (event.eventType !== CalendarEventType.User && !canManageCourseEvents) {
      throw new ForbiddenException('No tiene permisos para eliminar este evento.');
    }
    await event.deleteOne();
  }

  /** Eventos con recordatorio pendiente (usado por la tarea programada). */
  async pendingReminders(): Promise<CalendarEventDocument[]> {
    const now = new Date();
    return this.model
      .find({
        reminderMinutes: { $gt: 0 },
        reminderSent: false,
        startAt: { $gte: now },
      })
      .exec();
  }

  async markReminderSent(id: string | Types.ObjectId): Promise<void> {
    await this.model.updateOne({ _id: toObjectId(id) }, { $set: { reminderSent: true } }).exec();
  }

  /** Exportación iCalendar de los eventos del usuario. */
  toICalendar(events: CalendarEventDto[]): string {
    const stamp = (date: string) =>
      dayjs(date).utc().format('YYYYMMDD[T]HHmmss[Z]');
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Maya Classroom//ES',
      'CALSCALE:GREGORIAN',
    ];
    for (const event of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${event.id}@mayaclassroom`,
        `DTSTAMP:${stamp(new Date().toISOString())}`,
        `DTSTART:${stamp(event.startAt)}`,
        ...(event.endAt ? [`DTEND:${stamp(event.endAt)}`] : []),
        `SUMMARY:${event.name.replace(/\n/g, ' ')}`,
        ...(event.description ? [`DESCRIPTION:${event.description.replace(/\n/g, ' ')}`] : []),
        ...(event.location ? [`LOCATION:${event.location}`] : []),
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private toDto(event: CalendarEventDocument): CalendarEventDto {
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      eventType: event.eventType,
      courseId: event.course ? String(event.course) : null,
      groupId: event.group ? String(event.group) : null,
      userId: event.user ? String(event.user) : null,
      moduleId: event.courseModule ? String(event.courseModule) : null,
      moduleType: event.moduleType,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt?.toISOString() ?? null,
      allDay: event.allDay,
      location: event.location,
      color: event.color,
      actionable: event.actionable,
      actionUrl: event.actionUrl,
    };
  }
}
