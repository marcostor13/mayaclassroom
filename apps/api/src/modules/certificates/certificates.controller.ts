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
  @Get(':code/render')
  @ApiOperation({ summary: 'Certificado imprimible en HTML' })
  async render(@Param('code') code: string, @Res() res: Response) {
    const app = this.config.getOrThrow<AppConfig>('app');
    const html = await this.certificates.render(code, app.webUrl);
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
  @RequireCapability(CAP.TENANT_UPDATE, { contextLevel: ContextLevel.Tenant })
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
  @RequireCapability(CAP.GRADE_EDIT, { contextLevel: ContextLevel.Course, param: 'courseId' })
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
  @ApiOperation({ summary: 'Solicitar el propio certificado del curso completado' })
  claim(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.certificates.issue({
      tenantId: user.tenantId,
      courseId,
      userId: user.id,
    });
  }
}
