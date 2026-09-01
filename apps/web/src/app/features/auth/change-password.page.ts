import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

/** Las dos contraseñas nuevas deben coincidir. */
function passwordsMatch(group: AbstractControl): { mismatch: true } | null {
  const password = group.get('newPassword')?.value as string;
  const repeat = group.get('repeatPassword')?.value as string;
  return password && repeat && password !== repeat ? { mismatch: true } : null;
}

/**
 * Cambio de contraseña obligatorio. Es la única pantalla accesible para quien
 * entra con la contraseña temporal de un alta: `passwordChangeGuard` desvía
 * aquí cualquier otra ruta y `PasswordChangeGuard` hace lo propio en la API,
 * de modo que la obligación no depende del cliente.
 *
 * Al cambiarla, el servidor revoca todas las sesiones, así que se cierra la
 * actual y se vuelve al acceso con las credenciales nuevas.
 */
@Component({
  selector: 'maya-change-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  templateUrl: './change-password.page.html',
})
export class ChangePasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);
  readonly showPassword = signal(false);

  readonly user = this.auth.user;
  /** Obligatorio (contraseña temporal) frente a voluntario (desde el perfil). */
  readonly forced = computed(() => this.auth.mustChangePassword());

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      repeatPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  invalid(control: 'currentPassword' | 'newPassword' | 'repeatPassword'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }

  get mismatch(): boolean {
    return (
      this.form.hasError('mismatch') &&
      (this.form.controls.repeatPassword.dirty || this.form.controls.repeatPassword.touched)
    );
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success(
          'Contraseña actualizada',
          'Vuelva a acceder con su contraseña nueva.',
        );
        // El servidor ha revocado las sesiones: la actual ya no sirve.
        this.auth.logout(false);
        void this.router.navigate(['/auth/login']);
      },
      error: () => this.submitting.set(false),
    });
  }

  cancel(): void {
    void this.router.navigate(['/dashboard']);
  }
}
