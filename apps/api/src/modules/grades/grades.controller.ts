import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel } from '@maya/shared';
import { AllowInDemo, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { GradesService } from './grades.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import {
  BulkSetGradesDto,
  CreateGradeCategoryDto,
  CreateGradeItemDto,
  CreateScaleDto,
  SetGradeDto,
  SetGradeLettersDto,
  UpdateGradeCategoryDto,
  UpdateGradeItemDto,
} from './dto/grade.dto';

@ApiTags('Calificaciones')
@ApiBearerAuth()
@AllowInDemo()
@Controller('courses/:courseId/grades')
export class GradesController {
  constructor(
    private readonly grades: GradesService,
    private readonly enrolments: EnrolmentsService,
    private readonly users: UsersService,
    private readonly courses: CoursesService,
  ) {}

  private async participantsMap(courseId: string) {
    const userIds = await this.enrolments.activeUserIds(courseId);
    const users = await this.users.findManyByIds(userIds);
    return {
      userIds,
      map: new Map(
        users.map((u) => [
          u.id,
          {
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            avatarUrl: u.avatarUrl,
          },
        ]),
      ),
    };
  }

  @Get('items')
  @RequireCapability([CAP.GRADE_VIEW_ALL, CAP.GRADE_MANAGE], {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  items(@Param('courseId') courseId: string) {
    return this.grades.items(courseId);
  }

  @Post('items')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Crear un ítem de calificación manual' })
  createItem(@Param('courseId') courseId: string, @Body() dto: CreateGradeItemDto) {
    return this.grades.createManualItem(courseId, dto);
  }

  @Patch('items/:itemId')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateGradeItemDto) {
    return this.grades.updateItem(itemId, dto);
  }

  @Delete('items/:itemId')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async removeItem(@Param('itemId') itemId: string) {
    await this.grades.removeItem(itemId);
    return { deleted: true };
  }

  @Get('categories')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  categories(@Param('courseId') courseId: string) {
    return this.grades.categories(courseId);
  }

  @Post('categories')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  createCategory(@Param('courseId') courseId: string, @Body() dto: CreateGradeCategoryDto) {
    return this.grades.createCategory(courseId, dto);
  }

  @Patch('categories/:categoryId')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  updateCategory(@Param('categoryId') categoryId: string, @Body() dto: UpdateGradeCategoryDto) {
    return this.grades.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async removeCategory(@Param('categoryId') categoryId: string) {
    await this.grades.removeCategory(categoryId);
    return { deleted: true };
  }

  @Get('report')
  @RequireCapability(CAP.GRADE_VIEW_ALL, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Informe del calificador' })
  async graderReport(@Param('courseId') courseId: string) {
    const { userIds, map } = await this.participantsMap(courseId);
    return this.grades.graderReport(courseId, userIds, map);
  }

  @Get('me')
  @ApiOperation({ summary: 'Informe de calificaciones del alumno' })
  async myReport(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    const course = await this.courses.findById(courseId);
    return this.grades.userReport(courseId, user.id, course.fullName);
  }

  @Get('users/:userId')
  @RequireCapability(CAP.GRADE_VIEW_ALL, { contextLevel: ContextLevel.Course, param: 'courseId' })
  async userReport(@Param('courseId') courseId: string, @Param('userId') userId: string) {
    const course = await this.courses.findById(courseId);
    return this.grades.userReport(courseId, userId, course.fullName, true);
  }

  @Post('items/:itemId/grade')
  @RequireCapability(CAP.GRADE_EDIT, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Calificar a un usuario' })
  setGrade(
    @CurrentUser() user: RequestUser,
    @Param('itemId') itemId: string,
    @Body() dto: SetGradeDto,
  ) {
    return this.grades.setGrade(itemId, dto, user.id);
  }

  @Post('items/:itemId/grades')
  @RequireCapability(CAP.GRADE_EDIT, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Calificar en bloque' })
  async setGrades(
    @CurrentUser() user: RequestUser,
    @Param('itemId') itemId: string,
    @Body() dto: BulkSetGradesDto,
  ) {
    for (const grade of dto.grades) await this.grades.setGrade(itemId, grade, user.id);
    return { updated: dto.grades.length };
  }

  @Get('letters')
  letters(@Param('courseId') courseId: string) {
    return this.grades.letters(courseId);
  }

  @Post('letters')
  @RequireCapability(CAP.GRADE_MANAGE_LETTERS, {
    contextLevel: ContextLevel.Course,
    param: 'courseId',
  })
  setLetters(@Param('courseId') courseId: string, @Body() dto: SetGradeLettersDto) {
    return this.grades.setLetters(courseId, dto.letters);
  }

  @Get('export')
  @RequireCapability(CAP.GRADE_EXPORT, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Exportar el libro de calificaciones en CSV' })
  async exportCsv(@Param('courseId') courseId: string, @Res() res: Response) {
    const { userIds, map } = await this.participantsMap(courseId);
    const csv = await this.grades.exportCsv(courseId, userIds, map);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="calificaciones.csv"');
    res.send('﻿' + csv);
  }
}

@ApiTags('Calificaciones')
@ApiBearerAuth()
@Controller('grade-scales')
export class GradeScalesController {
  constructor(private readonly grades: GradesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('courseId') courseId?: string) {
    return this.grades.scales(user.tenantId, courseId);
  }

  @Post()
  @RequireCapability(CAP.GRADE_MANAGE, { contextLevel: ContextLevel.Tenant })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateScaleDto) {
    return this.grades.createScale(user.tenantId, dto);
  }
}
