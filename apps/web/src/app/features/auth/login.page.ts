import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DemoRole } from '@maya/shared';
import type { DemoAccessDto, LoginResponse, TenantChoice } from '@maya/shared';
import { AuthService, PublicTenantProfile } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
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

  /**
   * Empresas entre las que elegir. El hub vive dentro de esta misma pantalla,
   * y no en una ruta aparte, porque el testigo que autoriza el segundo paso
   * solo está en memoria: con una ruta propia, recargar dejaría la elección
   * sin nada con que completarse y habría que volver a pedir la contraseña.
   */
  readonly tenantChoices = signal<TenantChoice[]>([]);
  private tenantChoiceToken = '';

  /* --------------------------- Demostración ------------------------------- */

  readonly Papel = DemoRole;

  /**
   * Acceso de demostración.
   *
   * Se pregunta a la API y no se decide aquí: quien lo abre es el despliegue.
   * En la instalación de un cliente llega apagado y esta parte de la pantalla
   * no se pinta.
   */
  readonly demo = signal<DemoAccessDto | null>(null);
  readonly entrandoComo = signal<DemoRole | null>(null);

  constructor() {
    this.auth.demoAccess().subscribe({
      next: (demo) => this.demo.set(demo.enabled ? demo : null),
      // Sin demostración disponible la pantalla es la de siempre.
      error: () => this.demo.set(null),
    });
  }

  /** Dirección del escaparate de la empresa de demostración. */
  enlaceDemo(): string {
    const slug = this.demo()?.tenantSlug;
    return slug ? `/p/${slug}` : '/';
  }

  ofrece(role: DemoRole): boolean {
    return this.demo()?.roles.includes(role) ?? false;
  }

  entrarEnDemo(role: DemoRole): void {
    if (this.entrandoComo()) return;
    this.entrandoComo.set(role);
    this.auth.demoLogin(role).subscribe({
      next: (response) => {
        this.entrandoComo.set(null);
        this.handle(response);
      },
      error: () => this.entrandoComo.set(null),
    });
  }

  readonly form = this.fb.nonNullable.group({
    login: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    totp: [''],
    remember: [true],
  });

  togglePassword(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const { login, password, totp } = this.form.getRawValue();

    this.auth.login({ login, password, totp: totp || undefined }).subscribe({
      next: (response) => this.handle(response),
      error: () => this.submitting.set(false),
    });
  }

  /** Entra en la empresa elegida en el hub, sin repetir la contraseña. */
  chooseTenant(tenant: TenantChoice): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    const totp = this.form.controls.totp.value;
    this.auth
      .chooseTenant({
        tenantChoiceToken: this.tenantChoiceToken,
        tenantId: tenant.id,
        totp: totp || undefined,
      })
      .subscribe({
        next: (response) => this.handle(response),
        error: () => this.submitting.set(false),
      });
  }

  /** Vuelve del hub al formulario, por si se equivocó de cuenta. */
  cancelChoice(): void {
    this.tenantChoices.set([]);
    this.tenantChoiceToken = '';
  }

  private handle(response: LoginResponse): void {
    this.submitting.set(false);

    // El orden de estos tres desvíos es el del propio flujo: primero elegir
    // empresa, después el doble factor de esa empresa y por último la
    // contraseña temporal.
    if (response.requiresTenantChoice) {
      this.tenantChoices.set(response.tenants ?? []);
      this.tenantChoiceToken = response.tenantChoiceToken ?? '';
      return;
    }
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

    // La marca de la empresa a la que se ha entrado, ahora que ya se sabe
    // cuál es: antes el formulario la pedía por adelantado para poder pintarla.
    this.auth.tenantProfile(response.user.tenantSlug).subscribe({
      next: (profile) => {
        this.tenant.set(profile);
        this.theme.applyBranding(profile.branding);
      },
      error: () => this.tenant.set(null),
    });

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
  }

  invalid(control: 'login' | 'password' | 'totp'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }
}
