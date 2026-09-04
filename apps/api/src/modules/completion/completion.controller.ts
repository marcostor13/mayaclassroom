import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { AllowInDemo, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CompletionService } from './completion.service';

@ApiTags('Finalización')
@ApiBearerAuth()
@AllowInDemo()
@Controller('completion')
export class CompletionController {
  constructor(private readonly completion: CompletionService) {}

  @Get('courses/:courseId/me')
  @ApiOperation({ summary: 'Progreso del usuario en un curso' })
  myProgress(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.completion.courseProgress(courseId, user.id);
  }

  @Get('courses/:courseId/states')
  @ApiOperation({ summary: 'Estado de finalización de cada actividad' })
  async states(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    const map = await this.completion.statesForCourse(courseId, user.id);
    return Object.fromEntries(map);
  }

  @Post('modules/:moduleId/toggle')
  @ApiOperation({ summary: 'Marcar o desmarcar manualmente una actividad' })
  toggle(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body('completed') completed: boolean,
  ) {
    return this.completion.setManual(moduleId, user.id, completed);
  }

  @Post('modules/:moduleId/users/:userId')
  @RequireCapability(CAP.COURSE_MARK_COMPLETE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Marcar la finalización de otro usuario (profesorado)' })
  setForUser(
    @Param('moduleId') moduleId: string,
    @Param('userId') userId: string,
    @Body('completed') completed: boolean,
  ) {
    return this.completion.setManual(moduleId, userId, completed, true);
  }

  @Get('courses/:courseId/report')
  @RequireCapability(CAP.REPORT_VIEW_COMPLETION, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Informe de finalización del curso' })
  report(@Param('courseId') courseId: string) {
    return this.completion.courseReport(courseId);
  }
}
