import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import { RequestUser } from '../../../common/types/request-context';
import { FeedbackService } from './feedback.service';
import { CoursesService } from '../../courses/courses.service';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('mod/feedback')
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver una encuesta' })
  async detail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const feedback = await this.feedback.findById(module.instance);
    const [dto, responded] = await Promise.all([
      this.feedback.toDto(feedback),
      this.feedback.hasResponded(feedback._id, user.id),
    ]);
    return { module, feedback: dto, responded };
  }

  @Post(':moduleId/submit')
  @RequireCapability(CAP.FEEDBACK_COMPLETE, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async submit(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body('answers') answers: Record<string, unknown>,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.feedback.submit(module.instance, user.id, answers);
  }

  @Get(':moduleId/analysis')
  @RequireCapability(CAP.FEEDBACK_VIEW_REPORTS, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Análisis de respuestas de la encuesta' })
  async analysis(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    return this.feedback.analysis(module.instance);
  }
}
