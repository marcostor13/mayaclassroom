import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContextLevel } from '@maya/shared';
import type { GuideDefinition, GuideProgressDto } from '@maya/shared';
import { AllowInDemo, CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';
import { GuidesService } from './guides.service';
import { UpdateGuideProgressDto } from './dto/guide.dto';

@ApiTags('Guías interactivas')
@ApiBearerAuth()
@AllowInDemo()
@Controller('guides')
export class GuidesController {
  constructor(
    private readonly guides: GuidesService,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
  ) {}

  /**
   * Las guías que le corresponden a quien pregunta, con su progreso.
   *
   * Se filtran por capacidad en el servidor y no en el cliente: ofrecer a un
   * estudiante la guía de «configura tus cobros» sería enseñarle un recorrido
   * que termina en un error de permisos.
   */
  @Get()
  @ApiOperation({ summary: 'Guías disponibles y progreso propio' })
  async mine(
    @CurrentUser() user: RequestUser,
  ): Promise<{ guides: GuideDefinition[]; progress: GuideProgressDto[] }> {
    const context = await this.contexts.requireByInstance(ContextLevel.Tenant, user._tenantId);
    const capabilities = await this.access.effectiveCapabilities(
      { userId: user._id, isPlatformAdmin: user.isPlatformAdmin },
      context,
    );

    return {
      guides: this.guides.available(capabilities),
      progress: await this.guides.progress(user._tenantId, user._id),
    };
  }

  @Patch(':guideId')
  @ApiOperation({ summary: 'Avanzar, descartar o reiniciar una guía' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('guideId') guideId: string,
    @Body() dto: UpdateGuideProgressDto,
  ): Promise<GuideProgressDto> {
    return this.guides.update(user._tenantId, user._id, guideId, dto);
  }
}
