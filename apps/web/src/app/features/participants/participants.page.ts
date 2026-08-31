import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CAP, EnrolmentDto, GroupDto } from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { CoursesService } from '../../core/services/courses.service';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
} from '../../shared';

@Component({
  selector: 'maya-participants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    FormatDatePipe,
  ],
  templateUrl: './participants.page.html',
})
export class ParticipantsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly courses = inject(CoursesService);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly items = signal<EnrolmentDto[]>([]);
  readonly groups = signal<GroupDto[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly enrolling = signal(false);
  readonly candidates = signal<{ id: string; fullName: string; email: string }[]>([]);
  readonly selectedUsers = signal<string[]>([]);
  readonly selectedRole = signal('student');

  readonly canEnrol = computed(() => this.auth.can(CAP.ENROL_ENROL_USERS));

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (item) =>
        item.user?.fullName.toLowerCase().includes(term) ||
        item.user?.email.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
    this.courses.groups(this.courseId).subscribe({ next: (groups) => this.groups.set(groups) });
  }

  private load(): void {
    this.loading.set(true);
    this.courses.participants(this.courseId, { limit: 100 }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openEnrol(): void {
    this.enrolling.set(true);
    this.admin.users({ limit: 100 }).subscribe({
      next: (result) =>
        this.candidates.set(
          result.items.map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
          })),
        ),
    });
  }

  toggleUser(id: string): void {
    this.selectedUsers.update((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );
  }

  enrol(): void {
    if (!this.selectedUsers().length) return;
    this.courses.enrol(this.courseId, this.selectedUsers(), this.selectedRole()).subscribe({
      next: (result) => {
        this.toast.success(`${result.enrolled} participantes matriculados`);
        this.enrolling.set(false);
        this.selectedUsers.set([]);
        this.load();
      },
    });
  }

  unenrol(item: EnrolmentDto): void {
    this.courses.unenrol(this.courseId, item.userId).subscribe({
      next: () => {
        this.items.update((list) => list.filter((row) => row.id !== item.id));
        this.toast.success('Participante dado de baja');
      },
    });
  }
}
