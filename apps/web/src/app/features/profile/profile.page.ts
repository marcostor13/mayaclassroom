import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { UserDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, FormatDatePipe, IconComponent } from '../../shared';

@Component({
  selector: 'maya-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, AvatarComponent, FormatDatePipe],
  templateUrl: './profile.page.html',
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly tab = signal<'profile' | 'security' | 'sessions'>('profile');
  readonly profile = signal<UserDto | null>(null);
  readonly sessions = signal<Record<string, unknown>[]>([]);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    firstName: [''],
    lastName: [''],
    phone: [''],
    city: [''],
    country: [''],
    description: [''],
    department: [''],
    institution: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: [''],
    newPassword: [''],
  });

  constructor() {
    this.api.get<UserDto>('/users/me').subscribe({
      next: (user) => {
        this.profile.set(user);
        this.form.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? '',
          city: user.city ?? '',
          country: user.country ?? '',
          description: user.description ?? '',
          department: user.department ?? '',
          institution: user.institution ?? '',
        });
      },
    });
  }

  loadSessions(): void {
    this.tab.set('sessions');
    this.api.get<Record<string, unknown>[]>('/auth/sessions').subscribe({
      next: (list) => this.sessions.set(list),
    });
  }

  save(): void {
    this.saving.set(true);
    this.api.patch<UserDto>('/users/me', this.form.getRawValue()).subscribe({
      next: (user) => {
        this.profile.set(user);
        this.auth.patchUser({
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
        });
        this.saving.set(false);
        this.toast.success('Perfil actualizado');
      },
      error: () => this.saving.set(false),
    });
  }

  changePassword(): void {
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    if (!currentPassword || !newPassword) return;
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.toast.success(
          'Contraseña actualizada',
          'Se han cerrado las demás sesiones por seguridad.',
        );
      },
    });
  }

  revokeSession(id: string): void {
    this.api.delete(`/auth/sessions/${id}`).subscribe(() => {
      this.sessions.update((list) => list.filter((s) => s['id'] !== id));
      this.toast.success('Sesión cerrada');
    });
  }

  logoutAll(): void {
    this.api.post('/auth/logout-all').subscribe(() => {
      this.toast.info('Sesiones cerradas', 'Deberá volver a iniciar sesión.');
      this.auth.logout();
    });
  }

  downloadData(): void {
    this.api.download('/privacy/export').subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mis-datos-maya.json';
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
