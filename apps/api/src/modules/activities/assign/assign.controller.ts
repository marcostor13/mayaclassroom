import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel, LogAction, SubmissionStatus } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import type { RequestUser } from '../../../common/types/request-context';
import { AssignService } from './assign.service';
import { CoursesService } from '../../courses/courses.service';
import { EnrolmentsService } from '../../enrolments/enrolments.service';
import { LogsService } from '../../logs/logs.service';
import { GradeSubmissionDto, GrantExtensionDto, SubmitAssignmentDto } from './dto/assign.dto';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('mod/assign')
export class AssignController {
  constructor(
    private readonly assign: AssignService,
    private readonly courses: CoursesService,
    private readonly enrolments: EnrolmentsService,
    private readonly logs: LogsService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.ASSIGN_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver una tarea' })
  async detail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const assign = await this.assign.findById(module.instance);
    const [dto, submission] = await Promise.all([
      this.assign.toDto(assign),
      this.assign.mySubmission(assign._id, user.id),
    ]);
    await this.logs.record({
      tenantId: user.tenantId,
      userId: user.id,
      courseId: module.course,
      component: 'mod/assign',
      target: 'assign',
      action: LogAction.Viewed,
      objectId: assign._id,
    });
    return { module, assign: dto, submission };
  }

  @Post(':moduleId/submit')
  @RequireCapability(CAP.ASSIGN_SUBMIT, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Entregar una tarea' })
  async submit(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: SubmitAssignmentDto,
  ) {
    const module = await this.courses.findModule(moduleId);
    const result = await this.assign.submit(module.instance, user.id, dto);
    await this.logs.record({
      tenantId: user.tenantId,
      userId: user.id,
      courseId: module.course,
      component: 'mod/assign',
      target: 'submission',
      action: LogAction.Submitted,
      objectId: result.id,
    });
    return result;
  }

  @Get(':moduleId/submissions')
  @RequireCapability(CAP.ASSIGN_GRADE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Listado de entregas para calificar' })
  async submissions(
    @Param('moduleId') moduleId: string,
    @Query('status') status?: SubmissionStatus,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.assign.submissions(module.instance, { status });
  }

  @Get(':moduleId/summary')
  @RequireCapability(CAP.ASSIGN_GRADE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async summary(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const participants = await this.enrolments.countActive(module.course);
    return this.assign.summary(module.instance, participants);
  }

  @Post(':moduleId/submissions/:submissionId/grade')
  @RequireCapability(CAP.ASSIGN_GRADE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Calificar una entrega' })
  async grade(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    const module = await this.courses.findModule(moduleId);
    const result = await this.assign.grade(submissionId, dto, user.id);
    await this.logs.record({
      tenantId: user.tenantId,
      userId: user.id,
      courseId: module.course,
      component: 'mod/assign',
      target: 'submission',
      action: LogAction.Graded,
      objectId: submissionId,
    });
    return result;
  }

  @Post(':moduleId/submissions/:submissionId/reopen')
  @RequireCapability(CAP.ASSIGN_GRADE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  reopen(@Param('submissionId') submissionId: string) {
    return this.assign.reopen(submissionId);
  }

  @Post(':moduleId/extensions')
  @RequireCapability(CAP.ASSIGN_GRANT_EXTENSION, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Conceder prórroga a uno o varios alumnos' })
  async grantExtension(@Param('moduleId') moduleId: string, @Body() dto: GrantExtensionDto) {
    const module = await this.courses.findModule(moduleId);
    return this.assign.grantExtension(module.instance, dto.userIds, dto.extensionDueDate);
  }
}
