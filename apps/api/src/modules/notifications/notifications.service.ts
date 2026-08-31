import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationChannel, NotificationStatus } from '@maya/shared';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from './schemas/notification-preference.schema';
import { NOTIFICATION_PROVIDERS } from './notification-catalog';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { PaginatedResult, PaginationQueryDto } from '../../common/dto';
import { toObjectId } from '../../common/utils';

export interface NotifyInput {
  tenantId: string | Types.ObjectId;
  userIds: (string | Types.ObjectId)[];
  component: string;
  eventName: string;
  subject: string;
  body: string;
  contextUrl?: string;
  icon?: string;
  fromUserId?: string | Types.ObjectId | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
    @InjectModel(NotificationPreference.name)
    private readonly preferenceModel: Model<NotificationPreferenceDocument>,
    private readonly mail: MailService,
    private readonly users: UsersService,
  ) {}

  /** Envía una notificación respetando las preferencias de cada destinatario. */
  async notify(input: NotifyInput): Promise<void> {
    if (!input.userIds.length) return;
    const provider = NOTIFICATION_PROVIDERS.find(
      (p) => p.component === input.component && p.eventName === input.eventName,
    );

    for (const userId of input.userIds) {
      const preference = await this.preferenceFor(userId, input.component, input.eventName);
      const channels: NotificationChannel[] = [];
      if (preference.web) channels.push(NotificationChannel.Web);
      if (preference.email) channels.push(NotificationChannel.Email);

      if (!channels.length) continue;

      if (channels.includes(NotificationChannel.Web)) {
        await this.model.create({
          tenant: toObjectId(input.tenantId),
          user: toObjectId(userId),
          component: input.component,
          eventName: input.eventName,
          subject: input.subject,
          body: input.body,
          contextUrl: input.contextUrl ?? null,
          icon: input.icon ?? null,
          channels,
          fromUser: input.fromUserId ? toObjectId(input.fromUserId) : null,
        });
      }

      if (channels.includes(NotificationChannel.Email)) {
        try {
          const user = await this.users.findById(userId);
          await this.mail.sendNotification(user.email, input.subject, input.body, input.contextUrl);
        } catch (error) {
          this.logger.warn(`No se pudo enviar la notificación por correo: ${String(error)}`);
        }
      }
    }

    if (!provider) {
      this.logger.debug(
        `Evento no catalogado: ${input.component}/${input.eventName}. Se usan los valores por defecto.`,
      );
    }
  }

  private async preferenceFor(
    userId: string | Types.ObjectId,
    component: string,
    eventName: string,
  ): Promise<{ web: boolean; email: boolean; push: boolean }> {
    const stored = await this.preferenceModel
      .findOne({ user: toObjectId(userId), component, eventName })
      .lean()
      .exec();
    if (stored) return { web: stored.web, email: stored.email, push: stored.push };

    const provider = NOTIFICATION_PROVIDERS.find(
      (p) => p.component === component && p.eventName === eventName,
    );
    return {
      web: provider?.defaultWeb ?? true,
      email: provider?.defaultEmail ?? false,
      push: false,
    };
  }

  async paginate(
    userId: string | Types.ObjectId,
    query: PaginationQueryDto,
    onlyUnread = false,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter: Record<string, unknown> = { user: toObjectId(userId) };
    if (onlyUnread) filter.status = NotificationStatus.Unread;

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(query.skip).limit(query.limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(items, total, query.page, query.limit);
  }

  async unreadCount(userId: string | Types.ObjectId): Promise<number> {
    return this.model
      .countDocuments({ user: toObjectId(userId), status: NotificationStatus.Unread })
      .exec();
  }

  async markRead(userId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<void> {
    await this.model
      .updateOne(
        { _id: toObjectId(id), user: toObjectId(userId) },
        { $set: { status: NotificationStatus.Read, readAt: new Date() } },
      )
      .exec();
  }

  async markAllRead(userId: string | Types.ObjectId): Promise<void> {
    await this.model
      .updateMany(
        { user: toObjectId(userId), status: NotificationStatus.Unread },
        { $set: { status: NotificationStatus.Read, readAt: new Date() } },
      )
      .exec();
  }

  async remove(userId: string | Types.ObjectId, id: string | Types.ObjectId): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id), user: toObjectId(userId) }).exec();
  }

  /** Preferencias del usuario, completadas con los valores por defecto. */
  async preferences(userId: string | Types.ObjectId) {
    const stored = await this.preferenceModel.find({ user: toObjectId(userId) }).lean().exec();
    const map = new Map(stored.map((p) => [`${p.component}:${p.eventName}`, p]));
    return NOTIFICATION_PROVIDERS.map((provider) => {
      const saved = map.get(`${provider.component}:${provider.eventName}`);
      return {
        component: provider.component,
        eventName: provider.eventName,
        label: provider.label,
        channels: {
          web: saved?.web ?? provider.defaultWeb,
          email: saved?.email ?? provider.defaultEmail,
          push: saved?.push ?? false,
        },
      };
    });
  }

  async setPreference(
    userId: string | Types.ObjectId,
    component: string,
    eventName: string,
    channels: { web?: boolean; email?: boolean; push?: boolean },
  ): Promise<void> {
    await this.preferenceModel
      .findOneAndUpdate(
        { user: toObjectId(userId), component, eventName },
        { $set: channels },
        { upsert: true },
      )
      .exec();
  }
}
