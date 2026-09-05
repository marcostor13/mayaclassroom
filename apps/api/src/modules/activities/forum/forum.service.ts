import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DiscussionDto,
  ForumDto,
  ForumSubscriptionMode,
  ForumType,
  ModuleType,
  PostDto,
  excerpt,
  fullName,
  round,
  sanitizeHtml,
} from '@maya/shared';
import { Forum, ForumDocument } from './schemas/forum.schema';
import { Discussion, DiscussionDocument } from './schemas/discussion.schema';
import { Post, PostDocument } from './schemas/post.schema';
import {
  ActivityCreateInput,
  ActivityHandler,
  ActivityInstanceResult,
  ActivityRegistry,
} from '../activity-registry.service';
import { FilesService } from '../../files/files.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CompletionService } from '../../completion/completion.service';
import { CoursesService } from '../../courses/courses.service';
import { GradesService } from '../../grades/grades.service';
import { toObjectId } from '../../../common/utils';
import {
  CreateDiscussionDto,
  CreatePostDto,
  ForumSettingsDto,
  UpdatePostDto,
} from './dto/forum.dto';

@Injectable()
export class ForumService implements ActivityHandler, OnModuleInit {
  readonly type = ModuleType.Forum;
  readonly label = 'Foro';
  readonly icon = 'message-square';
  readonly gradable = true;
  readonly description =
    'Debate por hilos entre el alumnado y el profesorado, con avisos por correo ' +
    'a quien esté suscrito.';
  readonly tags = ['Debate', 'Con avisos'];

  constructor(
    @InjectModel(Forum.name) private readonly model: Model<ForumDocument>,
    @InjectModel(Discussion.name) private readonly discussionModel: Model<DiscussionDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly registry: ActivityRegistry,
    private readonly files: FilesService,
    private readonly notifications: NotificationsService,
    private readonly completion: CompletionService,
    private readonly courses: CoursesService,
    private readonly grades: GradesService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  /* --------------------------- ActivityHandler --------------------------- */

  async create(input: ActivityCreateInput): Promise<ActivityInstanceResult> {
    const settings = input.settings as ForumSettingsDto;
    const forum = await this.model.create({
      course: input.courseId,
      tenant: input.tenantId,
      name: input.name,
      intro: settings.intro ?? input.description ?? null,
      type: settings.type ?? ForumType.General,
      subscriptionMode: settings.subscriptionMode ?? ForumSubscriptionMode.Optional,
      maxAttachments: settings.maxAttachments ?? 3,
      maxBytes: settings.maxBytes ?? 10 * 1024 * 1024,
      allowRating: settings.allowRating ?? false,
      blockAfter: settings.blockAfter ?? 0,
      gradeMax: settings.gradeMax ?? 0,
      createdBy: input.userId,
    });
    return { id: forum._id, gradeMax: forum.gradeMax > 0 ? forum.gradeMax : null };
  }

  async update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult> {
    const forum = await this.findById(instanceId);
    const settings = (input.settings ?? {}) as ForumSettingsDto;
    if (input.name) forum.name = input.name;
    if (settings.intro !== undefined) forum.intro = settings.intro ?? null;
    for (const key of Object.keys(settings) as (keyof ForumSettingsDto)[]) {
      if (key === 'intro') continue;
      if (settings[key] !== undefined) {
        (forum as unknown as Record<string, unknown>)[key] = settings[key];
      }
    }
    await forum.save();
    return { id: forum._id, gradeMax: forum.gradeMax > 0 ? forum.gradeMax : null };
  }

  async remove(instanceId: Types.ObjectId): Promise<void> {
    const discussions = await this.discussionModel.find({ forum: instanceId }).exec();
    for (const discussion of discussions) {
      await this.postModel.deleteMany({ discussion: discussion._id }).exec();
    }
    await this.discussionModel.deleteMany({ forum: instanceId }).exec();
    await this.model.deleteOne({ _id: instanceId }).exec();
  }

  async get(instanceId: Types.ObjectId): Promise<ForumDto> {
    return this.toDto(await this.findById(instanceId));
  }

  async duplicate(
    instanceId: Types.ObjectId,
    targetCourseId: Types.ObjectId,
  ): Promise<Types.ObjectId> {
    const source = await this.findById(instanceId);
    const copy = await this.model.create({
      ...(source.toObject() as unknown as Record<string, unknown>),
      _id: undefined,
      course: targetCourseId,
      name: `${source.name} (copia)`,
      subscribers: [],
      createdAt: undefined,
      updatedAt: undefined,
    });
    return copy._id;
  }

  /* ------------------------------- Consultas ----------------------------- */

  async findById(id: string | Types.ObjectId): Promise<ForumDocument> {
    const forum = await this.model.findById(toObjectId(id)).exec();
    if (!forum) throw new NotFoundException('Foro no encontrado.');
    return forum;
  }

  async toDto(forum: ForumDocument): Promise<ForumDto> {
    const discussionCount = await this.discussionModel
      .countDocuments({ forum: forum._id })
      .exec();
    return {
      id: forum.id,
      courseId: String(forum.course),
      name: forum.name,
      intro: forum.intro,
      type: forum.type,
      subscriptionMode: forum.subscriptionMode,
      maxAttachments: forum.maxAttachments,
      maxBytes: forum.maxBytes,
      allowRating: forum.allowRating,
      blockAfter: forum.blockAfter,
      blockPeriodSeconds: forum.blockPeriodSeconds,
      discussionCount,
    };
  }

  /* ------------------------------- Debates ------------------------------- */

  async discussions(
    forumId: string | Types.ObjectId,
    options: { groupIds?: Types.ObjectId[] } = {},
  ): Promise<DiscussionDto[]> {
    const filter: Record<string, unknown> = { forum: toObjectId(forumId) };
    if (options.groupIds) {
      filter.$or = [{ group: null }, { group: { $in: options.groupIds } }];
    }

    const discussions = await this.discussionModel
      .find(filter)
      .populate('user', 'firstName lastName avatarUrl')
      .sort({ pinned: -1, lastPostAt: -1, createdAt: -1 })
      .exec();

    return Promise.all(discussions.map((d) => this.discussionToDto(d)));
  }

  async findDiscussion(id: string | Types.ObjectId): Promise<DiscussionDocument> {
    const discussion = await this.discussionModel
      .findById(toObjectId(id))
      .populate('user', 'firstName lastName avatarUrl')
      .exec();
    if (!discussion) throw new NotFoundException('Debate no encontrado.');
    return discussion;
  }

  async createDiscussion(
    forumId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: CreateDiscussionDto,
  ): Promise<DiscussionDto> {
    const forum = await this.findById(forumId);

    if (forum.type === ForumType.SingleDiscussion) {
      const existing = await this.discussionModel.countDocuments({ forum: forum._id }).exec();
      if (existing > 0) {
        throw new ForbiddenException('Este foro solo admite un debate.');
      }
    }
    if (forum.type === ForumType.EachUser) {
      const own = await this.discussionModel
        .countDocuments({ forum: forum._id, user: toObjectId(userId) })
        .exec();
      if (own > 0) {
        throw new ForbiddenException('Ya ha publicado su debate en este foro.');
      }
    }

    await this.assertNotBlocked(forum, userId);

    const discussion = await this.discussionModel.create({
      forum: forum._id,
      name: dto.name,
      user: toObjectId(userId),
      group: dto.groupId ? toObjectId(dto.groupId) : null,
      pinned: dto.pinned ?? false,
      lastPostAt: new Date(),
      subscribers: [toObjectId(userId)],
    });

    const post = await this.postModel.create({
      discussion: discussion._id,
      parent: null,
      user: toObjectId(userId),
      subject: dto.name,
      message: sanitizeHtml(dto.message),
      attachments: (dto.attachmentIds ?? []).map(toObjectId),
    });

    if (dto.attachmentIds?.length) {
      await this.files.attachToItem(dto.attachmentIds, {
        component: 'mod/forum',
        fileArea: 'attachment',
        itemId: post._id,
      });
    }

    discussion.firstPost = post._id;
    await discussion.save();

    await this.notifySubscribers(forum, discussion, post, userId);
    await this.updateCompletion(forum, userId);

    return this.discussionToDto(await this.findDiscussion(discussion._id));
  }

  async setDiscussionFlags(
    discussionId: string | Types.ObjectId,
    flags: { pinned?: boolean; locked?: boolean },
  ): Promise<DiscussionDto> {
    const discussion = await this.findDiscussion(discussionId);
    if (flags.pinned !== undefined) discussion.pinned = flags.pinned;
    if (flags.locked !== undefined) discussion.locked = flags.locked;
    await discussion.save();
    return this.discussionToDto(discussion);
  }

  async removeDiscussion(discussionId: string | Types.ObjectId): Promise<void> {
    const discussion = await this.findDiscussion(discussionId);
    await this.postModel.deleteMany({ discussion: discussion._id }).exec();
    await discussion.deleteOne();
  }

  /* ------------------------------- Mensajes ------------------------------ */

  /** Árbol de mensajes de un debate. */
  async posts(discussionId: string | Types.ObjectId): Promise<PostDto[]> {
    const posts = await this.postModel
      .find({ discussion: toObjectId(discussionId) })
      .populate('user', 'firstName lastName avatarUrl')
      .sort({ createdAt: 1 })
      .exec();

    const dtos = await Promise.all(posts.map((p) => this.postToDto(p)));
    const byId = new Map(dtos.map((p) => [p.id, { ...p, children: [] as PostDto[] }]));
    const roots: PostDto[] = [];

    for (const post of byId.values()) {
      if (post.parentId && byId.has(post.parentId)) {
        byId.get(post.parentId)!.children!.push(post);
      } else {
        roots.push(post);
      }
    }
    return roots;
  }

  async reply(
    discussionId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: CreatePostDto,
  ): Promise<PostDto> {
    const discussion = await this.findDiscussion(discussionId);
    if (discussion.locked) throw new ForbiddenException('El debate está cerrado.');

    const forum = await this.findById(discussion.forum);
    await this.assertNotBlocked(forum, userId);

    const post = await this.postModel.create({
      discussion: discussion._id,
      parent: dto.parentId ? toObjectId(dto.parentId) : discussion.firstPost,
      user: toObjectId(userId),
      subject: dto.subject ?? `Re: ${discussion.name}`,
      message: sanitizeHtml(dto.message),
      attachments: (dto.attachmentIds ?? []).map(toObjectId),
    });

    if (dto.attachmentIds?.length) {
      await this.files.attachToItem(dto.attachmentIds, {
        component: 'mod/forum',
        fileArea: 'attachment',
        itemId: post._id,
      });
    }

    discussion.replyCount += 1;
    discussion.lastPostAt = new Date();
    if (!discussion.subscribers.some((s) => String(s) === String(userId))) {
      discussion.subscribers.push(toObjectId(userId));
    }
    await discussion.save();

    await this.notifySubscribers(forum, discussion, post, userId);
    await this.updateCompletion(forum, userId);

    return this.postToDto(post);
  }

  async updatePost(
    postId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    dto: UpdatePostDto,
    canEditAny = false,
  ): Promise<PostDto> {
    const post = await this.postModel.findById(toObjectId(postId)).exec();
    if (!post) throw new NotFoundException('Mensaje no encontrado.');
    if (!canEditAny && String(post.user) !== String(userId)) {
      throw new ForbiddenException('Solo puede editar sus propios mensajes.');
    }
    if (dto.subject) post.subject = dto.subject;
    if (dto.message) post.message = sanitizeHtml(dto.message);
    post.edited = true;
    await post.save();
    return this.postToDto(post);
  }

  async removePost(
    postId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    canDeleteAny = false,
  ): Promise<void> {
    const post = await this.postModel.findById(toObjectId(postId)).exec();
    if (!post) throw new NotFoundException('Mensaje no encontrado.');
    if (!canDeleteAny && String(post.user) !== String(userId)) {
      throw new ForbiddenException('Solo puede eliminar sus propios mensajes.');
    }
    await this.postModel.deleteMany({ parent: post._id }).exec();
    await post.deleteOne();
    await this.discussionModel
      .updateOne({ _id: post.discussion }, { $inc: { replyCount: -1 } })
      .exec();
  }

  async ratePost(
    postId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    value: number,
  ): Promise<{ average: number; count: number }> {
    const post = await this.postModel.findById(toObjectId(postId)).exec();
    if (!post) throw new NotFoundException('Mensaje no encontrado.');

    const existing = post.ratings.find((r) => String(r.user) === String(userId));
    if (existing) existing.value = value;
    else post.ratings.push({ user: toObjectId(userId), value });
    post.markModified('ratings');
    await post.save();

    const average = post.ratings.reduce((sum, r) => sum + r.value, 0) / post.ratings.length;

    const discussion = await this.findDiscussion(post.discussion);
    const forum = await this.findById(discussion.forum);
    if (forum.gradeMax > 0) {
      await this.grades.recordModuleGrade({
        courseId: forum.course,
        moduleType: ModuleType.Forum,
        instanceId: forum._id,
        userId: post.user,
        grade: round((average / 100) * forum.gradeMax, 2),
      });
    }

    return { average: round(average, 1), count: post.ratings.length };
  }

  /* ---------------------------- Suscripciones ---------------------------- */

  async toggleSubscription(
    forumId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<{ subscribed: boolean }> {
    const forum = await this.findById(forumId);
    if (forum.subscriptionMode === ForumSubscriptionMode.Forced) {
      throw new ForbiddenException('La suscripción a este foro es obligatoria.');
    }
    if (forum.subscriptionMode === ForumSubscriptionMode.Disabled) {
      throw new ForbiddenException('Las suscripciones están deshabilitadas en este foro.');
    }

    const index = forum.subscribers.findIndex((s) => String(s) === String(userId));
    if (index >= 0) {
      forum.subscribers.splice(index, 1);
      await forum.save();
      return { subscribed: false };
    }
    forum.subscribers.push(toObjectId(userId));
    await forum.save();
    return { subscribed: true };
  }

  private async notifySubscribers(
    forum: ForumDocument,
    discussion: DiscussionDocument,
    post: PostDocument,
    authorId: string | Types.ObjectId,
  ): Promise<void> {
    const recipients = new Set<string>();
    for (const subscriber of forum.subscribers) recipients.add(String(subscriber));
    for (const subscriber of discussion.subscribers) recipients.add(String(subscriber));
    recipients.delete(String(authorId));
    if (!recipients.size) return;

    const module = await this.courses.findModuleByInstance(ModuleType.Forum, forum._id);
    await this.notifications.notify({
      tenantId: forum.tenant,
      userIds: [...recipients].map((id) => new Types.ObjectId(id)),
      component: 'mod/forum',
      eventName: 'forum_post',
      subject: `Nuevo mensaje en «${discussion.name}»`,
      body: excerpt(post.message, 200),
      contextUrl: module ? `/mod/forum/${module.id}/discussions/${discussion.id}` : undefined,
      fromUserId: authorId,
    });
  }

  private async updateCompletion(
    forum: ForumDocument,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const module = await this.courses.findModuleByInstance(ModuleType.Forum, forum._id);
    if (!module) return;
    const discussions = await this.discussionModel.find({ forum: forum._id }).select('_id').lean().exec();
    const posts = await this.postModel
      .countDocuments({
        discussion: { $in: discussions.map((d) => d._id) },
        user: toObjectId(userId),
      })
      .exec();
    await this.completion.evaluate(module._id, userId, { posts });
  }

  private async assertNotBlocked(
    forum: ForumDocument,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    if (!forum.blockAfter) return;
    const since = new Date(Date.now() - forum.blockPeriodSeconds * 1000);
    const discussions = await this.discussionModel.find({ forum: forum._id }).select('_id').lean().exec();
    const recent = await this.postModel
      .countDocuments({
        discussion: { $in: discussions.map((d) => d._id) },
        user: toObjectId(userId),
        createdAt: { $gte: since },
      })
      .exec();
    if (recent >= forum.blockAfter) {
      throw new ForbiddenException(
        `Ha alcanzado el límite de ${forum.blockAfter} mensajes en el período permitido.`,
      );
    }
  }

  /* ------------------------------ Mapeadores ----------------------------- */

  private async discussionToDto(discussion: DiscussionDocument): Promise<DiscussionDto> {
    const author = discussion.user as unknown as {
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    };
    const firstPost = discussion.firstPost
      ? await this.postModel.findById(discussion.firstPost).exec()
      : null;

    return {
      id: discussion.id,
      forumId: String(discussion.forum),
      name: discussion.name,
      userId: String(author?._id ?? discussion.user),
      author: author?.firstName
        ? {
            id: String(author._id),
            fullName: fullName(author.firstName, author.lastName ?? ''),
            avatarUrl: author.avatarUrl ?? null,
          }
        : undefined,
      groupId: discussion.group ? String(discussion.group) : null,
      pinned: discussion.pinned,
      locked: discussion.locked,
      replyCount: discussion.replyCount,
      lastPostAt: discussion.lastPostAt?.toISOString() ?? null,
      createdAt: discussion.createdAt.toISOString(),
      firstPost: firstPost ? await this.postToDto(firstPost) : undefined,
    };
  }

  private async postToDto(post: PostDocument): Promise<PostDto> {
    const attachments = await this.files.listByArea('mod/forum', 'attachment', post._id);
    const author = post.user as unknown as {
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    };
    const average = post.ratings.length
      ? round(post.ratings.reduce((sum, r) => sum + r.value, 0) / post.ratings.length, 1)
      : null;

    return {
      id: post.id,
      discussionId: String(post.discussion),
      parentId: post.parent ? String(post.parent) : null,
      userId: String(author?._id ?? post.user),
      author: author?.firstName
        ? {
            id: String(author._id),
            fullName: fullName(author.firstName, author.lastName ?? ''),
            avatarUrl: author.avatarUrl ?? null,
          }
        : undefined,
      subject: post.subject,
      message: post.message,
      attachments: this.files.toRefs(attachments),
      rating: average,
      ratingCount: post.ratings.length,
      edited: post.edited,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
