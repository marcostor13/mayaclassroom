import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CAP, ContextLevel, SurveyStatus, slugify } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { SurveysService } from './surveys.service';
import { CreateSurveyDto, SubmitSurveyDto, UpdateSurveyDto } from './dto/survey.dto';
import { buildSurveyWorkbook, surveyResultsCsv } from './survey.export';

@ApiTags('Encuestas')
@ApiBearerAuth()
@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveys: SurveysService) {}

  /* ------------------------------- Gestión ------------------------------- */

  @Get('courses/:courseId')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Encuestas de un curso' })
  forCourse(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.surveys.forCourse(user.tenantId, courseId);
  }

  @Post('courses/:courseId')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Course, param: 'courseId' })
  @ApiOperation({ summary: 'Crear una encuesta' })
  create(
    @CurrentUser() user: RequestUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateSurveyDto,
  ) {
    return this.surveys.create(user.tenantId, courseId, dto, user.id);
  }

  @Patch(':id')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Tenant })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateSurveyDto,
  ) {
    return this.surveys.update(user.tenantId, id, dto);
  }

  @Post(':id/publish')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Publicar la encuesta' })
  publish(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.surveys.setStatus(user.tenantId, id, SurveyStatus.Published);
  }

  @Post(':id/close')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Cerrar la encuesta' })
  close(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.surveys.setStatus(user.tenantId, id, SurveyStatus.Closed);
  }

  @Delete(':id')
  @RequireCapability(CAP.SURVEY_MANAGE, { contextLevel: ContextLevel.Tenant })
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.surveys.remove(user.tenantId, id);
    return { deleted: true };
  }

  /* ------------------------------ Alumnado ------------------------------- */

  @Get('courses/:courseId/me')
  @ApiOperation({ summary: 'Encuestas que puede responder el alumno en un curso' })
  mine(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.surveys.forStudent(user.tenantId, courseId, user.id);
  }

  @Get(':id/respond')
  @ApiOperation({ summary: 'Encuesta para responderla' })
  async respond(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const survey = await this.surveys.require(user.tenantId, id);
    const answered = await this.surveys.hasAnswered(survey._id, user.id);
    return { ...this.surveys.toDto(survey), answered };
  }

  @Post(':id/responses')
  @RequireCapability(CAP.SURVEY_RESPOND, { contextLevel: ContextLevel.System })
  @ApiOperation({ summary: 'Enviar las respuestas; no se guarda quién responde' })
  submit(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SubmitSurveyDto,
  ) {
    return this.surveys.submit(user.tenantId, id, user.id, dto);
  }

  /* ------------------------------ Resultados ----------------------------- */

  @Get(':id/results')
  @RequireCapability(CAP.SURVEY_VIEW_RESULTS, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Resultados agregados de la encuesta' })
  results(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.surveys.results(user.tenantId, id);
  }

  @Get(':id/export.xlsx')
  @RequireCapability(CAP.SURVEY_VIEW_RESULTS, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Resultados en Excel' })
  async excel(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const results = await this.surveys.results(user.tenantId, id);
    const buffer = await buildSurveyWorkbook(results);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="encuesta-${slugify(results.survey.title)}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get(':id/export.csv')
  @RequireCapability(CAP.SURVEY_VIEW_RESULTS, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Resultados en CSV' })
  async csv(@CurrentUser() user: RequestUser, @Param('id') id: string, @Res() res: Response) {
    const results = await this.surveys.results(user.tenantId, id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="encuesta-${slugify(results.survey.title)}.csv"`,
    );
    // La marca de orden de bytes hace que Excel abra el CSV en UTF-8; sin ella
    // las tildes salen rotas, que es lo primero que se ve en español.
    res.send(`\ufeff${surveyResultsCsv(results)}`);
  }
}
