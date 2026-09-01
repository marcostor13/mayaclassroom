import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, PublicTenantProfile } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly requiresTwoFactor = signal(false);
  readonly tenant = signal<PublicTenantProfile | null>(null);

  readonly form = this.fb.nonNullable.group({
    tenantSlug: [this.auth.tenantSlug() || 'demo', [Validators.required]],
    login: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    totp: [''],
    remember: [true],
  });

  constructor() {
    const slug = this.form.controls.tenantSlug.value;
    if (slug) this.loadTenant(slug);
  }

  loadTenant(slug: string): void {
    if (!slug) return;
    this.auth.tenantProfile(slug).subscribe({
      next: (profile) => {
        this.tenant.set(profile);
        this.theme.applyBranding(profile.branding);
      },
      error: () => this.tenant.set(null),
    });
  }

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { tenantSlug, login, password, totp } = this.form.getRawValue();

    this.auth.login({ tenantSlug, login, password, totp: totp || undefined }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (response.requiresTwoFactor) {
          this.requiresTwoFactor.set(true);
          this.form.controls.totp.addValidators([Validators.required]);
          this.form.controls.totp.updateValueAndValidity();
          this.toast.info(
            'Verificación en dos pasos',
            'Introduzca el código de su aplicación de autenticación.',
          );
          return;
        }
        if (response.user.mustChangePassword) {
          this.toast.info(
            'Contraseña temporal',
            'Elija una contraseña propia para empezar a usar la plataforma.',
          );
          void this.router.navigate(['/password-change']);
          return;
        }
        this.toast.success(`Hola de nuevo, ${response.user.firstName}`);
        const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/dashboard';
        void this.router.navigateByUrl(redirect);
      },
      error: () => this.submitting.set(false),
    });
  }

  invalid(control: 'tenantSlug' | 'login' | 'password' | 'totp'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }
}
