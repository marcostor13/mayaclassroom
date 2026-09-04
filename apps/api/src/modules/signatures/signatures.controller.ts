import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { SignaturesService } from './signatures.service';
import { SaveSignatureDto, SignRecordDto } from './dto/signature.dto';

@ApiTags('Firma electrónica')
@ApiBearerAuth()
@Controller('signatures')
export class SignaturesController {
  constructor(private readonly signatures: SignaturesService) {}

  /**
   * Contexto de la petición, que se guarda con la firma.
   *
   * Sin él, una firma es solo una imagen; con la dirección y el navegador desde
   * los que se estampó, se puede responder a una reclamación.
   */
  private context(request: Request) {
    return {
      ip: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Firma registrada del usuario' })
  mine(@CurrentUser() user: RequestUser) {
    return this.signatures.mine(user.tenantId, user.id);
  }

  @Put('me')
  @RequireCapability(CAP.SIGNATURE_MANAGE_OWN, { contextLevel: ContextLevel.System })
  @ApiOperation({ summary: 'Registrar o sustituir la firma propia' })
  save(
    @CurrentUser() user: RequestUser,
    @Body() dto: SaveSignatureDto,
    @Req() request: Request,
  ) {
    return this.signatures.save(user.tenantId, user.id, dto, this.context(request));
  }

  @Delete('me')
  @RequireCapability(CAP.SIGNATURE_MANAGE_OWN, { contextLevel: ContextLevel.System })
  async remove(@CurrentUser() user: RequestUser) {
    await this.signatures.remove(user.tenantId, user.id);
    return { deleted: true };
  }

  @Post('records')
  @RequireCapability(CAP.SIGNATURE_MANAGE_OWN, { contextLevel: ContextLevel.System })
  @ApiOperation({ summary: 'Firmar una asistencia o una visualización' })
  sign(
    @CurrentUser() user: RequestUser,
    @Body() dto: SignRecordDto,
    @Req() request: Request,
  ) {
    return this.signatures.sign(user.tenantId, user.id, dto, this.context(request));
  }

  @Get('records/me')
  @ApiOperation({ summary: 'Firmas propias ya estampadas' })
  async myRecords(@CurrentUser() user: RequestUser) {
    const records = await this.signatures.recordsOfUser(user.tenantId, user.id);
    return records.map((record) => this.signatures.recordToDto(record));
  }

  @Get('users/:userId')
  @RequireCapability(CAP.SIGNATURE_VIEW_ALL, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Firma registrada de un alumno' })
  async ofUser(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    const signature = await this.signatures.findOfUser(user.tenantId, userId);
    if (!signature) return null;
    return {
      ...this.signatures.toDto(signature),
      // Se comprueba al entregarla: si el sello no cuadra, el trazo se tocó en
      // la base de datos y quien lo consulte tiene que saberlo.
      valid: this.signatures.verify(signature),
    };
  }

  @Get('courses/:courseId/records')
  @RequireCapability(CAP.SIGNATURE_VIEW_ALL, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Acta de firmas de un curso' })
  async courseRecords(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Query('referenceId') referenceId?: string,
  ) {
    const records = await this.signatures.recordsOfCourse(user.tenantId, courseId, referenceId);
    return records.map((record) => this.signatures.recordToDto(record));
  }
}
