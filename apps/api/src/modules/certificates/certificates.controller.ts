import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, Public, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CertificatesService } from './certificates.service';
import { AppConfig } from '../../config';
import {
  CreateCertificateTemplateDto,
  IssueCertificateDto,
} from './dto/certificate.dto';

@ApiTags('Certificados')
@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly certificates: CertificatesService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verificación pública de un certificado' })
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }

  @Public()
  @Get(':code/view')
  @ApiOperation({ summary: 'Certificado para consultarlo en línea' })
  async view(@Param('code') code: string, @Res() res: Response) {
    const app = this.config.getOrThrow<AppConfig>('app');
    const html = await this.certificates.render(code, app.webUrl, false);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Public()
  @Get(':code/render')
  @ApiOperation({ summary: 'Certificado imprimible en HTML' })
  async render(@Param('code') code: string, @Res() res: Response) {
    const app = this.config.getOrThrow<AppConfig>('app');
    const html = await this.certificates.render(code, app.webUrl, true);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @ApiBearerAuth()
  @Get('templates')
  templates(@CurrentUser() user: RequestUser) {
    return this.certificates.templates(user.tenantId);
  }

  @ApiBearerAuth()
  @Post('templates')
  @RequireCapability(CAP.CERTIFICATE_MANAGE, { contextLevel: ContextLevel.Tenant })
  createTemplate(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCertificateTemplateDto,
  ) {
    return this.certificates.createTemplate(user.tenantId, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  mine(@CurrentUser() user: RequestUser) {
    return this.certificates.userCertificates(user.id);
  }

  @ApiBearerAuth()
  @Post('courses/:courseId/issue/:userId')
  @RequireCapability(CAP.CERTIFICATE_ISSUE, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Emitir un certificado a un alumno' })
  issue(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Param('userId') userId: string,
    @Body() dto: IssueCertificateDto,
  ) {
    return this.certificates.issue({
      tenantId: user.tenantId,
      templateId: dto.templateId,
      courseId,
      userId,
    });
  }

  @ApiBearerAuth()
  @Post('courses/:courseId/claim')
  @ApiOperation({ summary: 'Solicitar el propio certificado del curso superado' })
  claim(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.certificates.claim(user.tenantId, courseId, user.id);
  }

  @ApiBearerAuth()
  @Get('courses/:courseId/me')
  @ApiOperation({ summary: 'Certificado propio de un curso, si ya está expedido' })
  mineForCourse(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.certificates.forCourseAndUser(courseId, user.id);
  }

  @ApiBearerAuth()
  @Get('courses/:courseId')
  @RequireCapability(CAP.CERTIFICATE_ISSUE, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Certificados expedidos de un curso' })
  courseCertificates(@Param('courseId') courseId: string) {
    return this.certificates.courseCertificates(courseId);
  }

  @ApiBearerAuth()
  @Post(':code/revoke')
  @RequireCapability(CAP.CERTIFICATE_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Anular un certificado sin borrarlo' })
  revoke(@Param('code') code: string, @Body('reason') reason: string) {
    return this.certificates.revoke(code, reason ?? 'Anulado por la administración');
  }
}
