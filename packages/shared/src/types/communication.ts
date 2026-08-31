import {
  CalendarEventType,
  MessageConversationType,
  NotificationChannel,
  NotificationStatus,
} from '../enums';

export interface CalendarEventDto {
  id: string;
  name: string;
  description?: string | null;
  eventType: CalendarEventType;
  courseId?: string | null;
  groupId?: string | null;
  userId?: string | null;
  moduleId?: string | null;
  moduleType?: string | null;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  location?: string | null;
  color?: string | null;
  actionable: boolean;
  actionUrl?: string | null;
}

export interface ConversationDto {
  id: string;
  type: MessageConversationType;
  name?: string | null;
  imageUrl?: string | null;
  members: { id: string; fullName: string; avatarUrl: string | null; online?: boolean }[];
  lastMessage?: MessageDto | null;
  unreadCount: number;
  muted: boolean;
  favourite: boolean;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: { id: string; fullName: string; avatarUrl: string | null };
  body: string;
  attachments?: { id: string; filename: string; url: string }[];
  readBy: string[];
  createdAt: string;
  editedAt?: string | null;
}

export interface NotificationDto {
  id: string;
  userId: string;
  component: string;
  eventName: string;
  subject: string;
  body: string;
  contextUrl?: string | null;
  icon?: string | null;
  status: NotificationStatus;
  channels: NotificationChannel[];
  createdAt: string;
  readAt?: string | null;
}

export interface NotificationPreferenceDto {
  component: string;
  eventName: string;
  label: string;
  channels: Record<NotificationChannel, boolean>;
}
