import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP } from '@maya/shared';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('Búsqueda')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Búsqueda global en cursos, actividades, personas y categorías' })
  global(@CurrentUser() user: RequestUser, @Query() query: SearchQueryDto) {
    return this.search.search(user, query.q, {
      limit: query.limit,
      canSeeHidden: user.capabilities.includes(CAP.COURSE_VIEW_HIDDEN),
      canSeeUsers: user.capabilities.includes(CAP.USER_VIEW_ALL_DETAILS),
    });
  }
}
