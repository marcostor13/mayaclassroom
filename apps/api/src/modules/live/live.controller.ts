import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel, LogAction } from '@maya/shared';
import { Audit, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { LiveRequester, LiveService } from './live.service';
import { LiveBoardService } from './live-board.service';
import { LiveRecordingsService } from './live-recordings.service';
import { LivePresenceService } from './live-presence.service';
import {
  CreateLiveSessionDto,
  FinishRecordingDto,
  LiveSessionQueryDto,
  StartRecordingDto,
  UpdateLiveSessionDto,
  UpdateRecordingDto,
} from './dto/live.dto';

/** El usuario de la petición, en la forma que espera el servicio. */
const requester = (user: RequestUser): LiveRequester => ({
  id: user.id,
  tenantId: user.tenantId,
  isPlatformAdmin: user.isPlatformAdmin,
  capabilities: user.capabilities,
});

@ApiTags('Aulas en vivo')
@ApiBearerAuth()
@Controller('live')
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly board: LiveBoardService,
    private readonly recordings: LiveRecordingsService,
    private readonly presence: LivePresenceService,
  ) {}

  /* ------------------------------- Consulta ------------------------------ */

  @Get('ice-servers')
  @ApiOperation({
    summary: 'Servidores STUN/TURN para negociar la conexión',
    description:
      'Las credenciales TURN son temporales y se emiten para quien las pide, ' +
      'así que la respuesta no se puede cachear ni compartir.',
  })
  iceServers(@CurrentUser() user: RequestUser) {
    return this.live.iceConfig(user.id);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Reuniones y clases en vivo visibles' })
  async list(@CurrentUser() user: RequestUser, @Query() query: LiveSessionQueryDto) {
    const sessions = await this.live.list(requester(user), query);
    return this.live.toDtos(sessions, requester(user));
  }

  @Get('sessions/:ref')
  @ApiOperation({ summary: 'Detalle de una sesión por identificador o código de sala' })
  async detail(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    return this.live.toDto(session, requester(user));
  }

  @Get('sessions/:ref/participants')
  @ApiOperation({ summary: 'Quién está conectado a la sala ahora mismo' })
  async participants(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    return this.presence.participants(session.id);
  }

  @Get('sessions/:ref/attendance')
  @ApiOperation({ summary: 'Informe de asistencia de la sesión' })
  async attendance(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    await this.live.requireManage(requester(user), session);
    return this.live.attendance(session);
  }

  @Get('sessions/:ref/board')
  @ApiOperation({ summary: 'Estado guardado de la pizarra' })
  async boardState(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    return this.board.state(session.id, session.tenant);
  }

  @Get('sessions/:ref/chat')
  @ApiOperation({ summary: 'Historial del chat de la sala' })
  async chat(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    return this.live.chatHistory(session);
  }

  /* ------------------------------- Creación ------------------------------ */

  @Post('sessions')
  @RequireCapability(CAP.LIVE_CREATE)
  @Audit(LogAction.Created, 'live_session', 'Reunión en vivo creada')
  @ApiOperation({
    summary: 'Convocar una reunión de empresa',
    description:
      'Para una clase de un curso concreto, use `POST /live/courses/:courseId/sessions`: ' +
      'ahí el permiso se evalúa en el curso, que es donde el profesorado lo tiene.',
  })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateLiveSessionDto) {
    const session = await this.live.create(requester(user), dto);
    return this.live.toDto(session, requester(user));
  }

  @Post('courses/:courseId/sessions')
  @RequireCapability(CAP.LIVE_CREATE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @Audit(LogAction.Created, 'live_session', 'Clase en vivo creada')
  @ApiOperation({ summary: 'Convocar una clase en vivo dentro de un curso' })
  async createForCourse(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateLiveSessionDto,
  ) {
    const session = await this.live.create(requester(user), { ...dto, courseId });
    return this.live.toDto(session, requester(user));
  }

  @Patch('sessions/:id')
  @Audit(LogAction.Updated, 'live_session')
  @ApiOperation({ summary: 'Editar una sesión en vivo' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateLiveSessionDto,
  ) {
    const session = await this.live.update(requester(user), id, dto);
    return this.live.toDto(session, requester(user));
  }

  @Delete('sessions/:id')
  @Audit(LogAction.Deleted, 'live_session')
  @ApiOperation({ summary: 'Cancelar una sesión en vivo' })
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.live.remove(requester(user), id);
    return { deleted: true };
  }

  @Post('sessions/:id/end')
  @ApiOperation({ summary: 'Dar por terminada la sesión' })
  async end(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const session = await this.live.findById(id, user.tenantId);
    await this.live.requireManage(requester(user), session);
    await this.live.markEnded(session);
    return this.live.toDto(session, requester(user));
  }

  @Post('sessions/:id/board/reset')
  @ApiOperation({ summary: 'Vaciar la pizarra de la sesión' })
  async resetBoard(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const session = await this.live.findById(id, user.tenantId);
    await this.live.requireManage(requester(user), session);
    return this.board.reset(session.id, session.tenant);
  }

  /* ------------------------------ Grabaciones ---------------------------- */

  @Get('recordings')
  @ApiOperation({ summary: 'Biblioteca de grabaciones visibles' })
  library(@CurrentUser() user: RequestUser) {
    return this.recordings.library(requester(user));
  }

  @Get('sessions/:ref/recordings')
  @ApiOperation({ summary: 'Grabaciones de una sesión' })
  async sessionRecordings(@CurrentUser() user: RequestUser, @Param('ref') ref: string) {
    const session = await this.live.findByRef(ref, user.tenantId);
    return this.recordings.listBySession(requester(user), session);
  }

  @Post('sessions/:id/recordings')
  @Audit(LogAction.Created, 'live_recording', 'Grabación iniciada')
  @ApiOperation({ summary: 'Abrir una grabación y recibir su identificador' })
  async startRecording(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: StartRecordingDto,
  ) {
    const session = await this.live.findById(id, user.tenantId);
    const recording = await this.recordings.start(requester(user), session, dto);
    return this.recordings.toDto(recording, requester(user), session, true);
  }

  @Post('recordings/:id/chunks')
  @UseInterceptors(FileInterceptor('chunk'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        chunk: { type: 'string', format: 'binary' },
        index: { type: 'integer' },
      },
    },
  })
  @ApiOperation({
    summary: 'Enviar un trozo de la grabación en curso',
    description:
      'El navegador que graba envía trozos numerados y consecutivos; el ' +
      'servidor los guarda y los une al cerrar la grabación.',
  })
  async uploadChunk(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('index') index: string,
    @UploadedFile() chunk?: Express.Multer.File,
  ) {
    if (!chunk?.buffer?.length) throw new BadRequestException('No se ha recibido ningún trozo.');
    return this.recordings.appendChunk(requester(user), id, Number(index), chunk.buffer);
  }

  @Post('recordings/:id/finish')
  @ApiOperation({ summary: 'Cerrar la grabación y publicarla' })
  finishRecording(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: FinishRecordingDto,
  ) {
    return this.recordings.finish(requester(user), id, dto);
  }

  @Post('recordings/:id/abort')
  @ApiOperation({ summary: 'Descartar una grabación a medias' })
  async abortRecording(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.recordings.abort(requester(user), id);
    return { aborted: true };
  }

  @Patch('recordings/:id')
  @Audit(LogAction.Updated, 'live_recording')
  @ApiOperation({ summary: 'Renombrar o publicar una grabación' })
  updateRecording(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecordingDto,
  ) {
    return this.recordings.update(requester(user), id, dto);
  }

  @Delete('recordings/:id')
  @Audit(LogAction.Deleted, 'live_recording')
  @ApiOperation({ summary: 'Eliminar una grabación' })
  async removeRecording(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.recordings.remove(requester(user), id);
    return { deleted: true };
  }

  @Get('recordings/:id/media')
  @ApiOperation({
    summary: 'Descargar o reproducir la grabación',
    description:
      'Se sirve entera y con `Accept-Ranges: none`: el vídeo sale del ' +
      'almacenamiento privado y no admite peticiones por rangos.',
  })
  async media(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { recording, data } = await this.recordings.download(requester(user), id);
    res.setHeader('Content-Type', recording.mimeType);
    res.setHeader('Content-Length', String(data.length));
    res.setHeader('Content-Disposition', `inline; filename="${recording.id}.webm"`);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(data);
  }
}
