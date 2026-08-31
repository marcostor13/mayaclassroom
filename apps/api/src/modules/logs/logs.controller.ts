import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { LogQueryDto } from './dto';
import { LogsService } from './logs.service';

@ApiTags('Plataforma')
@ApiBearerAuth()
@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get()
  @RequireCapability([CAP.REPORT_VIEW_LOGS, CAP.SITE_VIEW_AUDIT], {
    contextLevel: ContextLevel.Tenant,
  })
  @ApiOperation({ summary: 'Registro de eventos de la empresa' })
  list(@CurrentUser() user: RequestUser, @Query() query: LogQueryDto) {
    // Siempre acotado al tenant del solicitante: la traza no cruza empresas.
    return this.logs.paginate(user.tenantId, query);
  }
}
