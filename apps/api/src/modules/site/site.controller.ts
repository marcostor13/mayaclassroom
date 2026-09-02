import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel, EnrolmentRequestStatus, LogAction } from '@maya/shared';
import type { EnrolmentRequestDto } from '@maya/shared';
import { Audit, CurrentUser, Public, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { SiteService } from './site.service';
import { CreateEnrolmentRequestDto, ResolveRequestDto, UpdateSiteDto } from './dto/site.dto';

@ApiTags('Página pública')
@Controller('site')
export class SiteController {
  constructor(private readonly site: SiteService) {}

  /* --------------------------------- Público ------------------------------ */

  @Public()
  @Get('public/:slug')
  @ApiOperation({ summary: 'Página pública de una empresa con su catálogo' })
  publicSite(@Param('slug') slug: string) {
    return this.site.publicSite(slug);
  }

  @Public()
  // Sin sesión detrás y con envío de correo por medio: el límite evita que la
  // página se convierta en un formulario para inundar buzones ajenos.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/:slug/requests')
  @ApiOperation({ summary: 'Solicitar plaza en un curso desde la página pública' })
  request(@Param('slug') slug: string, @Body() dto: CreateEnrolmentRequestDto) {
    return this.site.createRequest(slug, dto);
  }

  /* ------------------------------ Administración -------------------------- */

  @Get()
  @ApiBearerAuth()
  @RequireCapability(CAP.SITE_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Página de la empresa propia (se crea si no existía)' })
  async mine(@CurrentUser() user: RequestUser) {
    return this.site.toDto(await this.site.forTenant(user.tenantId));
  }

  @Patch()
  @ApiBearerAuth()
  @RequireCapability(CAP.SITE_MANAGE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'site')
  @ApiOperation({ summary: 'Guardar el diseño y el contenido de la página' })
  async update(@CurrentUser() user: RequestUser, @Body() dto: UpdateSiteDto) {
    return this.site.toDto(await this.site.update(user.tenantId, dto));
  }

  @Get('requests')
  @ApiBearerAuth()
  @RequireCapability(CAP.SITE_MANAGE_REQUESTS, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Solicitudes de plaza recibidas' })
  requests(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: EnrolmentRequestStatus,
  ): Promise<EnrolmentRequestDto[]> {
    return this.site.listRequests(user.tenantId, status);
  }

  @Patch('requests/:id')
  @ApiBearerAuth()
  @RequireCapability(CAP.SITE_MANAGE_REQUESTS, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Updated, 'enrolment-request')
  @ApiOperation({
    summary: 'Aprobar o rechazar una solicitud',
    description: 'Al aprobar se crea la cuenta si no existía y se matricula en el curso.',
  })
  resolve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ResolveRequestDto,
  ): Promise<EnrolmentRequestDto> {
    return this.site.resolveRequest(user.tenantId, id, dto);
  }
}
