import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';
import { RequestUser } from '../../common/types/request-context';
import { CohortsService } from './cohorts.service';

@ApiTags('Cohortes')
@ApiBearerAuth()
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
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: { name: string; idNumber?: string; description?: string; visible?: boolean },
  ) {
    return this.cohorts.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequireCapability(CAP.COHORT_MANAGE, { contextLevel: ContextLevel.Tenant })
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; idNumber?: string; description?: string; visible?: boolean },
  ) {
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
  addMembers(@Param('id') id: string, @Body('userIds') userIds: string[]) {
    return this.cohorts.addMembers(id, userIds);
  }

  @Delete(':id/members')
  @RequireCapability(CAP.COHORT_ASSIGN, { contextLevel: ContextLevel.Tenant })
  removeMembers(@Param('id') id: string, @Body('userIds') userIds: string[]) {
    return this.cohorts.removeMembers(id, userIds);
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
    @Body('roleShortName') roleShortName?: string,
  ) {
    return this.cohorts.syncToCourse(id, courseId, roleShortName ?? 'student');
  }
}
