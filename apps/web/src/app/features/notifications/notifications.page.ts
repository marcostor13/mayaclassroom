import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationDto, NotificationPreferenceDto, NotificationStatus } from '@maya/shared';
import { CommunicationService } from '../../core/services/communication.service';
import { EmptyStateComponent, IconComponent, RelativeTimePipe } from '../../shared';

@Component({
  selector: 'maya-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, EmptyStateComponent, RelativeTimePipe],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage {
  private readonly comms = inject(CommunicationService);

  readonly items = signal<NotificationDto[]>([]);
  readonly preferences = signal<NotificationPreferenceDto[]>([]);
  readonly loading = signal(true);
  readonly tab = signal<'inbox' | 'preferences'>('inbox');
  readonly onlyUnread = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.comms.notifications(1, this.onlyUnread()).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadPreferences(): void {
    this.tab.set('preferences');
    if (this.preferences().length) return;
    this.comms.notificationPreferences().subscribe({
      next: (list) => this.preferences.set(list),
    });
  }

  markRead(item: NotificationDto): void {
    if (item.status === NotificationStatus.Read) return;
    this.comms.markNotificationRead(item.id).subscribe(() => {
      this.items.update((list) =>
        list.map((n) => (n.id === item.id ? { ...n, status: NotificationStatus.Read } : n)),
      );
    });
  }

  markAll(): void {
    this.comms.markAllNotificationsRead().subscribe(() => {
      this.items.update((list) => list.map((n) => ({ ...n, status: NotificationStatus.Read })));
    });
  }

  toggleChannel(
    preference: NotificationPreferenceDto,
    channel: 'web' | 'email',
    value: boolean,
  ): void {
    this.comms
      .setNotificationPreference(preference.component, preference.eventName, { [channel]: value })
      .subscribe();
    this.preferences.update((list) =>
      list.map((item) =>
        item.component === preference.component && item.eventName === preference.eventName
          ? { ...item, channels: { ...item.channels, [channel]: value } }
          : item,
      ),
    );
  }

  toggleUnread(): void {
    this.onlyUnread.update((value) => !value);
    this.load();
  }

  isUnread(item: NotificationDto): boolean {
    return item.status === NotificationStatus.Unread;
  }
}
