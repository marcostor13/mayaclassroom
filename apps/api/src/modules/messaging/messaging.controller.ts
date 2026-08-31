import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';
import type { RequestUser } from '../../common/types/request-context';
import { MessagingService } from './messaging.service';

@ApiTags('Comunicación')
@ApiBearerAuth()
@Controller('messages')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Conversaciones del usuario' })
  conversations(@CurrentUser() user: RequestUser, @Query() query: PaginationQueryDto) {
    return this.messaging.conversations(user.id, query);
  }

  @Post('conversations/with/:userId')
  @ApiOperation({ summary: 'Abrir (o crear) una conversación individual' })
  openWith(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.messaging.openWith(user.tenantId, user.id, userId);
  }

  @Post('conversations/group')
  @ApiOperation({ summary: 'Crear una conversación de grupo' })
  createGroup(
    @CurrentUser() user: RequestUser,
    @Body() dto: { name: string; memberIds: string[]; courseId?: string },
  ) {
    return this.messaging.createGroupConversation({
      tenantId: user.tenantId,
      name: dto.name,
      memberIds: dto.memberIds,
      creatorId: user.id,
      courseId: dto.courseId ?? null,
    });
  }

  @Get('conversations/:id')
  messages(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.messaging.messages(id, user.id, query);
  }

  @Post('conversations/:id')
  @ApiOperation({ summary: 'Enviar un mensaje' })
  send(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: { body: string; attachmentIds?: string[] },
  ) {
    return this.messaging.send(id, user.id, dto.body, dto.attachmentIds ?? []);
  }

  @Post('conversations/:id/read')
  async markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.messaging.markRead(id, user.id);
    return { read: true };
  }

  @Post('conversations/:id/mute')
  mute(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.messaging.toggleMute(id, user.id);
  }

  @Post('conversations/:id/favourite')
  favourite(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.messaging.toggleFavourite(id, user.id);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: RequestUser) {
    return { count: await this.messaging.unreadTotal(user.id) };
  }

  @Delete(':messageId')
  async remove(@CurrentUser() user: RequestUser, @Param('messageId') messageId: string) {
    await this.messaging.deleteMessage(messageId, user.id);
    return { deleted: true };
  }
}
