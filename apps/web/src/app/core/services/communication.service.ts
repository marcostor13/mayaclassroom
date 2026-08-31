import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  CalendarEventDto,
  ConversationDto,
  MessageDto,
  NotificationDto,
  NotificationPreferenceDto,
  Paginated,
} from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CommunicationService {
  private readonly api = inject(ApiService);

  private readonly unreadNotificationsSignal = signal(0);
  private readonly unreadMessagesSignal = signal(0);

  readonly unreadNotifications = this.unreadNotificationsSignal.asReadonly();
  readonly unreadMessages = this.unreadMessagesSignal.asReadonly();

  /* --------------------------- Notificaciones ---------------------------- */

  notifications(page = 1, unread = false): Observable<Paginated<NotificationDto>> {
    return this.api.get<Paginated<NotificationDto>>('/notifications', { page, limit: 20, unread });
  }

  refreshUnreadCounts(): void {
    this.api
      .get<{ count: number }>('/notifications/unread-count')
      .subscribe({ next: ({ count }) => this.unreadNotificationsSignal.set(count) });
    this.api
      .get<{ count: number }>('/messages/unread-count')
      .subscribe({ next: ({ count }) => this.unreadMessagesSignal.set(count) });
  }

  markNotificationRead(id: string): Observable<{ read: boolean }> {
    return this.api
      .patch<{ read: boolean }>(`/notifications/${id}/read`)
      .pipe(tap(() => this.unreadNotificationsSignal.update((n) => Math.max(0, n - 1))));
  }

  markAllNotificationsRead(): Observable<{ read: boolean }> {
    return this.api
      .post<{ read: boolean }>('/notifications/read-all')
      .pipe(tap(() => this.unreadNotificationsSignal.set(0)));
  }

  notificationPreferences(): Observable<NotificationPreferenceDto[]> {
    return this.api.get<NotificationPreferenceDto[]>('/notifications/preferences');
  }

  setNotificationPreference(
    component: string,
    eventName: string,
    channels: { web?: boolean; email?: boolean },
  ) {
    return this.api.patch('/notifications/preferences', { component, eventName, ...channels });
  }

  /* ------------------------------ Mensajería ----------------------------- */

  conversations(page = 1): Observable<Paginated<ConversationDto>> {
    return this.api.get<Paginated<ConversationDto>>('/messages/conversations', {
      page,
      limit: 30,
    });
  }

  messages(conversationId: string, page = 1): Observable<Paginated<MessageDto>> {
    return this.api.get<Paginated<MessageDto>>(`/messages/conversations/${conversationId}`, {
      page,
      limit: 40,
    });
  }

  sendMessage(conversationId: string, body: string): Observable<MessageDto> {
    return this.api.post<MessageDto>(`/messages/conversations/${conversationId}`, { body });
  }

  openConversation(userId: string): Observable<ConversationDto> {
    return this.api.post<ConversationDto>(`/messages/conversations/with/${userId}`);
  }

  markConversationRead(conversationId: string) {
    return this.api
      .post(`/messages/conversations/${conversationId}/read`)
      .pipe(tap(() => this.refreshUnreadCounts()));
  }

  /* ------------------------------- Calendario ---------------------------- */

  events(from: string, to: string, courseId?: string): Observable<CalendarEventDto[]> {
    return this.api.get<CalendarEventDto[]>('/calendar/events', { from, to, courseId });
  }

  upcomingEvents(days = 30): Observable<CalendarEventDto[]> {
    return this.api.get<CalendarEventDto[]>('/calendar/upcoming', { days });
  }

  createEvent(payload: Partial<CalendarEventDto>): Observable<CalendarEventDto> {
    return this.api.post<CalendarEventDto>('/calendar/events', payload);
  }

  updateEvent(id: string, payload: Partial<CalendarEventDto>): Observable<CalendarEventDto> {
    return this.api.patch<CalendarEventDto>(`/calendar/events/${id}`, payload);
  }

  deleteEvent(id: string) {
    return this.api.delete<{ deleted: boolean }>(`/calendar/events/${id}`);
  }
}
