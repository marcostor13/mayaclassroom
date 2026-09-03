import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DEFAULT_TIMEZONE, TenantDomainStatus } from '@maya/shared';
import type { TenantDomainDto, TenantDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { FormatDatePipe, IconComponent, ImageUploadComponent } from '../../shared';

@Component({
  selector: 'maya-admin-tenant',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    FormatDatePipe,
    IconComponent,
    ImageUploadComponent,
  ],
  templateUrl: './tenant.page.html',
  styleUrl: './tenant.page.scss',
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
    this.cargarDominio();
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

  /* ----------------------------- Dominio propio --------------------------- */

  /**
   * El dominio propio no va con el resto del formulario a propósito.
   *
   * Guardar aquí no cambia nada visible: el dominio empieza a servir cuando el
   * DNS de la empresa apunta a donde debe y la API lo comprueba. Mezclarlo con
   * «Guardar cambios» haría creer que con escribirlo ya está, que es
   * exactamente lo que pasaba antes, cuando el campo se guardaba y no servía
   * para nada.
   */
  readonly dominio = signal<TenantDomainDto | null>(null);
  readonly hostname = signal('');
  readonly trabajando = signal(false);

  /** El despliegue no ofrece la función; la sección lo dice en vez de callar. */
  readonly dominioNoDisponible = signal(false);

  private cargarDominio(): void {
    this.admin.myDomain().subscribe({
      next: (estado) => {
        this.dominio.set(estado);
        this.hostname.set(estado.hostname ?? '');
      },
      // 503 es «este despliegue no lo admite»; cualquier otro fallo deja la
      // sección en su estado inicial, que ya invita a reservar un dominio.
      error: (error: { status?: number }) => this.dominioNoDisponible.set(error?.status === 503),
    });
  }

  private aplicar(estado: TenantDomainDto, mensaje?: string): void {
    this.dominio.set(estado);
    this.hostname.set(estado.hostname ?? '');
    this.trabajando.set(false);
    if (mensaje) this.toast.success(mensaje);
  }

  guardarDominio(): void {
    const host = this.hostname().trim();
    if (!host) return;
    this.trabajando.set(true);
    this.admin.setMyDomain(host).subscribe({
      next: (estado) =>
        this.aplicar(estado, 'Dominio reservado. Cree los dos registros en su DNS.'),
      error: () => this.trabajando.set(false),
    });
  }

  /**
   * Comprobar no falla aunque el DNS no esté: la API devuelve el estado con el
   * motivo dentro, porque «todavía no se ve el registro» es el resultado
   * normal de los primeros minutos, no un error que merezca una alerta roja.
   */
  comprobarDominio(): void {
    this.trabajando.set(true);
    this.admin.verifyMyDomain().subscribe({
      next: (estado) => {
        this.aplicar(estado);
        if (estado.status === TenantDomainStatus.Active) {
          this.toast.success(`${estado.hostname} ya sirve su página pública.`);
        }
      },
      error: () => this.trabajando.set(false),
    });
  }

  quitarDominio(): void {
    this.trabajando.set(true);
    this.admin.removeMyDomain().subscribe({
      next: (estado) => this.aplicar(estado, 'Dominio retirado.'),
      error: () => this.trabajando.set(false),
    });
  }

  async copiar(valor: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(valor);
      this.toast.success('Copiado');
    } catch {
      // Sin permiso de portapapeles (http, ajustes estrictos) el valor sigue
      // a la vista para seleccionarlo a mano: no hace falta alarmar.
    }
  }
}
