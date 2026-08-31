import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CAP, ContextLevel } from '@maya/shared';
import { CurrentUser, RequireCapability } from '../../../common/decorators';
import type { RequestUser } from '../../../common/types/request-context';
import { ForumService } from './forum.service';
import { CoursesService } from '../../courses/courses.service';
import {
  CreateDiscussionDto,
  CreatePostDto,
  RatePostDto,
  UpdatePostDto,
} from './dto/forum.dto';

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller('mod/forum')
export class ForumController {
  constructor(
    private readonly forum: ForumService,
    private readonly courses: CoursesService,
  ) {}

  @Get(':moduleId')
  @RequireCapability(CAP.FORUM_VIEW_DISCUSSION, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Ver un foro con sus debates' })
  async detail(@Param('moduleId') moduleId: string) {
    const module = await this.courses.findModule(moduleId);
    const forum = await this.forum.findById(module.instance);
    const [dto, discussions] = await Promise.all([
      this.forum.toDto(forum),
      this.forum.discussions(forum._id),
    ]);
    return { module, forum: dto, discussions };
  }

  @Post(':moduleId/discussions')
  @RequireCapability(CAP.FORUM_START_DISCUSSION, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  @ApiOperation({ summary: 'Iniciar un debate' })
  async createDiscussion(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateDiscussionDto,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.forum.createDiscussion(module.instance, user.id, dto);
  }

  @Get('discussions/:discussionId')
  @ApiOperation({ summary: 'Mensajes de un debate' })
  async discussion(@Param('discussionId') discussionId: string) {
    const discussion = await this.forum.findDiscussion(discussionId);
    const posts = await this.forum.posts(discussionId);
    return { discussion, posts };
  }

  @Post('discussions/:discussionId/posts')
  @ApiOperation({ summary: 'Responder en un debate' })
  reply(
    @CurrentUser() user: RequestUser,
    @Param('discussionId') discussionId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.forum.reply(discussionId, user.id, dto);
  }

  @Patch(':moduleId/discussions/:discussionId/flags')
  @RequireCapability(CAP.FORUM_PIN_DISCUSSION, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  setFlags(
    @Param('discussionId') discussionId: string,
    @Body() flags: { pinned?: boolean; locked?: boolean },
  ) {
    return this.forum.setDiscussionFlags(discussionId, flags);
  }

  @Delete(':moduleId/discussions/:discussionId')
  @RequireCapability(CAP.FORUM_DELETE_ANY_POST, {
    contextLevel: ContextLevel.Module,
    param: 'moduleId',
  })
  async removeDiscussion(@Param('discussionId') discussionId: string) {
    await this.forum.removeDiscussion(discussionId);
    return { deleted: true };
  }

  @Patch('posts/:postId')
  update(
    @CurrentUser() user: RequestUser,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forum.updatePost(
      postId,
      user.id,
      dto,
      user.capabilities.includes(CAP.FORUM_EDIT_ANY_POST),
    );
  }

  @Delete('posts/:postId')
  async removePost(@CurrentUser() user: RequestUser, @Param('postId') postId: string) {
    await this.forum.removePost(
      postId,
      user.id,
      user.capabilities.includes(CAP.FORUM_DELETE_ANY_POST),
    );
    return { deleted: true };
  }

  @Post('posts/:postId/rate')
  rate(
    @CurrentUser() user: RequestUser,
    @Param('postId') postId: string,
    @Body() dto: RatePostDto,
  ) {
    return this.forum.ratePost(postId, user.id, dto.value);
  }

  @Post(':moduleId/subscription')
  @ApiOperation({ summary: 'Suscribirse o cancelar la suscripción al foro' })
  async toggleSubscription(
    @CurrentUser() user: RequestUser,
    @Param('moduleId') moduleId: string,
  ) {
    const module = await this.courses.findModule(moduleId);
    return this.forum.toggleSubscription(module.instance, user.id);
  }
}
