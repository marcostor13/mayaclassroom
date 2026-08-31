import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseModuleDto, DiscussionDto, ForumDto, PostDto } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  IconComponent,
  RelativeTimePipe,
  SafeHtmlPipe,
} from '../../shared';

@Component({
  selector: 'maya-forum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    AvatarComponent,
    SafeHtmlPipe,
    RelativeTimePipe,
  ],
  templateUrl: './forum.page.html',
  styleUrl: './activity.shared.scss',
})
export class ForumPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly forum = signal<ForumDto | null>(null);
  readonly discussions = signal<DiscussionDto[]>([]);
  readonly loading = signal(true);

  readonly openDiscussion = signal<DiscussionDto | null>(null);
  readonly posts = signal<PostDto[]>([]);

  readonly composing = signal(false);
  readonly newTitle = signal('');
  readonly newMessage = signal('');
  readonly replyText = signal('');

  constructor() {
    this.activities.forum(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.forum.set(data.forum);
        this.discussions.set(data.discussions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(discussion: DiscussionDto): void {
    this.openDiscussion.set(discussion);
    this.activities.discussion(discussion.id).subscribe({
      next: (data) => this.posts.set(data.posts),
    });
  }

  back(): void {
    this.openDiscussion.set(null);
    this.posts.set([]);
  }

  createDiscussion(): void {
    if (!this.newTitle().trim() || !this.newMessage().trim()) return;
    this.activities
      .createDiscussion(this.moduleId, { name: this.newTitle(), message: this.newMessage() })
      .subscribe({
        next: (discussion) => {
          this.discussions.update((list) => [discussion, ...list]);
          this.newTitle.set('');
          this.newMessage.set('');
          this.composing.set(false);
          this.toast.success('Debate publicado');
        },
      });
  }

  reply(parentId?: string): void {
    const discussion = this.openDiscussion();
    if (!discussion || !this.replyText().trim()) return;
    this.activities.reply(discussion.id, { message: this.replyText(), parentId }).subscribe({
      next: () => {
        this.replyText.set('');
        this.activities.discussion(discussion.id).subscribe({
          next: (data) => this.posts.set(data.posts),
        });
        this.toast.success('Respuesta publicada');
      },
    });
  }

  subscribe(): void {
    this.activities.toggleForumSubscription(this.moduleId).subscribe({
      next: ({ subscribed }) =>
        this.toast.success(
          subscribed ? 'Suscrito al foro' : 'Suscripción cancelada',
          subscribed ? 'Recibirá avisos de los mensajes nuevos.' : undefined,
        ),
    });
  }

  flatten(posts: PostDto[], depth = 0): { post: PostDto; depth: number }[] {
    const result: { post: PostDto; depth: number }[] = [];
    for (const post of posts) {
      result.push({ post, depth });
      if (post.children?.length) result.push(...this.flatten(post.children, depth + 1));
    }
    return result;
  }
}
