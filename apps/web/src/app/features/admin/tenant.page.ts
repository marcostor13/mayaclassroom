import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DEFAULT_TIMEZONE, TenantDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, ImageUploadComponent } from '../../shared';

@Component({
  selector: 'maya-admin-tenant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, ImageUploadComponent],
  templateUrl: './tenant.page.html',
})
export class AdminTenantPage {
  private readonly admin = inject(AdminService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly tenant = signal<TenantDto | null>(null);
  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [''],
    legalName: [''],
    contactEmail: [''],
    contactPhone: [''],
    domain: [''],
  });

  readonly brandingForm = this.fb.nonNullable.group({
    primaryColor: ['#FF3B2E'],
    accentColor: ['#FFB020'],
    logoUrl: [''],
    welcomeMessage: [''],
  });

  /**
   * El logotipo se lleva aparte del formulario reactivo porque el componente de
   * subida trabaja con señales: mantenerlo como control obligaría a sincronizar
   * las dos direcciones a mano cada vez que termina una subida.
   */
  readonly logoUrl = signal<string | null>(null);

  setLogo(url: string | null): void {
    this.logoUrl.set(url);
    this.brandingForm.controls.logoUrl.setValue(url ?? '');
    this.brandingForm.markAsDirty();
  }

  readonly settingsForm = this.fb.nonNullable.group({
    defaultLanguage: ['es'],
    timezone: [DEFAULT_TIMEZONE],
    allowSelfRegistration: [false],
    requireEmailVerification: [true],
    allowGuestAccess: [false],
    enforceTwoFactor: [false],
  });

  constructor() {
    this.admin.myTenant().subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.form.patchValue({
          name: tenant.name,
          legalName: tenant.legalName ?? '',
          contactEmail: tenant.contactEmail,
          contactPhone: tenant.contactPhone ?? '',
          domain: tenant.domain ?? '',
        });
        this.brandingForm.patchValue({
          primaryColor: tenant.branding.primaryColor,
          accentColor: tenant.branding.accentColor,
          logoUrl: tenant.branding.logoUrl ?? '',
          welcomeMessage: tenant.branding.welcomeMessage ?? '',
        });
        this.logoUrl.set(tenant.branding.logoUrl ?? null);
        this.settingsForm.patchValue(tenant.settings);
      },
    });
  }

  previewBranding(): void {
    this.theme.applyBranding({
      ...this.brandingForm.getRawValue(),
      logoUrl: this.brandingForm.controls.logoUrl.value || null,
      faviconUrl: null,
      loginBackgroundUrl: null,
      customCss: null,
    });
  }

  save(): void {
    this.saving.set(true);
    this.admin
      .updateMyTenant({
        ...this.form.getRawValue(),
        branding: this.brandingForm.getRawValue(),
        settings: this.settingsForm.getRawValue(),
      })
      .subscribe({
        next: (tenant) => {
          this.tenant.set(tenant);
          this.theme.applyBranding(tenant.branding);
          this.saving.set(false);
          this.toast.success('Configuración guardada');
        },
        error: () => this.saving.set(false),
      });
  }
}
