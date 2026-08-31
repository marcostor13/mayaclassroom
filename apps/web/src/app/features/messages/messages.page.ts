import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConversationDto, MessageDto } from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { CommunicationService } from '../../core/services/communication.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  IconComponent,
  RelativeTimePipe,
} from '../../shared';

@Component({
  selector: 'maya-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, AvatarComponent, EmptyStateComponent, RelativeTimePipe],
  templateUrl: './messages.page.html',
  styleUrl: './messages.page.scss',
})
export class MessagesPage {
  private readonly comms = inject(CommunicationService);
  readonly auth = inject(AuthService);

  readonly conversations = signal<ConversationDto[]>([]);
  readonly active = signal<ConversationDto | null>(null);
  readonly messages = signal<MessageDto[]>([]);
  readonly draft = signal('');
  readonly loading = signal(true);

  constructor() {
    this.comms.conversations().subscribe({
      next: (result) => {
        this.conversations.set(result.items);
        this.loading.set(false);
        if (result.items.length) this.open(result.items[0]);
      },
      error: () => this.loading.set(false),
    });
  }

  open(conversation: ConversationDto): void {
    this.active.set(conversation);
    this.comms.messages(conversation.id).subscribe({
      next: (result) => this.messages.set(result.items),
    });
    this.comms.markConversationRead(conversation.id).subscribe();
    this.conversations.update((list) =>
      list.map((item) => (item.id === conversation.id ? { ...item, unreadCount: 0 } : item)),
    );
  }

  send(): void {
    const conversation = this.active();
    const body = this.draft().trim();
    if (!conversation || !body) return;

    this.comms.sendMessage(conversation.id, body).subscribe({
      next: (message) => {
        this.messages.update((list) => [...list, message]);
        this.draft.set('');
      },
    });
  }

  isMine(message: MessageDto): boolean {
    return message.senderId === this.auth.user()?.id;
  }
}
