import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { RequireCapability } from '../../../common/decorators';
import { ResourcesService } from './resources.service';
import { CoursesService } from '../../courses/courses.service';
import { UpdateResourceDto } from './dto/resource.dto';

@ApiTags('Recursos')
@ApiBearerAuth()
@Controller('mod/resource')
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver un recurso (archivo, página, URL, carpeta, libro o etiqueta)' })
  async detail(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const resource = await this.resources.getResource(module.instance);
    return { module, resource };
  }

  @Patch(':moduleId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({
    summary: 'Guardar el contenido de un recurso',
    description:
      'El cuerpo del texto se limpia en el servidor antes de guardarse: llega desde un editor ' +
      'enriquecido y se muestra después como HTML.',
  })
  async update(@Param('moduleId') moduleId: string, @Body() dto: UpdateResourceDto) {
    const module = await this.courses.findModule(moduleId);
    await this.resources.updateResource(module.instance, {
      name: dto.name,
      settings: {
        intro: dto.intro,
        content: dto.content,
        blocks: dto.blocks,
        externalUrl: dto.externalUrl,
        display: dto.display,
        fileIds: dto.fileIds,
      },
    });
    return this.resources.getResource(module.instance);
  }

  @Post(':moduleId/chapters')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Añadir un capítulo a un libro' })
  async addChapter(
    @Param('moduleId') moduleId: string,
    @Body() dto: { title: string; content: string; subChapter?: boolean },
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.resources.addChapter(module.instance, dto);
  }

  @Patch(':moduleId/chapters/:chapterId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  updateChapter(
    @Param('chapterId') chapterId: string,
    @Body() dto: { title?: string; content?: string; hidden?: boolean; sortOrder?: number },
  ) {
    return this.resources.updateChapter(chapterId, dto);
  }

  @Delete(':moduleId/chapters/:chapterId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async removeChapter(@Param('chapterId') chapterId: string) {
    await this.resources.removeChapter(chapterId);
    return { deleted: true };
  }
}
