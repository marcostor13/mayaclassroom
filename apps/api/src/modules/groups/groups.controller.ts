import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { RequireCapability } from '../../common/decorators';
import { GroupsService } from './groups.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import {
  AutoCreateGroupsDto,
  CreateGroupDto,
  CreateGroupingDto,
  GroupMembersDto,
  UpdateGroupDto,
  UpdateGroupingDto,
} from './dto/group.dto';

@ApiTags('Grupos')
@ApiBearerAuth()
@Controller('courses/:courseId/groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly enrolments: EnrolmentsService,
  ) {}

  @Get()
  @RequireCapability(CAP.COURSE_VIEW, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Grupos del curso' })
  list(@Param('courseId') courseId: string) {
    return this.groups.list(courseId);
  }

  @Post()
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  create(@Param('courseId') courseId: string, @Body() dto: CreateGroupDto) {
    return this.groups.create(courseId, dto);
  }

  @Post('auto-create')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Crear grupos automáticamente repartiendo a los participantes' })
  async autoCreate(@Param('courseId') courseId: string, @Body() dto: AutoCreateGroupsDto) {
    const members = await this.enrolments.activeUserIds(courseId);
    return this.groups.autoCreate(courseId, members, dto);
  }

  @Patch(':groupId')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  update(@Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(groupId, dto);
  }

  @Delete(':groupId')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async remove(@Param('groupId') groupId: string) {
    await this.groups.remove(groupId);
    return { deleted: true };
  }

  @Post(':groupId/members')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  addMembers(@Param('groupId') groupId: string, @Body() dto: GroupMembersDto) {
    return this.groups.addMembers(groupId, dto.userIds);
  }

  @Delete(':groupId/members')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  removeMembers(@Param('groupId') groupId: string, @Body() dto: GroupMembersDto) {
    return this.groups.removeMembers(groupId, dto.userIds);
  }
}

@ApiTags('Grupos')
@ApiBearerAuth()
@Controller('courses/:courseId/groupings')
export class GroupingsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  @RequireCapability(CAP.COURSE_VIEW, { contextLevel: ContextLevel.Course, param: 'courseId' })
  list(@Param('courseId') courseId: string) {
    return this.groups.listGroupings(courseId);
  }

  @Post()
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  create(@Param('courseId') courseId: string, @Body() dto: CreateGroupingDto) {
    return this.groups.createGrouping(courseId, dto);
  }

  @Patch(':groupingId')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  update(@Param('groupingId') groupingId: string, @Body() dto: UpdateGroupingDto) {
    return this.groups.updateGrouping(groupingId, dto);
  }

  @Delete(':groupingId')
  @RequireCapability(CAP.GROUP_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async remove(@Param('groupingId') groupingId: string) {
    await this.groups.removeGrouping(groupingId);
    return { deleted: true };
  }
}
