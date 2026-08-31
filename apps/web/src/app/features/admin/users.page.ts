import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserDto, UserStatus } from '@maya/shared';
import { AdminService, RoleSummary } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
} from '../../shared';

@Component({
  selector: 'maya-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    FormatDatePipe,
  ],
  templateUrl: './users.page.html',
})
export class AdminUsersPage {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly UserStatus = UserStatus;

  readonly users = signal<UserDto[]>([]);
  readonly roles = signal<RoleSummary[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly status = signal('');
  readonly creating = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required]],
    password: [''],
    initialRole: ['student'],
  });

  constructor() {
    this.load();
    this.admin.roles().subscribe({ next: (roles) => this.roles.set(roles) });
  }

  load(): void {
    this.loading.set(true);
    this.admin
      .users({ limit: 50, search: this.search() || undefined, status: this.status() || undefined })
      .subscribe({
        next: (result) => {
          this.users.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.admin.createUser(this.form.getRawValue()).subscribe({
      next: () => {
        this.toast.success('Usuario creado');
        this.form.reset({ initialRole: 'student' });
        this.creating.set(false);
        this.load();
      },
    });
  }

  setStatus(user: UserDto, status: UserStatus): void {
    this.admin.setUserStatus(user.id, status).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((item) => (item.id === user.id ? updated : item)));
        this.toast.success('Estado actualizado');
      },
    });
  }

  remove(user: UserDto): void {
    this.admin.deleteUser(user.id).subscribe({
      next: () => {
        this.users.update((list) => list.filter((item) => item.id !== user.id));
        this.toast.success('Usuario eliminado');
      },
    });
  }

  statusLabel(status: UserStatus): string {
    switch (status) {
      case UserStatus.Active:
        return 'Activo';
      case UserStatus.Pending:
        return 'Pendiente';
      case UserStatus.Suspended:
        return 'Suspendido';
      default:
        return 'Eliminado';
    }
  }
}
