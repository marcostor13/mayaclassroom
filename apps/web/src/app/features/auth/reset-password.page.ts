import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'maya-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <header class="maya-stack" style="gap: var(--maya-space-2); margin-bottom: var(--maya-space-6)">
      <h1 style="font-size: var(--maya-text-2xl)">Nueva contraseña</h1>
      <p class="maya-muted maya-small">Elija una contraseña segura que no use en otros sitios.</p>
    </header>

    <form [formGroup]="form" (ngSubmit)="submit()" class="maya-stack">
      <div class="maya-field">
        <label class="maya-label" for="rp-pass">Contraseña nueva</label>
        <input
          id="rp-pass"
          type="password"
          class="maya-input"
          formControlName="password"
          autocomplete="new-password"
        />
        <span class="maya-hint">Mínimo 8 caracteres.</span>
      </div>
      <div class="maya-field">
        <label class="maya-label" for="rp-repeat">Repita la contraseña</label>
        <input
          id="rp-repeat"
          type="password"
          class="maya-input"
          formControlName="repeat"
          autocomplete="new-password"
        />
        @if (mismatch()) {
          <span class="maya-error">Las contraseñas no coinciden.</span>
        }
      </div>
      <button
        type="submit"
        class="maya-btn maya-btn--primary maya-btn--lg maya-btn--block"
        [disabled]="form.invalid || mismatch() || submitting()"
      >
        Guardar contraseña
      </button>
      <a routerLink="/auth/login" class="maya-small" style="text-align: center">
        Volver al acceso
      </a>
    </form>
  `,
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    repeat: ['', [Validators.required]],
  });

  mismatch(): boolean {
    const { password, repeat } = this.form.getRawValue();
    return Boolean(repeat) && password !== repeat;
  }

  submit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token || this.form.invalid || this.mismatch()) return;

    this.submitting.set(true);
    this.auth.resetPassword(token, this.form.controls.password.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Contraseña actualizada', 'Ya puede acceder con su nueva contraseña.');
        void this.router.navigate(['/auth/login']);
      },
      error: () => this.submitting.set(false),
    });
  }
}
