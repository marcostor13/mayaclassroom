import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import { RequestUser } from '../../../common/types/request-context';
import { QuizService } from './quiz.service';
import { CoursesService } from '../../courses/courses.service';
import { AddQuizQuestionsDto, ManualGradeDto, SaveResponseDto } from './dto/quiz.dto';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('mod/quiz')
export class QuizController {
  constructor(
    private readonly quiz: QuizService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.QUIZ_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver un cuestionario y los intentos propios' })
  async detail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const quiz = await this.quiz.findById(module.instance);
    const [dto, attempts] = await Promise.all([
      this.quiz.toDto(quiz),
      this.quiz.attemptsOfUser(quiz._id, user.id),
    ]);
    return { module, quiz: dto, attempts };
  }

  @Get(':moduleId/edit')
  @RequireCapability(CAP.QUIZ_MANAGE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Cuestionario con sus preguntas para edición' })
  async edit(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const quiz = await this.quiz.findById(module.instance);
    return this.quiz.toDto(quiz, true);
  }

  @Post(':moduleId/questions')
  @RequireCapability(CAP.QUIZ_MANAGE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async addQuestions(@Param('moduleId') moduleId: string, @Body() dto: AddQuizQuestionsDto) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.addQuestions(module.instance, dto.questionIds, dto.maxMark);
  }

  @Delete(':moduleId/questions/:questionId')
  @RequireCapability(CAP.QUIZ_MANAGE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async removeQuestion(
    @Param('moduleId') moduleId: string,
    @Param('questionId') questionId: string,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.removeQuestion(module.instance, questionId);
  }

  @Patch(':moduleId/questions/order')
  @RequireCapability(CAP.QUIZ_MANAGE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async reorder(@Param('moduleId') moduleId: string, @Body('questionIds') questionIds: string[]) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.reorderQuestions(module.instance, questionIds);
  }

  @Patch(':moduleId/questions/:questionId/mark')
  @RequireCapability(CAP.QUIZ_MANAGE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async setMark(
    @Param('moduleId') moduleId: string,
    @Param('questionId') questionId: string,
    @Body('maxMark') maxMark: number,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.setQuestionMark(module.instance, questionId, maxMark);
  }

  @Post(':moduleId/attempts')
  @RequireCapability(CAP.QUIZ_ATTEMPT, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Comenzar o retomar un intento' })
  async startAttempt(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body('password') password?: string,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.startAttempt(module.instance, user.id, password);
  }

  @Get('attempts/:attemptId/questions')
  @ApiOperation({ summary: 'Preguntas del intento en curso' })
  questions(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string) {
    return this.quiz.attemptQuestions(attemptId, user.id);
  }

  @Post('attempts/:attemptId/responses')
  @ApiOperation({ summary: 'Guardar la respuesta a una pregunta' })
  saveResponse(
    @CurrentUser() user: RequestUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: SaveResponseDto,
  ) {
    return this.quiz.saveResponse(attemptId, user.id, dto);
  }

  @Post('attempts/:attemptId/finish')
  @ApiOperation({ summary: 'Enviar y finalizar el intento' })
  finish(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string) {
    return this.quiz.finishAttempt(attemptId, user.id);
  }

  @Get(':moduleId/attempts')
  @RequireCapability(CAP.QUIZ_VIEW_REPORTS, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async allAttempts(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.allAttempts(module.instance);
  }

  @Get(':moduleId/statistics')
  @RequireCapability(CAP.QUIZ_VIEW_REPORTS, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Estadísticas del cuestionario' })
  async statistics(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    return this.quiz.statistics(module.instance);
  }

  @Post(':moduleId/attempts/:attemptId/grade')
  @RequireCapability(CAP.QUIZ_GRADE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Calificar manualmente una pregunta de ensayo' })
  manualGrade(@Param('attemptId') attemptId: string, @Body() dto: ManualGradeDto) {
    return this.quiz.manualGrade(attemptId, dto);
  }

  @Delete(':moduleId/attempts/:attemptId')
  @RequireCapability(CAP.QUIZ_DELETE_ATTEMPTS, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async deleteAttempt(@Param('attemptId') attemptId: string) {
    await this.quiz.deleteAttempt(attemptId);
    return { deleted: true };
  }
}
