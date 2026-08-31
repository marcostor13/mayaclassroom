import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import type { RequestUser } from '../../../common/types/request-context';
import { ChoiceService } from './choice.service';
import { CoursesService } from '../../courses/courses.service';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('mod/choice')
export class ChoiceController {
  constructor(
    private readonly choice: ChoiceService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.MOD_VIEW, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  @ApiOperation({ summary: 'Ver una consulta' })
  async detail(@CurrentUser() user: RequestUser, @Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const choice = await this.choice.findById(module.instance);
    const showResults =
      choice.showResults === 'always' ||
      (choice.showResults === 'afterclose' && choice.timeClose && new Date() > choice.timeClose);
    const [dto, myAnswer] = await Promise.all([
      this.choice.toDto(choice, Boolean(showResults)),
      this.choice.myAnswer(choice._id, user.id),
    ]);
    return { module, choice: dto, myAnswer };
  }

  @Post(':moduleId/answer')
  @RequireCapability(CAP.CHOICE_CHOOSE, { contextLevel: ContextLevel.Module, param: 'moduleId' })
  async answer(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body('optionIds') optionIds: string[],
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.choice.answer(module.instance, user.id, optionIds);
  }

  @Get(':moduleId/responses')
  @RequireCapability(CAP.CHOICE_READ_RESPONSES, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async responses(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    return this.choice.responses(module.instance);
  }
}
