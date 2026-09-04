import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { AllowInDemo, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { QuestionsService } from './questions.service';
import {
  CreateQuestionCategoryDto,
  CreateQuestionDto,
  ImportQuestionsDto,
  QuestionQueryDto,
  UpdateQuestionDto,
} from './dto/question.dto';

@ApiTags('Banco de preguntas')
@ApiBearerAuth()
@AllowInDemo()
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('categories')
  categories(@CurrentUser() user: RequestUser, @Query('contextId') contextId?: string) {
    return this.questions.categories(user.tenantId, contextId);
  }

  @Post('categories')
  @RequireCapability(CAP.QUESTION_MANAGE_CATEGORY, { contextLevel: ContextLevel.Tenant })
  createCategory(@CurrentUser() user: RequestUser, @Body() dto: CreateQuestionCategoryDto) {
    return this.questions.createCategory(user.tenantId, dto);
  }

  @Get('categories/default')
  @ApiOperation({ summary: 'Categoría raíz de la empresa, creándola si hace falta' })
  defaultTenantCategory(@CurrentUser() user: RequestUser) {
    return this.questions.defaultCategoryForTenant(user.tenantId);
  }

  @Get('categories/course/:courseId/default')
  @ApiOperation({ summary: 'Categoría de preguntas por defecto del curso' })
  defaultCategory(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.questions.defaultCategoryForCourse(user.tenantId, courseId);
  }

  @Get()
  @RequireCapability(CAP.QUESTION_VIEW_ALL, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Listar preguntas del banco' })
  async list(@CurrentUser() user: RequestUser, @Query() query: QuestionQueryDto) {
    const result = await this.questions.paginate(user.tenantId, query);
    return { ...result, items: result.items.map((q) => this.questions.toDto(q)) };
  }

  @Get(':id')
  @RequireCapability(CAP.QUESTION_VIEW_ALL, { contextLevel: ContextLevel.Tenant })
  async findOne(@Param('id') id: string) {
    return this.questions.toDto(await this.questions.findById(id));
  }

  @Post()
  @RequireCapability(CAP.QUESTION_ADD, { contextLevel: ContextLevel.Tenant })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateQuestionDto) {
    return this.questions.toDto(await this.questions.create(user.tenantId, dto));
  }

  @Patch(':id')
  @RequireCapability(CAP.QUESTION_EDIT_ALL, { contextLevel: ContextLevel.Tenant })
  async update(@Param('id') id: string, @Body() dto: UpdateQuestionDto) {
    return this.questions.toDto(await this.questions.update(id, dto));
  }

  @Post(':id/duplicate')
  @RequireCapability(CAP.QUESTION_ADD, { contextLevel: ContextLevel.Tenant })
  async duplicate(@Param('id') id: string) {
    return this.questions.toDto(await this.questions.duplicate(id));
  }

  @Delete(':id')
  @RequireCapability(CAP.QUESTION_EDIT_ALL, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.questions.remove(id);
    return { deleted: true };
  }

  @Post('import')
  @RequireCapability(CAP.QUESTION_ADD, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Importar preguntas en formato GIFT o JSON' })
  import(@CurrentUser() user: RequestUser, @Body() dto: ImportQuestionsDto) {
    return this.questions.import(user.tenantId, dto);
  }
}
