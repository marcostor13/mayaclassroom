import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BadgeStatus, BadgeType, CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, Public, RequireCapability } from '../../common/decorators';
import type { RequestUser } from '../../common/types/request-context';
import { BadgesService } from './badges.service';

@ApiTags('Insignias')
@Controller('badges')
export class BadgesController {
  constructor(private readonly badges: BadgesService) {}

  @Public()
  @Get('verify/:hash')
  @ApiOperation({ summary: 'Verificación pública de una insignia' })
  verify(@Param('hash') hash: string) {
    return this.badges.verify(hash);
  }

  @ApiBearerAuth()
  @Get()
  list(@CurrentUser() user: RequestUser, @Query('courseId') courseId?: string) {
    return this.badges.list(user.tenantId, courseId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Insignias obtenidas por el usuario' })
  mine(@CurrentUser() user: RequestUser) {
    return this.badges.userBadges(user.id);
  }

  @ApiBearerAuth()
  @Get('users/:userId')
  @RequireCapability(CAP.BADGE_VIEW_AWARDED, { contextLevel: ContextLevel.Tenant })
  ofUser(@Param('userId') userId: string) {
    return this.badges.userBadges(userId);
  }

  @ApiBearerAuth()
  @Post()
  @RequireCapability(CAP.BADGE_CREATE, { contextLevel: ContextLevel.Tenant })
  create(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      name: string;
      description: string;
      imageUrl?: string;
      type?: BadgeType;
      courseId?: string;
      issuerName?: string;
      issuerEmail?: string;
      expiryDate?: string;
      criteria?: unknown[];
      criteriaAggregation?: 'all' | 'any';
    },
  ) {
    return this.badges.create(user.tenantId, {
      ...dto,
      issuerName: dto.issuerName ?? user.fullName,
      issuerEmail: dto.issuerEmail ?? user.email,
    });
  }

  @ApiBearerAuth()
  @Patch(':id')
  @RequireCapability(CAP.BADGE_CREATE, { contextLevel: ContextLevel.Tenant })
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>) {
    return this.badges.update(id, dto);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @RequireCapability(CAP.BADGE_CREATE, { contextLevel: ContextLevel.Tenant })
  setStatus(@Param('id') id: string, @Body('status') status: BadgeStatus) {
    return this.badges.setStatus(id, status);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @RequireCapability(CAP.BADGE_CREATE, { contextLevel: ContextLevel.Tenant })
  async remove(@Param('id') id: string) {
    await this.badges.remove(id);
    return { deleted: true };
  }

  @ApiBearerAuth()
  @Post(':id/award/:userId')
  @RequireCapability(CAP.BADGE_AWARD, { contextLevel: ContextLevel.Tenant })
  @ApiOperation({ summary: 'Otorgar una insignia manualmente' })
  award(@Param('id') id: string, @Param('userId') userId: string) {
    return this.badges.award(id, userId);
  }

  @ApiBearerAuth()
  @Delete(':id/award/:userId')
  @RequireCapability(CAP.BADGE_AWARD, { contextLevel: ContextLevel.Tenant })
  async revoke(@Param('id') id: string, @Param('userId') userId: string) {
    await this.badges.revoke(id, userId);
    return { revoked: true };
  }
}
