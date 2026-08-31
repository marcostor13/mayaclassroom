import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/types/request-context';
import { DashboardService } from './dashboard.service';

@ApiTags('Panel')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Panel principal del usuario' })
  overview(@CurrentUser() user: RequestUser) {
    return this.dashboard.overview(user);
  }

  @Get('teaching')
  @ApiOperation({ summary: 'Resumen para el profesorado' })
  teaching(@CurrentUser() user: RequestUser) {
    return this.dashboard.teachingOverview(user);
  }
}
