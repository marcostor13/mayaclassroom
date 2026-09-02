import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ContextLevel, UserStatus } from '@maya/shared';
import type { UserProfileDto } from '@maya/shared';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { AvatarComponent, FormatDatePipe, IconComponent } from '../../../shared';

/**
 * Ficha de un usuario de la empresa.
 *
 * Ruta propia y no un panel dentro del listado, igual que la ficha de empresa:
 * así sobrevive a una recarga, se puede compartir y se puede guardar en
 * marcadores, que es justo lo que se hace cuando alguien pregunta «¿por qué
 * este usuario no ve tal cosa?».
 */
@Component({
  selector: 'maya-admin-user-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, AvatarComponent, FormatDatePipe],
  templateUrl: './user-detail.page.html',
  styleUrl: './user-detail.page.scss',
})
export class AdminUserDetailPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();

  readonly data = signal<UserProfileDto | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly UserStatus = UserStatus;

  /** Roles agrupados por dónde se tienen: la empresa entera o un curso. */
  readonly rolesDeEmpresa = computed(() =>
    (this.data()?.roles ?? []).filter((role) => role.contextLevel !== ContextLevel.Course),
  );

  readonly rolesDeCurso = computed(() =>
    (this.data()?.roles ?? []).filter((role) => role.contextLevel === ContextLevel.Course),
  );

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.admin.userProfile(this.id()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  nivelLegible(level: ContextLevel): string {
    switch (level) {
      case ContextLevel.System:
        return 'Plataforma';
      case ContextLevel.Tenant:
        return 'Toda la empresa';
      case ContextLevel.Category:
        return 'Categoría';
      case ContextLevel.Course:
        return 'Curso';
      default:
        return level;
    }
  }

  estadoLegible(status: UserStatus): string {
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

  cambiarEstado(status: UserStatus): void {
    const user = this.data();
    if (!user) return;
    const suspender = status === UserStatus.Suspended;

    this.confirm
      .ask({
        title: suspender ? 'Suspender la cuenta' : 'Activar la cuenta',
        message: suspender
          ? `${user.fullName} dejará de poder entrar en la plataforma. Sus datos y matrículas se conservan.`
          : `${user.fullName} volverá a poder entrar.`,
        confirmLabel: suspender ? 'Suspender' : 'Activar',
        danger: suspender,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.admin.setUserStatus(user.id, status).subscribe({
          next: () => {
            this.data.update((actual) => (actual ? { ...actual, status } : actual));
            this.toast.success(suspender ? 'Cuenta suspendida' : 'Cuenta activada');
          },
        });
      });
  }

  volver(): void {
    this.location.back();
  }
}
