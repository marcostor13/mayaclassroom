import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommentDto, TagDto, fullName, sanitizeHtml, slugify } from '@maya/shared';
import { Comment, CommentDocument, Tag, TagDocument } from './schemas/platform.schema';
import { searchRegex, toObjectId } from '../../common/utils';

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
  ) {}

  /* -------------------------------- Etiquetas ---------------------------- */

  async list(tenantId: string | Types.ObjectId, search?: string): Promise<TagDto[]> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (search) filter.name = searchRegex(search);
    const tags = await this.tagModel.find(filter).sort({ usageCount: -1, name: 1 }).limit(200).exec();
    return tags.map((t) => this.toDto(t));
  }

  /** Registra el uso de un conjunto de etiquetas, creándolas si es necesario. */
  async registerUsage(
    tenantId: string | Types.ObjectId,
    rawNames: string[],
  ): Promise<TagDto[]> {
    const results: TagDto[] = [];
    for (const raw of rawNames) {
      const name = slugify(raw);
      if (!name) continue;
      const tag = await this.tagModel
        .findOneAndUpdate(
          { tenant: toObjectId(tenantId), name },
          { $setOnInsert: { rawName: raw }, $inc: { usageCount: 1 } },
          { upsert: true, new: true },
        )
        .exec();
      results.push(this.toDto(tag));
    }
    return results;
  }

  async setStandard(id: string | Types.ObjectId, isStandard: boolean): Promise<TagDto> {
    const tag = await this.tagModel
      .findByIdAndUpdate(toObjectId(id), { $set: { isStandard } }, { new: true })
      .exec();
    return this.toDto(tag!);
  }

  async remove(id: string | Types.ObjectId): Promise<void> {
    await this.tagModel.deleteOne({ _id: toObjectId(id) }).exec();
  }

  /* ------------------------------- Comentarios --------------------------- */

  async comments(
    component: string,
    itemId: string | Types.ObjectId,
  ): Promise<CommentDto[]> {
    const comments = await this.commentModel
      .find({ component, itemId: toObjectId(itemId) })
      .populate('user', 'firstName lastName avatarUrl')
      .sort({ createdAt: -1 })
      .exec();

    return comments.map((comment) => {
      const author = comment.user as unknown as {
        _id: Types.ObjectId;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string | null;
      };
      return {
        id: comment.id,
        contextId: String(comment.context),
        component: comment.component,
        itemId: String(comment.itemId),
        userId: String(author?._id ?? comment.user),
        author: author?.firstName
          ? {
              id: String(author._id),
              fullName: fullName(author.firstName, author.lastName ?? ''),
              avatarUrl: author.avatarUrl ?? null,
            }
          : undefined,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
      };
    });
  }

  async addComment(params: {
    tenantId: string | Types.ObjectId;
    contextId: string | Types.ObjectId;
    component: string;
    itemId: string | Types.ObjectId;
    userId: string | Types.ObjectId;
    content: string;
  }): Promise<CommentDto> {
    const comment = await this.commentModel.create({
      tenant: toObjectId(params.tenantId),
      context: toObjectId(params.contextId),
      component: params.component,
      itemId: toObjectId(params.itemId),
      user: toObjectId(params.userId),
      content: sanitizeHtml(params.content),
    });
    const [dto] = await this.comments(params.component, params.itemId);
    return dto ?? {
      id: comment.id,
      contextId: String(comment.context),
      component: comment.component,
      itemId: String(comment.itemId),
      userId: String(comment.user),
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
    };
  }

  async removeComment(
    id: string | Types.ObjectId,
    userId?: string | Types.ObjectId,
  ): Promise<void> {
    const filter: Record<string, unknown> = { _id: toObjectId(id) };
    if (userId) filter.user = toObjectId(userId);
    await this.commentModel.deleteOne(filter).exec();
  }

  private toDto(tag: TagDocument): TagDto {
    return {
      id: tag.id,
      name: tag.name,
      rawName: tag.rawName,
      description: tag.description,
      isStandard: tag.isStandard,
      usageCount: tag.usageCount,
    };
  }
}
