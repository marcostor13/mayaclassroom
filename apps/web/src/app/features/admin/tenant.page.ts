import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TenantDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-admin-tenant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
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

  readonly settingsForm = this.fb.nonNullable.group({
    defaultLanguage: ['es'],
    timezone: ['Europe/Madrid'],
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
