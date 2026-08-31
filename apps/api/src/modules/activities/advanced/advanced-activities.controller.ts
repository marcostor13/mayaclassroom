import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import type { RequestUser } from '../../../common/types/request-context';
import { AdvancedActivitiesService } from './advanced-activities.service';
import { CoursesService } from '../../courses/courses.service';

/**
 * Endpoints genéricos de las actividades avanzadas. El campo `entryType`
 * distingue páginas de lección, entradas de glosario, páginas de wiki,
 * entregas de taller, registros de base de datos, etc.
 */
@ApiTags('Actividades avanzadas')
@ApiBearerAuth()
@Controller('mod/advanced')
export class AdvancedActivitiesController {
  constructor(
    private readonly advanced: AdvancedActivitiesService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver una actividad avanzada con su estructura' })
  async detail(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const activity = await this.advanced.getActivity(module.instance);
    return { module, activity };
  }

  @Get(':moduleId/entries')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Entradas de la actividad (páginas, aportaciones, entregas…)' })
  async entries(
    @Param('moduleId') moduleId: string,
    @Query('entryType') entryType = 'entry',
    @Query('mine') mine?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.advanced.entries(module.instance, entryType, {
      userId: mine === 'true' ? user?.id : undefined,
    });
  }

  @Post(':moduleId/entries')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Crear una entrada en la actividad' })
  async addEntry(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body()
    dto: {
      entryType: string;
      title?: string;
      content?: string;
      data?: Record<string, unknown>;
      fileIds?: string[];
      parentId?: string;
      structural?: boolean;
    },
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.advanced.addEntry({
      activityId: module.instance,
      entryType: dto.entryType,
      userId: dto.structural ? null : user.id,
      title: dto.title ?? null,
      content: dto.content ?? null,
      data: dto.data,
      fileIds: dto.fileIds,
      parentId: dto.parentId ?? null,
    });
  }

  @Patch(':moduleId/entries/:entryId')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  updateEntry(
    @Param('entryId') entryId: string,
    @Body()
    dto: {
      title?: string;
      content?: string;
      data?: Record<string, unknown>;
      approved?: boolean;
      sortOrder?: number;
    },
  ) {
    return this.advanced.updateEntry(entryId, dto);
  }

  @Delete(':moduleId/entries/:entryId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async removeEntry(@Param('entryId') entryId: string) {
    await this.advanced.removeEntry(entryId);
    return { deleted: true };
  }

  @Post(':moduleId/entries/:entryId/grade')
  @RequireCapability(CAP.GRADE_EDIT, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Calificar una entrada' })
  grade(
    @CurrentUser() user: RequestUser,
    @Param('entryId') entryId: string,
    @Body('grade') grade: number,
  ) {
    return this.advanced.gradeEntry(entryId, grade, user.id);
  }
}
