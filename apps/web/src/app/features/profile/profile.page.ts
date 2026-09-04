import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SignatureRecordDto, SignatureUse, UserDto, UserSignatureDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { SignaturesService } from '../../core/services/signatures.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  FormatDatePipe,
  IconComponent,
  SignaturePadComponent,
} from '../../shared';

@Component({
  selector: 'maya-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    IconComponent,
    AvatarComponent,
    FormatDatePipe,
    SignaturePadComponent,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly tab = signal<'profile' | 'security' | 'signature' | 'sessions'>('profile');
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

  /* --------------------------- Firma electrónica ------------------------- */

  private readonly signatures = inject(SignaturesService);

  readonly signature = signal<UserSignatureDto | null>(null);
  readonly signatureRecords = signal<SignatureRecordDto[]>([]);
  readonly draftSignature = signal<string | null>(null);
  readonly savingSignature = signal(false);
  /** Se está volviendo a firmar encima de una firma que ya existía. */
  readonly redrawing = signal(false);

  private loadSignature(): void {
    this.signatures.mine().subscribe({
      next: (firma) => this.signature.set(firma),
      error: () => undefined,
    });
    this.signatures.myRecords().subscribe({
      next: (records) => this.signatureRecords.set(records),
      error: () => undefined,
    });
  }

  saveSignature(): void {
    const trazo = this.draftSignature();
    if (!trazo || this.savingSignature()) return;
    this.savingSignature.set(true);
    this.signatures.save({ imageDataUrl: trazo }).subscribe({
      next: (firma) => {
        this.signature.set(firma);
        this.draftSignature.set(null);
        this.redrawing.set(false);
        this.savingSignature.set(false);
        this.toast.success(
          'Firma registrada',
          'Aparecerá en sus certificados y en las actas de asistencia.',
        );
      },
      error: () => this.savingSignature.set(false),
    });
  }

  redoSignature(): void {
    this.draftSignature.set(null);
    this.redrawing.set(true);
  }

  deleteSignature(): void {
    this.signatures.remove().subscribe({
      next: () => {
        this.signature.set(null);
        this.redrawing.set(false);
        this.toast.success('Firma eliminada');
      },
    });
  }

  useLabel(use: SignatureUse): string {
    switch (use) {
      case SignatureUse.Attendance:
        return 'Asistencia';
      case SignatureUse.Viewing:
        return 'Visualización';
      default:
        return 'Firma de perfil';
    }
  }

  /* ------------------------- Verificación en dos pasos ------------------- */

  /** Datos de la configuración en curso; null si no se ha iniciado. */
  readonly twoFactorSetup = signal<{ secret: string; otpauthUrl: string } | null>(null);
  readonly recoveryCodes = signal<string[]>([]);
  readonly twoFactorCode = signal('');
  readonly disablePassword = signal('');
  readonly twoFactorBusy = signal(false);

  startTwoFactor(): void {
    this.twoFactorBusy.set(true);
    this.recoveryCodes.set([]);
    this.api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup').subscribe({
      next: (setup) => {
        this.twoFactorSetup.set(setup);
        this.twoFactorBusy.set(false);
      },
      error: () => this.twoFactorBusy.set(false),
    });
  }

  confirmTwoFactor(): void {
    const code = this.twoFactorCode().trim();
    if (code.length !== 6) {
      this.toast.warning('Código incompleto', 'Escriba los seis dígitos de la aplicación.');
      return;
    }
    this.twoFactorBusy.set(true);
    this.api.post<{ recoveryCodes: string[] }>('/auth/2fa/confirm', { code }).subscribe({
      next: (result) => {
        this.twoFactorBusy.set(false);
        this.twoFactorSetup.set(null);
        this.twoFactorCode.set('');
        this.recoveryCodes.set(result.recoveryCodes);
        this.auth.patchUser({ twoFactorEnabled: true });
        this.toast.success(
          'Verificación en dos pasos activada',
          'Guarde los códigos de recuperación en un lugar seguro.',
        );
      },
      error: () => this.twoFactorBusy.set(false),
    });
  }

  disableTwoFactor(): void {
    const password = this.disablePassword();
    if (!password) {
      this.toast.warning('Falta la contraseña', 'Confirme su identidad para desactivarlo.');
      return;
    }
    this.twoFactorBusy.set(true);
    this.api.post<{ disabled: boolean }>('/auth/2fa/disable', { password }).subscribe({
      next: () => {
        this.twoFactorBusy.set(false);
        this.disablePassword.set('');
        this.recoveryCodes.set([]);
        this.auth.patchUser({ twoFactorEnabled: false });
        this.toast.success('Verificación en dos pasos desactivada');
      },
      error: () => this.twoFactorBusy.set(false),
    });
  }

  /**
   * Enlace `otpauth://` en un QR generado por la propia aplicación
   * autenticadora no es posible sin librería; se ofrece el secreto para
   * introducirlo a mano, que es el mecanismo estándar de respaldo.
   */
  copySecret(): void {
    const secret = this.twoFactorSetup()?.secret;
    if (!secret) return;
    void navigator.clipboard?.writeText(secret).then(
      () => this.toast.success('Clave copiada'),
      () => this.toast.warning('No se pudo copiar', 'Selecciónela y cópiela a mano.'),
    );
  }

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
    this.loadSignature();
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
