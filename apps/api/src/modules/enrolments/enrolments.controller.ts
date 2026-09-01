import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { EnrolmentsService } from './enrolments.service';
import {
  CreateEnrolmentMethodDto,
  EnrolUsersDto,
  EnrolmentQueryDto,
  SelfEnrolDto,
  UpdateEnrolmentDto,
  UpdateEnrolmentMethodDto,
} from './dto/enrolment.dto';

@ApiTags('Matriculación')
@ApiBearerAuth()
@Controller('courses/:courseId/enrolments')
export class EnrolmentsController {
  constructor(private readonly enrolments: EnrolmentsService) {}

  @Get()
  @RequireCapability(CAP.COURSE_VIEW_PARTICIPANTS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Participantes del curso' })
  participants(@Param('courseId') courseId: string, @Query() query: EnrolmentQueryDto) {
    return this.enrolments.participants(courseId, query);
  }

  @Post()
  @RequireCapability(CAP.ENROL_ENROL_USERS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Matricular usuarios manualmente' })
  enrol(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body() dto: EnrolUsersDto,
  ) {
    return this.enrolments.enrolMany(courseId, user.tenantId, dto, user.id);
  }

  @Post('self')
  @ApiOperation({ summary: 'Automatricularse en el curso' })
  selfEnrol(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body() dto: SelfEnrolDto,
  ) {
    return this.enrolments.selfEnrol(courseId, user.tenantId, user.id, dto);
  }

  @Delete('self')
  @ApiOperation({ summary: 'Darse de baja del curso' })
  async selfUnenrol(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    await this.enrolments.unenrol(courseId, user.id, user.id);
    return { unenrolled: true };
  }

  @Patch(':enrolmentId')
  @RequireCapability(CAP.ENROL_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  update(@Param('enrolmentId') enrolmentId: string, @Body() dto: UpdateEnrolmentDto) {
    return this.enrolments.update(enrolmentId, dto);
  }

  @Delete('users/:userId')
  @RequireCapability(CAP.ENROL_UNENROL_USERS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  async unenrol(
    @CurrentUser() actor: RequestUser,
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
  ) {
    await this.enrolments.unenrol(courseId, userId, actor.id);
    return { unenrolled: true };
  }

  @Get('methods')
  @RequireCapability(CAP.ENROL_CONFIG, { contextLevel: ContextLevel.Course, param: 'courseId' })
  methods(@Param('courseId') courseId: string) {
    return this.enrolments.listMethods(courseId);
  }

  @Post('methods')
  @RequireCapability(CAP.ENROL_CONFIG, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async createMethod(@Param('courseId') courseId: string, @Body() dto: CreateEnrolmentMethodDto) {
    return this.enrolments.methodToDto(await this.enrolments.createMethod(courseId, dto));
  }

  @Patch('methods/:methodId')
  @RequireCapability(CAP.ENROL_CONFIG, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async updateMethod(@Param('methodId') methodId: string, @Body() dto: UpdateEnrolmentMethodDto) {
    return this.enrolments.methodToDto(await this.enrolments.updateMethod(methodId, dto));
  }

  @Delete('methods/:methodId')
  @RequireCapability(CAP.ENROL_CONFIG, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async removeMethod(@Param('methodId') methodId: string) {
    await this.enrolments.removeMethod(methodId);
    return { deleted: true };
  }
}
