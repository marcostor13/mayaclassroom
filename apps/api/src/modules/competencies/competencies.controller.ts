import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, CompetencyProficiency, ContextLevel } from '@maya/shared';
import { AllowInDemo, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CompetenciesService } from './competencies.service';
import {
  CreateCompetencyDto,
  CreateFrameworkDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './dto/competency.dto';

@ApiTags('Competencias')
@ApiBearerAuth()
@AllowInDemo()
@Controller('competencies')
export class CompetenciesController {
  constructor(private readonly competencies: CompetenciesService) {}

  @Get('frameworks')
  @RequireCapability(CAP.COMPETENCY_VIEW, { contextLevel: ContextLevel.Tenant })
  frameworks(@CurrentUser() user: RequestUser) {
    return this.competencies.frameworks(user.tenantId);
  }

  @Post('frameworks')
  @RequireCapability(CAP.COMPETENCY_MANAGE, { contextLevel: ContextLevel.Tenant })
  createFramework(@CurrentUser() user: RequestUser, @Body() dto: CreateFrameworkDto) {
    return this.competencies.createFramework(user.tenantId, dto);
  }

  @Delete('frameworks/:id')
  @RequireCapability(CAP.COMPETENCY_MANAGE, { contextLevel: ContextLevel.Tenant })
  async removeFramework(@Param('id') id: string) {
    await this.competencies.removeFramework(id);
    return { deleted: true };
  }

  @Get('frameworks/:id/tree')
  @RequireCapability(CAP.COMPETENCY_VIEW, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Árbol de competencias del marco' })
  tree(@Param('id') id: string) {
    return this.competencies.tree(id);
  }

  @Post()
  @RequireCapability(CAP.COMPETENCY_MANAGE, { contextLevel: ContextLevel.Tenant })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCompetencyDto) {
    return this.competencies.createCompetency(user.tenantId, dto);
  }

  @Delete(':id')
  @RequireCapability(CAP.COMPETENCY_MANAGE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.competencies.removeCompetency(id);
    return { deleted: true };
  }

  @Get('courses/:courseId')
  @ApiOperation({ summary: 'Competencias vinculadas a un curso' })
  courseCompetencies(@Param('courseId') courseId: string) {
    return this.competencies.courseCompetencies(courseId);
  }

  @Post('courses/:courseId/link')
  @RequireCapability(CAP.COURSE_UPDATE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  link(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body() dto: { competencyId: string; courseModuleId?: string; ruleOutcome?: string },
  ) {
    return this.competencies.linkToCourse(
      user.tenantId,
      dto.competencyId,
      courseId,
      dto.courseModuleId,
      dto.ruleOutcome,
    );
  }

  @Delete('links/:linkId')
  @RequireCapability(CAP.COMPETENCY_MANAGE, { contextLevel: ContextLevel.Tenant })
  async unlink(@Param('linkId') linkId: string) {
    await this.competencies.unlink(linkId);
    return { deleted: true };
  }

  @Post('rate')
  @RequireCapability(CAP.COMPETENCY_GRADE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Evaluar una competencia de un usuario' })
  rate(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      userId: string;
      competencyId: string;
      proficiency: CompetencyProficiency;
      grade?: number;
      note?: string;
      courseId?: string;
    },
  ) {
    return this.competencies.rate({
      tenantId: user.tenantId,
      userId: dto.userId,
      competencyId: dto.competencyId,
      proficiency: dto.proficiency,
      grade: dto.grade ?? null,
      reviewerId: user.id,
      note: dto.note,
      courseId: dto.courseId,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Competencias del usuario actual' })
  mine(@CurrentUser() user: RequestUser) {
    return this.competencies.userCompetencies(user.id);
  }

  @Get('users/:userId')
  @RequireCapability(CAP.COMPETENCY_VIEW, { contextLevel: ContextLevel.Tenant })
  ofUser(@Param('userId') userId: string) {
    return this.competencies.userCompetencies(userId);
  }

  @Get('plans/me')
  plans(@CurrentUser() user: RequestUser) {
    return this.competencies.plans(user.id);
  }

  @Post('plans')
  @RequireCapability(CAP.COMPETENCY_PLAN_MANAGE, { contextLevel: ContextLevel.Tenant })
  createPlan(@CurrentUser() user: RequestUser, @Body() dto: CreatePlanDto) {
    return this.competencies.createPlan(user.tenantId, dto);
  }

  @Patch('plans/:id')
  @RequireCapability(CAP.COMPETENCY_PLAN_MANAGE, { contextLevel: ContextLevel.Tenant })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.competencies.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @RequireCapability(CAP.COMPETENCY_PLAN_MANAGE, { contextLevel: ContextLevel.Tenant })
  async removePlan(@Param('id') id: string) {
    await this.competencies.removePlan(id);
    return { deleted: true };
  }
}
