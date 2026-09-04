import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel, LogAction } from '@maya/shared';
import { AllowInDemo, Audit, CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, MoveCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@ApiTags('Categorías')
@ApiBearerAuth()
@AllowInDemo()
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Listado plano de categorías' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
    @Query('parentId') parentId?: string,
  ) {
    const includeHidden = user.capabilities.includes(CAP.CATEGORY_VIEW_HIDDEN);
    return this.categories.list(user.tenantId, { search, includeHidden, parentId });
  }

  @Get('tree')
  @ApiOperation({ summary: 'Árbol de categorías' })
  tree(@CurrentUser() user: RequestUser) {
    return this.categories.tree(user.tenantId, user.capabilities.includes(CAP.CATEGORY_VIEW_HIDDEN));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categories.findById(id);
  }

  @Post()
  @RequireCapability(CAP.CATEGORY_CREATE, { contextLevel: ContextLevel.Tenant })
  @Audit(LogAction.Created, 'category')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(user.tenantId, dto);
  }

  @Patch(':id')
  @RequireCapability(CAP.CATEGORY_UPDATE, { contextLevel: ContextLevel.Category, param: 'id' })
  @Audit(LogAction.Updated, 'category')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Patch(':id/move')
  @RequireCapability(CAP.CATEGORY_MANAGE, { contextLevel: ContextLevel.Category, param: 'id' })
  move(@Param('id') id: string, @Body() dto: MoveCategoryDto) {
    return this.categories.move(id, dto);
  }

  @Post('reorder')
  @RequireCapability(CAP.CATEGORY_MANAGE, { contextLevel: ContextLevel.Tenant })
  async reorder(@CurrentUser() user: RequestUser, @Body('orderedIds') orderedIds: string[]) {
    await this.categories.reorder(user.tenantId, orderedIds);
    return { reordered: orderedIds.length };
  }

  @Delete(':id')
  @RequireCapability(CAP.CATEGORY_DELETE, { contextLevel: ContextLevel.Category, param: 'id' })
  @Audit(LogAction.Deleted, 'category')
  async remove(@Param('id') id: string, @Query('moveContentTo') moveContentTo?: string) {
    await this.categories.remove(id, moveContentTo);
    return { deleted: true };
  }
}
