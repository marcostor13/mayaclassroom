import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { AllowInDemo, CurrentUser, RequireCapability } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';
import type { RequestUser } from '../../common/types/request-context';
import { CohortsService } from './cohorts.service';
import {
  CohortMembersDto,
  CreateCohortDto,
  SyncCohortDto,
  UpdateCohortDto,
} from './dto/cohort.dto';

@ApiTags('Cohortes')
@ApiBearerAuth()
@AllowInDemo()
@Controller('cohorts')
export class CohortsController {
  constructor(private readonly cohorts: CohortsService) {}

  @Get()
  @RequireCapability(CAP.COHORT_VIEW, { contextLevel: ContextLevel.Tenant })
  list(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    return this.cohorts.paginate(user.tenantId, query);
  }

  @Post()
  @RequireCapability(CAP.COHORT_MANAGE, { contextLevel: ContextLevel.Tenant })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCohortDto) {
    return this.cohorts.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequireCapability(CAP.COHORT_MANAGE, { contextLevel: ContextLevel.Tenant })
  update(@Param('id') id: string, @Body() dto: UpdateCohortDto) {
    return this.cohorts.update(id, dto);
  }

  @Delete(':id')
  @RequireCapability(CAP.COHORT_MANAGE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.cohorts.remove(id);
    return { deleted: true };
  }

  @Get(':id/members')
  @RequireCapability(CAP.COHORT_VIEW, { contextLevel: ContextLevel.Tenant })
  members(@Param('id') id: string) {
    return this.cohorts.members(id);
  }

  @Post(':id/members')
  @RequireCapability(CAP.COHORT_ASSIGN, { contextLevel: ContextLevel.Tenant })
  addMembers(@Param('id') id: string, @Body() dto: CohortMembersDto) {
    return this.cohorts.addMembers(id, dto.userIds);
  }

  @Delete(':id/members')
  @RequireCapability(CAP.COHORT_ASSIGN, { contextLevel: ContextLevel.Tenant })
  removeMembers(@Param('id') id: string, @Body() dto: CohortMembersDto) {
    return this.cohorts.removeMembers(id, dto.userIds);
  }

  @Post(':id/sync/:courseId')
  @RequireCapability(CAP.ENROL_ENROL_USERS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Matricular la cohorte completa en un curso' })
  sync(
    @Param('id') id: string,
    @Param('courseId') courseId: string,
    @Body() dto: SyncCohortDto,
  ) {
    return this.cohorts.syncToCourse(id, courseId, dto.roleShortName ?? 'student');
  }
}
