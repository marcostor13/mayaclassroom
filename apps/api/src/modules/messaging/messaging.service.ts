import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConversationDto,
  MessageConversationType,
  MessageDto,
  excerpt,
  fullName,
  sanitizeHtml,
} from '@maya/shared';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { FilesService } from '../files/files.service';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto';
import { toObjectId } from '../../common/utils';

@Injectable()
export class MessagingService {
  constructor(
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly files: FilesService,
  ) {}

  /* --------------------------- Conversaciones ---------------------------- */

  async conversations(
    userId: string | Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ConversationDto>> {
    const filter = { members: toObjectId(userId) };
    const [rows, total] = await Promise.all([
      this.conversationModel
        .find(filter)
        .populate('members', 'firstName lastName avatarUrl lastAccessAt')
        .populate('lastMessage')
        .sort({ lastMessageAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.conversationModel.countDocuments(filter).exec(),
    ]);

    const items = await Promise.all(rows.map((c) => this.conversationToDto(c, userId)));
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  /** Devuelve (o crea) la conversación individual entre dos usuarios. */
  async openWith(
    tenantId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    otherUserId: string | Types.ObjectId,
  ): Promise<ConversationDto> {
    const members = [toObjectId(userId), toObjectId(otherUserId)];
    let conversation = await this.conversationModel
      .findOne({
        type: MessageConversationType.Individual,
        members: { $all: members, $size: 2 },
      })
      .populate('members', 'firstName lastName avatarUrl')
      .exec();

    if (!conversation) {
      conversation = await this.conversationModel.create({
        tenant: toObjectId(tenantId),
        type: MessageConversationType.Individual,
        members,
      });
      conversation = await this.conversationModel
        .findById(conversation._id)
        .populate('members', 'firstName lastName avatarUrl')
        .exec();
    }
    return this.conversationToDto(conversation!, userId);
  }

  async createGroupConversation(params: {
    tenantId: string | Types.ObjectId;
    name: string;
    memberIds: (string | Types.ObjectId)[];
    creatorId: string | Types.ObjectId;
    courseId?: string | Types.ObjectId | null;
  }): Promise<ConversationDto> {
    const members = Array.from(
      new Set([...params.memberIds.map(String), String(params.creatorId)]),
    ).map((id) => new Types.ObjectId(id));

    const conversation = await this.conversationModel.create({
      tenant: toObjectId(params.tenantId),
      type: MessageConversationType.Group,
      name: params.name,
      members,
      course: params.courseId ? toObjectId(params.courseId) : null,
    });

    const populated = await this.conversationModel
      .findById(conversation._id)
      .populate('members', 'firstName lastName avatarUrl')
      .exec();
    return this.conversationToDto(populated!, params.creatorId);
  }

  /* ------------------------------- Mensajes ------------------------------ */

  async messages(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<MessageDto>> {
    await this.assertMember(conversationId, userId);
    const filter = { conversation: toObjectId(conversationId) };

    const [rows, total] = await Promise.all([
      this.messageModel
        .find(filter)
        .populate('sender', 'firstName lastName avatarUrl')
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);

    const items = await Promise.all(rows.reverse().map((m) => this.messageToDto(m)));
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  async send(
    conversationId: string | Types.ObjectId,
    senderId: string | Types.ObjectId,
    body: string,
    attachmentIds: string[] = [],
  ): Promise<MessageDto> {
    const conversation = await this.assertMember(conversationId, senderId);

    const message = await this.messageModel.create({
      conversation: conversation._id,
      sender: toObjectId(senderId),
      body: sanitizeHtml(body),
      attachments: attachmentIds.map(toObjectId),
      readBy: [toObjectId(senderId)],
    });

    if (attachmentIds.length) {
      await this.files.attachToItem(attachmentIds, {
        component: 'message',
        fileArea: 'attachment',
        itemId: message._id,
      });
    }

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const sender = await this.users.findById(senderId);
    const recipients = conversation.members
      .filter((m) => String(m) !== String(senderId))
      .filter((m) => !conversation.mutedBy.some((muted) => String(muted) === String(m)));

    await this.notifications.notify({
      tenantId: conversation.tenant,
      userIds: recipients,
      component: 'message',
      eventName: 'message_received',
      subject: `Mensaje de ${fullName(sender.firstName, sender.lastName)}`,
      body: excerpt(body, 160),
      contextUrl: `/messages/${conversation.id}`,
      fromUserId: senderId,
    });

    return this.messageToDto(message);
  }

  async markRead(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    await this.assertMember(conversationId, userId);
    await this.messageModel
      .updateMany(
        { conversation: toObjectId(conversationId), readBy: { $ne: toObjectId(userId) } },
        { $addToSet: { readBy: toObjectId(userId) } },
      )
      .exec();
  }

  async unreadTotal(userId: string | Types.ObjectId): Promise<number> {
    const conversations = await this.conversationModel
      .find({ members: toObjectId(userId) })
      .select('_id')
      .lean()
      .exec();
    return this.messageModel
      .countDocuments({
        conversation: { $in: conversations.map((c) => c._id) },
        sender: { $ne: toObjectId(userId) },
        readBy: { $ne: toObjectId(userId) },
      })
      .exec();
  }

  async toggleMute(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<{ muted: boolean }> {
    const conversation = await this.assertMember(conversationId, userId);
    const index = conversation.mutedBy.findIndex((m) => String(m) === String(userId));
    if (index >= 0) conversation.mutedBy.splice(index, 1);
    else conversation.mutedBy.push(toObjectId(userId));
    await conversation.save();
    return { muted: index < 0 };
  }

  async toggleFavourite(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<{ favourite: boolean }> {
    const conversation = await this.assertMember(conversationId, userId);
    const index = conversation.favouritedBy.findIndex((m) => String(m) === String(userId));
    if (index >= 0) conversation.favouritedBy.splice(index, 1);
    else conversation.favouritedBy.push(toObjectId(userId));
    await conversation.save();
    return { favourite: index < 0 };
  }

  async deleteMessage(
    messageId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const message = await this.messageModel.findById(toObjectId(messageId)).exec();
    if (!message) throw new NotFoundException('Mensaje no encontrado.');
    if (String(message.sender) !== String(userId)) {
      throw new ForbiddenException('Solo puede eliminar sus propios mensajes.');
    }
    await message.deleteOne();
  }

  /* ------------------------------ Auxiliares ----------------------------- */

  private async assertMember(
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<ConversationDocument> {
    const conversation = await this.conversationModel.findById(toObjectId(conversationId)).exec();
    if (!conversation) throw new NotFoundException('Conversación no encontrada.');
    if (!conversation.members.some((m) => String(m) === String(userId))) {
      throw new ForbiddenException('No pertenece a esta conversación.');
    }
    return conversation;
  }

  private async conversationToDto(
    conversation: ConversationDocument,
    viewerId: string | Types.ObjectId,
  ): Promise<ConversationDto> {
    const members = (conversation.members as unknown as {
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
      lastAccessAt?: Date | null;
    }[]).map((m) => ({
      id: String(m._id ?? m),
      fullName: m.firstName ? fullName(m.firstName, m.lastName ?? '') : '',
      avatarUrl: m.avatarUrl ?? null,
      online: m.lastAccessAt ? Date.now() - new Date(m.lastAccessAt).getTime() < 300_000 : false,
    }));

    const unreadCount = await this.messageModel
      .countDocuments({
        conversation: conversation._id,
        sender: { $ne: toObjectId(viewerId) },
        readBy: { $ne: toObjectId(viewerId) },
      })
      .exec();

    const lastMessage = conversation.lastMessage
      ? await this.messageModel.findById(conversation.lastMessage).exec()
      : null;

    const other = members.find((m) => m.id !== String(viewerId));

    return {
      id: conversation.id,
      type: conversation.type,
      name:
        conversation.name ??
        (conversation.type === MessageConversationType.Individual ? (other?.fullName ?? null) : null),
      imageUrl: conversation.imageUrl ?? other?.avatarUrl ?? null,
      members,
      lastMessage: lastMessage ? await this.messageToDto(lastMessage) : null,
      unreadCount,
      muted: conversation.mutedBy.some((m) => String(m) === String(viewerId)),
      favourite: conversation.favouritedBy.some((m) => String(m) === String(viewerId)),
      updatedAt: conversation.lastMessageAt.toISOString(),
    };
  }

  private async messageToDto(message: MessageDocument): Promise<MessageDto> {
    const attachments = message.attachments.length
      ? await this.files.listByArea('message', 'attachment', message._id)
      : [];
    const sender = message.sender as unknown as {
      _id: Types.ObjectId;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string | null;
    };

    return {
      id: message.id,
      conversationId: String(message.conversation),
      senderId: String(sender?._id ?? message.sender),
      sender: sender?.firstName
        ? {
            id: String(sender._id),
            fullName: fullName(sender.firstName, sender.lastName ?? ''),
            avatarUrl: sender.avatarUrl ?? null,
          }
        : undefined,
      body: message.body,
      attachments: attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        url: `/api/v1/files/${a.id}/download`,
      })),
      readBy: message.readBy.map(String),
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
    };
  }
}
