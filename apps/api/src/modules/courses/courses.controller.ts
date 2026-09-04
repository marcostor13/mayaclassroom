import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CAP,
  ContextLevel,
  CourseVisibility,
  LogAction,
} from '@maya/shared';
import { AllowInDemo, Audit, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CoursesService } from './courses.service';
import { CourseViewService } from './course-view.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { GradesService } from '../grades/grades.service';
import { CompletionService } from '../completion/completion.service';
import { UsersService } from '../users/users.service';
import { LogsService } from '../logs/logs.service';
import {
  CourseQueryDto,
  CreateCourseDto,
  CreateModuleDto,
  CreateSectionDto,
  MoveModuleDto,
  UpdateCourseDto,
  UpdateModuleDto,
  UpdateSectionDto,
} from './dto/course.dto';

@ApiTags('Cursos')
@ApiBearerAuth()
@AllowInDemo()
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly view: CourseViewService,
    private readonly enrolments: EnrolmentsService,
    private readonly grades: GradesService,
    private readonly completion: CompletionService,
    private readonly users: UsersService,
    private readonly logs: LogsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar cursos visibles para el usuario' })
  async list(@CurrentUser() user: RequestUser, @Query() query: CourseQueryDto) {
    const [enrolledCourseIds, profile] = await Promise.all([
      this.enrolments.courseIdsOfUser(user.id),
      this.users.findById(user.id),
    ]);
    return this.courses.paginate(user.tenantId, query, {
      enrolledCourseIds,
      canSeeHidden: user.capabilities.includes(CAP.COURSE_VIEW_HIDDEN),
      favouriteIds: profile.favouriteCourses,
    });
  }

  @Get('my')
  @ApiOperation({ summary: 'Cursos del usuario con progreso' })
  async my(@CurrentUser() user: RequestUser, @Query() query: CourseQueryDto) {
    const [enrolledCourseIds, profile] = await Promise.all([
      this.enrolments.courseIdsOfUser(user.id),
      this.users.findById(user.id),
    ]);
    const result = await this.courses.paginate(
      user.tenantId,
      { ...query, onlyMine: true } as CourseQueryDto,
      {
        enrolledCourseIds,
        canSeeHidden: true,
        favouriteIds: profile.favouriteCourses,
      },
    );

    const favourites = new Set(profile.favouriteCourses.map(String));
    const items = await Promise.all(
      result.items.map(async (course) => {
        const progress = await this.completion.courseProgress(course._id, user.id);
        return {
          ...course.toJSON(),
          progress: progress.progress,
          favourite: favourites.has(course.id),
        };
      }),
    );
    return { ...result, items };
  }

  @Get('activity-types')
  @ApiOperation({ summary: 'Catálogo de actividades y recursos disponibles' })
  activityTypes() {
    return this.courses.activityCatalog();
  }

  @Get(':id')
  @RequireCapability(CAP.COURSE_VIEW, { contextLevel: ContextLevel.Course, param: 'id' })
  async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const course = await this.courses.findByIdInTenant(id, user.tenantId);
    await this.enrolments.touchAccess(id, user.id);
    await this.logs.record({
      tenantId: user.tenantId,
      userId: user.id,
      courseId: id,
      component: 'core',
      target: 'course',
      action: LogAction.Viewed,
      objectId: id,
    });
    return course;
  }

  @Get(':id/contents')
  @RequireCapability(CAP.COURSE_VIEW, { contextLevel: ContextLevel.Course, param: 'id' })
  @ApiOperation({ summary: 'Secciones y actividades del curso, ya filtradas' })
  contents(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.view.build(id, user);
  }

  @Post()
  @RequireCapability(CAP.COURSE_CREATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Created, 'course')
  @ApiOperation({ summary: 'Crear un curso' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateCourseDto) {
    const course = await this.courses.create(user.tenantId, dto, user.id);
    await this.grades.provisionCourse(course._id);
    await this.enrolments.provisionDefaults(course._id);
    await this.enrolments.enrol({
      courseId: course._id,
      tenantId: user.tenantId,
      userId: user.id,
      roleShortName: 'editingteacher',
      actorId: user.id,
    });
    return course;
  }

  @Patch(':id')
  @RequireCapability(CAP.COURSE_UPDATE, { contextLevel: ContextLevel.Course, param: 'id' })
  @Audit(LogAction.Updated, 'course')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  @Patch(':id/visibility')
  @RequireCapability(CAP.COURSE_UPDATE, { contextLevel: ContextLevel.Course, param: 'id' })
  setVisibility(@Param('id') id: string, @Body('visibility') visibility: CourseVisibility) {
    return this.courses.setVisibility(id, visibility);
  }

  @Post(':id/favourite')
  @ApiOperation({ summary: 'Marcar o desmarcar el curso como favorito' })
  async favourite(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const favourite = await this.users.toggleFavouriteCourse(user.id, id);
    return { favourite };
  }

  @Delete(':id')
  @RequireCapability(CAP.COURSE_DELETE, { contextLevel: ContextLevel.Course, param: 'id' })
  @Audit(LogAction.Deleted, 'course')
  async remove(@Param('id') id: string) {
    await this.courses.remove(id);
    return { deleted: true };
  }

  /* ------------------------------ Secciones ------------------------------ */

  @Get(':id/sections')
  @RequireCapability(CAP.COURSE_VIEW, { contextLevel: ContextLevel.Course, param: 'id' })
  sections(@Param('id') id: string) {
    return this.courses.sections(id);
  }

  @Post(':id/sections')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  addSection(@Param('id') id: string, @Body() dto: CreateSectionDto) {
    return this.courses.addSection(id, dto);
  }

  @Patch(':id/sections/:sectionId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  updateSection(@Param('sectionId') sectionId: string, @Body() dto: UpdateSectionDto) {
    return this.courses.updateSection(sectionId, dto);
  }

  @Patch(':id/sections/:sectionId/move')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  async moveSection(@Param('sectionId') sectionId: string, @Body('position') position: number) {
    await this.courses.moveSection(sectionId, position);
    return { moved: true };
  }

  @Delete(':id/sections/:sectionId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  async removeSection(@Param('sectionId') sectionId: string) {
    await this.courses.removeSection(sectionId);
    return { deleted: true };
  }

  /* ------------------------------- Módulos ------------------------------- */

  @Post(':id/modules')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  @ApiOperation({ summary: 'Añadir una actividad o recurso' })
  async addModule(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateModuleDto,
  ) {
    const module = await this.courses.addModule(id, dto, user.id);
    if (module.gradeMax !== null) {
      await this.grades.syncModuleItem({
        courseId: id,
        moduleType: module.moduleType,
        instanceId: module.instance,
        courseModuleId: module._id,
        name: module.name,
        grademax: module.gradeMax,
      });
    }
    return module;
  }

  @Patch(':id/modules/:moduleId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  async updateModule(
    @Param('id') id: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleDto,
  ) {
    const module = await this.courses.updateModule(moduleId, dto);
    if (module.gradeMax !== null) {
      await this.grades.syncModuleItem({
        courseId: id,
        moduleType: module.moduleType,
        instanceId: module.instance,
        courseModuleId: module._id,
        name: module.name,
        grademax: module.gradeMax,
      });
    }
    return module;
  }

  @Patch(':id/modules/:moduleId/move')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  async moveModule(@Param('moduleId') moduleId: string, @Body() dto: MoveModuleDto) {
    await this.courses.moveModule(moduleId, dto);
    return { moved: true };
  }

  @Patch(':id/modules/:moduleId/visibility')
  @RequireCapability(CAP.COURSE_ACTIVITY_VISIBILITY, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  setModuleVisibility(
    @Param('moduleId') moduleId: string,
    @Body('visible') visible: boolean,
    @Body('stealth') stealth?: boolean,
  ) {
    return this.courses.setModuleVisibility(moduleId, visible, stealth ?? false);
  }

  @Post(':id/modules/:moduleId/duplicate')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  duplicateModule(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    return this.courses.duplicateModule(moduleId, user.id);
  }

  @Delete(':id/modules/:moduleId')
  @RequireCapability(CAP.COURSE_MANAGE_ACTIVITIES, {
    contextLevel: ContextLevel.Course,
    param: 'id',
  })
  async removeModule(@Param('id') id: string, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    await this.grades.removeItemForModule(module.moduleType, module.instance);
    await this.courses.removeModule(moduleId);
    return { deleted: true };
  }

  @Get('modules/:moduleId')
  @ApiOperation({ summary: 'Detalle de un módulo de curso con su instancia' })
  async moduleDetail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    await this.completion.registerView(moduleId, user.id);
    await this.logs.record({
      tenantId: user.tenantId,
      userId: user.id,
      courseId: module.course,
      component: `mod/${module.moduleType}`,
      target: 'module',
      action: LogAction.Viewed,
      objectId: module._id,
    });
    return module;
  }
}
