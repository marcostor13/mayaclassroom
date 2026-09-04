import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { MediaProgressService } from './media-progress.service';
import { MediaHeartbeatDto } from './dto/media-progress.dto';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { UsersService } from '../users/users.service';

@ApiTags('Seguimiento de vídeo')
@ApiBearerAuth()
@Controller('media-progress')
export class MediaProgressController {
  constructor(
    private readonly media: MediaProgressService,
    private readonly enrolments: EnrolmentsService,
    private readonly users: UsersService,
  ) {}

  @Post('modules/:moduleId/play')
  @RequireCapability(CAP.MEDIA_TRACK_OWN, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Anotar que se ha abierto un vídeo' })
  play(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: MediaHeartbeatDto,
  ) {
    return this.media.registerPlay(user.tenantId, moduleId, user.id, {
      mediaId: dto.mediaId,
      kind: dto.kind,
      title: dto.title ?? null,
      durationSeconds: dto.durationSeconds,
    });
  }

  @Post('modules/:moduleId/heartbeat')
  @RequireCapability(CAP.MEDIA_TRACK_OWN, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Registrar lo reproducido desde el latido anterior' })
  heartbeat(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: MediaHeartbeatDto,
  ) {
    return this.media.heartbeat(user.tenantId, moduleId, user.id, {
      mediaId: dto.mediaId,
      kind: dto.kind,
      title: dto.title ?? null,
      durationSeconds: dto.durationSeconds,
      positionSeconds: dto.positionSeconds,
      deltaSeconds: dto.deltaSeconds,
    });
  }

  @Get('modules/:moduleId/me')
  @ApiOperation({ summary: 'Avance propio en los vídeos de una actividad' })
  mineInModule(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    return this.media.forModule(moduleId, user.id);
  }

  @Get('courses/:courseId/me')
  @ApiOperation({ summary: 'Avance propio en los vídeos del curso' })
  mineInCourse(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.media.forUser(courseId, user.id);
  }

  @Get('courses/:courseId/users/:userId')
  @RequireCapability(CAP.MEDIA_VIEW_REPORTS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Avance de un alumno concreto' })
  ofUser(@Param('courseId') courseId: string, @Param('userId') userId: string) {
    return this.media.forUser(courseId, userId);
  }

  @Get('courses/:courseId/report')
  @RequireCapability(CAP.MEDIA_VIEW_REPORTS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Informe de visualización de todo el alumnado' })
  async report(@Param('courseId') courseId: string) {
    const participants = await this.enrolments.activeUserIds(courseId);
    const users = await this.users.findManyByIds(participants);
    return this.media.courseReport(
      courseId,
      users.map((u) => ({
        id: u.id,
        fullName: `${u.firstName} ${u.lastName}`.trim(),
        email: u.email,
        avatarUrl: u.avatarUrl ?? null,
      })),
    );
  }

  @Get('courses/:courseId/videos')
  @RequireCapability(CAP.MEDIA_VIEW_REPORTS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Vídeos medibles del curso' })
  videos(@Param('courseId') courseId: string) {
    return this.media.courseVideos(courseId);
  }
}
