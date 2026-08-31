import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel, CustomFieldScope, CustomFieldType } from '@maya/shared';
import { CurrentUser, PlatformAdminOnly, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CustomFieldsService } from './custom-fields.service';
import { TagsService } from './tags.service';
import { WebServicesService } from './web-services.service';
import { GdprService } from './gdpr.service';
import { BackupService } from './backup.service';
import { AnalyticsService } from './analytics.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { ContextsService } from '../contexts/contexts.service';

@ApiTags('Campos personalizados')
@ApiBearerAuth()
@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly fields: CustomFieldsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('scope') scope?: CustomFieldScope) {
    return this.fields.list(user.tenantId, scope);
  }

  @Post()
  @RequireCapability(CAP.CUSTOMFIELD_MANAGE, { contextLevel: ContextLevel.Tenant })
  create(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      scope: CustomFieldScope;
      shortName: string;
      name: string;
      type: CustomFieldType;
      categoryName?: string;
      required?: boolean;
      options?: string[];
    },
  ) {
    return this.fields.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequireCapability(CAP.CUSTOMFIELD_MANAGE, { contextLevel: ContextLevel.Tenant })
  update(@Param('id') id: string, @Body() dto: Record<string, never>) {
    return this.fields.update(id, dto);
  }

  @Delete(':id')
  @RequireCapability(CAP.CUSTOMFIELD_MANAGE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.fields.remove(id);
    return { deleted: true };
  }
}

@ApiTags('Etiquetas y comentarios')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(
    private readonly tags: TagsService,
    private readonly contexts: ContextsService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('search') search?: string) {
    return this.tags.list(user.tenantId, search);
  }

  @Patch(':id/standard')
  @RequireCapability(CAP.TAG_MANAGE, { contextLevel: ContextLevel.Tenant })
  setStandard(@Param('id') id: string, @Body('isStandard') isStandard: boolean) {
    return this.tags.setStandard(id, isStandard);
  }

  @Delete(':id')
  @RequireCapability(CAP.TAG_MANAGE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.tags.remove(id);
    return { deleted: true };
  }

  @Get('comments/:component/:itemId')
  comments(@Param('component') component: string, @Param('itemId') itemId: string) {
    return this.tags.comments(component, itemId);
  }

  @Post('comments/:component/:itemId')
  @ApiOperation({ summary: 'Publicar un comentario' })
  async addComment(
    @CurrentUser() user: RequestUser,
    @Param('component') component: string,
    @Param('itemId') itemId: string,
    @Body('content') content: string,
  ) {
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, user.tenantId);
    return this.tags.addComment({
      tenantId: user.tenantId,
      contextId: context._id,
      component,
      itemId,
      userId: user.id,
      content,
    });
  }

  @Delete('comments/:id')
  async removeComment(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.tags.removeComment(
      id,
      user.capabilities.includes(CAP.COMMENT_DELETE) ? undefined : user.id,
    );
    return { deleted: true };
  }
}

@ApiTags('Servicios web')
@ApiBearerAuth()
@Controller('web-services')
export class WebServicesController {
  constructor(private readonly services: WebServicesService) {}

  @Get('tokens')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  tokens(@CurrentUser() user: RequestUser) {
    return this.services.tokens(user.tenantId);
  }

  @Post('tokens')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Crear un token; el valor solo se muestra una vez' })
  createToken(
    @CurrentUser() user: RequestUser,
    @Body() dto: { name: string; scopes?: string[]; expiresAt?: string },
  ) {
    return this.services.createToken(user.tenantId, user.id, dto);
  }

  @Delete('tokens/:id')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  async revoke(@Param('id') id: string) {
    await this.services.revokeToken(id);
    return { revoked: true };
  }

  @Get('webhooks')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  webhooks(@CurrentUser() user: RequestUser) {
    return this.services.webhooks(user.tenantId);
  }

  @Post('webhooks')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  createWebhook(
    @CurrentUser() user: RequestUser,
    @Body() dto: { name: string; url: string; events: string[]; secret?: string },
  ) {
    return this.services.createWebhook(user.tenantId, dto);
  }

  @Delete('webhooks/:id')
  @RequireCapability(CAP.TENANT_MANAGE_WEBSERVICES, { contextLevel: ContextLevel.Tenant })
  async removeWebhook(@Param('id') id: string) {
    await this.services.removeWebhook(id);
    return { deleted: true };
  }
}

@ApiTags('Privacidad (RGPD)')
@ApiBearerAuth()
@Controller('privacy')
export class GdprController {
  constructor(private readonly gdpr: GdprService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Solicitar exportación o eliminación de los datos propios' })
  request(
    @CurrentUser() user: RequestUser,
    @Body() dto: { requestType: 'export' | 'delete'; comment?: string },
  ) {
    return this.gdpr.request(user.tenantId, user.id, dto.requestType, dto.comment);
  }

  @Get('requests/me')
  myRequests(@CurrentUser() user: RequestUser) {
    return this.gdpr.myRequests(user.id);
  }

  @Get('requests')
  @RequireCapability(CAP.GDPR_MANAGE_REQUESTS, { contextLevel: ContextLevel.Tenant })
  list(@CurrentUser() user: RequestUser) {
    return this.gdpr.list(user.tenantId);
  }

  @Patch('requests/:id')
  @RequireCapability(CAP.GDPR_MANAGE_REQUESTS, { contextLevel: ContextLevel.Tenant })
  resolve(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('status') status: 'approved' | 'rejected',
  ) {
    return this.gdpr.resolve(id, status, user.id);
  }

  @Get('export')
  @ApiOperation({ summary: 'Descargar los datos personales propios' })
  async export(@CurrentUser() user: RequestUser, @Res() res: Response) {
    const data = await this.gdpr.exportData(user.id);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-maya.json"');
    res.send(JSON.stringify(data, null, 2));
  }
}

@ApiTags('Copias de seguridad')
@ApiBearerAuth()
@Controller('backups')
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  @RequireCapability(CAP.BACKUP_COURSE, { contextLevel: ContextLevel.Tenant })
  list(@CurrentUser() user: RequestUser, @Query('courseId') courseId?: string) {
    return this.backups.list(user.tenantId, courseId);
  }

  @Post('courses/:courseId')
  @RequireCapability(CAP.BACKUP_COURSE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Crear una copia de seguridad del curso' })
  create(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body('includeUsers') includeUsers?: boolean,
  ) {
    return this.backups.create({
      tenantId: user.tenantId,
      courseId,
      userId: user.id,
      includeUsers,
    });
  }

  @Get(':id/download')
  @RequireCapability(CAP.BACKUP_DOWNLOAD, { contextLevel: ContextLevel.Tenant })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { filename, data } = await this.backups.download(id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  }

  @Post(':id/restore')
  @RequireCapability(CAP.RESTORE_COURSE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Restaurar la copia en un curso nuevo' })
  restore(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: { categoryId: string; shortName: string; fullName: string },
  ) {
    return this.backups.restore({
      tenantId: user.tenantId,
      backupId: id,
      userId: user.id,
      ...dto,
    });
  }

  @Post('import')
  @RequireCapability(CAP.COURSE_IMPORT, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Importar el contenido de un curso en otro' })
  importInto(
    @CurrentUser() user: RequestUser,
    @Body() dto: { sourceCourseId: string; targetCourseId: string },
  ) {
    return this.backups.importInto({
      tenantId: user.tenantId,
      sourceCourseId: dto.sourceCourseId,
      targetCourseId: dto.targetCourseId,
      userId: user.id,
    });
  }

  @Delete(':id')
  @RequireCapability(CAP.BACKUP_COURSE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.backups.remove(id);
    return { deleted: true };
  }
}

@ApiTags('Analíticas')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly tasks: ScheduledTasksService,
  ) {}

  @Get('courses/:courseId')
  @RequireCapability(CAP.REPORT_VIEW_COURSE, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  @ApiOperation({ summary: 'Analíticas del curso con indicadores de riesgo' })
  course(@Param('courseId') courseId: string) {
    return this.analytics.courseOverview(courseId);
  }

  @Get('tenant')
  @RequireCapability(CAP.TENANT_VIEW_REPORTS, { contextLevel: ContextLevel.Tenant })
  tenant(@CurrentUser() user: RequestUser) {
    return this.analytics.tenantOverview(user.tenantId);
  }

  @Get('tasks')
  @PlatformAdminOnly()
  @ApiOperation({ summary: 'Estado de las tareas programadas' })
  tasksStatus(@CurrentUser() user: RequestUser) {
    return this.tasks.list(user.tenantId);
  }
}
