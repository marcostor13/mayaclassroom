import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, CalendarEventType } from '@maya/shared';
import { AllowInDemo, CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CalendarService, CreateEventInput } from './calendar.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { dayjs } from '../../common/utils';

@ApiTags('Comunicación')
@ApiBearerAuth()
@AllowInDemo()
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'Eventos del calendario en un rango de fechas' })
  async events(
    @CurrentUser() user: RequestUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('courseId') courseId?: string,
  ) {
    const courseIds = await this.enrolments.courseIdsOfUser(user.id);
    return this.calendar.events({
      tenantId: user.tenantId,
      userId: user.id,
      courseIds,
      from: from ? new Date(from) : dayjs().startOf('month').toDate(),
      to: to ? new Date(to) : dayjs().endOf('month').toDate(),
      courseId,
    });
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Próximos eventos para la línea de tiempo' })
  async upcoming(@CurrentUser() user: RequestUser, @Query('days') days = '30') {
    const courseIds = await this.enrolments.courseIdsOfUser(user.id);
    return this.calendar.upcoming({
      tenantId: user.tenantId,
      userId: user.id,
      courseIds,
      days: Number(days),
    });
  }

  @Post('events')
  @ApiOperation({ summary: 'Crear un evento' })
  create(@CurrentUser() user: RequestUser, @Body() dto: Partial<CreateEventInput>) {
    const eventType = dto.eventType ?? CalendarEventType.User;
    if (eventType !== CalendarEventType.User && !user.capabilities.includes(CAP.CALENDAR_MANAGE_COURSE)) {
      return this.calendar.create({
        ...(dto as CreateEventInput),
        tenantId: user.tenantId,
        eventType: CalendarEventType.User,
        userId: user.id,
      });
    }
    return this.calendar.create({
      ...(dto as CreateEventInput),
      tenantId: user.tenantId,
      eventType,
      userId: eventType === CalendarEventType.User ? user.id : (dto.userId ?? null),
    });
  }

  @Patch('events/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreateEventInput>,
  ) {
    return this.calendar.update(
      id,
      user.id,
      dto,
      user.capabilities.includes(CAP.CALENDAR_MANAGE_COURSE),
    );
  }

  @Delete('events/:id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.calendar.remove(
      id,
      user.id,
      user.capabilities.includes(CAP.CALENDAR_MANAGE_COURSE),
    );
    return { deleted: true };
  }

  @Get('export.ics')
  @ApiOperation({ summary: 'Exportar el calendario en formato iCalendar' })
  async exportIcs(@CurrentUser() user: RequestUser, @Res() res: Response) {
    const courseIds = await this.enrolments.courseIdsOfUser(user.id);
    const events = await this.calendar.events({
      tenantId: user.tenantId,
      userId: user.id,
      courseIds,
      from: dayjs().subtract(6, 'month').toDate(),
      to: dayjs().add(12, 'month').toDate(),
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="maya-classroom.ics"');
    res.send(this.calendar.toICalendar(events));
  }
}
