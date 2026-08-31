import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  template: `
    @if (sent()) {
      <div class="maya-stack" style="text-align: center; gap: var(--maya-space-4)">
        <div class="maya-empty__icon" style="margin-inline: auto">
          <maya-icon name="inbox" [size]="34" />
        </div>
        <h1 style="font-size: var(--maya-text-xl)">Revise su correo</h1>
        <p class="maya-muted maya-small">
          Si la dirección está registrada recibirá un enlace para crear una contraseña nueva.
          El enlace caduca en una hora.
        </p>
        <a routerLink="/auth/login" class="maya-btn maya-btn--secondary maya-btn--block">
          Volver al acceso
        </a>
      </div>
    } @else {
      <header class="maya-stack" style="gap: var(--maya-space-2); margin-bottom: var(--maya-space-6)">
        <h1 style="font-size: var(--maya-text-2xl)">Recuperar contraseña</h1>
        <p class="maya-muted maya-small">
          Le enviaremos un enlace seguro para restablecerla.
        </p>
      </header>

      <form [formGroup]="form" (ngSubmit)="submit()" class="maya-stack">
        <div class="maya-field">
          <label class="maya-label" for="fp-tenant">Empresa</label>
          <input id="fp-tenant" class="maya-input" formControlName="tenantSlug" />
        </div>
        <div class="maya-field">
          <label class="maya-label" for="fp-email">Correo electrónico</label>
          <input id="fp-email" type="email" class="maya-input" formControlName="email" />
        </div>
        <button
          type="submit"
          class="maya-btn maya-btn--primary maya-btn--lg maya-btn--block"
          [disabled]="form.invalid || submitting()"
        >
          Enviar enlace
        </button>
        <a routerLink="/auth/login" class="maya-small" style="text-align: center">
          Volver al acceso
        </a>
      </form>
    }
  `,
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly sent = signal(false);

  readonly form = this.fb.nonNullable.group({
    tenantSlug: [this.auth.tenantSlug() || 'demo', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);
    const { email, tenantSlug } = this.form.getRawValue();
    this.auth.forgotPassword(email, tenantSlug).subscribe({
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: () => this.submitting.set(false),
    });
  }
}
