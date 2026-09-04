import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowInDemo, CurrentUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';
import type { RequestUser } from '../../common/types/request-context';
import { NotificationsService } from './notifications.service';

@ApiTags('Comunicación')
@ApiBearerAuth()
@AllowInDemo()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Notificaciones del usuario' })
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.paginate(user.id, query, unread === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: RequestUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return { read: true };
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: RequestUser) {
    await this.notifications.markAllRead(user.id);
    return { read: true };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.notifications.remove(user.id, id);
    return { deleted: true };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Preferencias de notificación por evento y canal' })
  preferences(@CurrentUser() user: RequestUser) {
    return this.notifications.preferences(user.id);
  }

  @Patch('preferences')
  async setPreference(
    @CurrentUser() user: RequestUser,
    @Body()
    body: { component: string; eventName: string; web?: boolean; email?: boolean; push?: boolean },
  ) {
    const { component, eventName, ...channels } = body;
    await this.notifications.setPreference(user.id, component, eventName, channels);
    return { updated: true };
  }
}
