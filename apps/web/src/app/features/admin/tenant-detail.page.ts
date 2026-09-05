import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  SIN_LIMITE,
  TenantAdminCredentials,
  TenantDto,
  TenantPlan,
  TenantStatus,
  formatBytes,
} from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { FormatDatePipe, IconComponent } from '../../shared';

/**
 * Ficha de una empresa vista desde la administración de plataforma.
 *
 * Existe como ruta propia, y no como panel desplegable dentro del listado, por
 * una razón concreta: los datos del alta vivían solo en memoria y bastaba
 * recargar para perderlos sin manera de volver a verlos. Con la empresa en la
 * URL, la ficha se puede recargar, compartir y guardar en marcadores.
 *
 * La contraseña temporal es la única excepción: no se guarda en claro en
 * ninguna parte, así que aquí no se muestra la del alta sino que se emite otra
 * bajo petición.
 */
@Component({
  selector: 'maya-admin-tenant-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FormatDatePipe],
  templateUrl: './tenant-detail.page.html',
})
export class AdminTenantDetailPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Llega de la ruta `admin/tenants/:id` con `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  readonly TenantStatus = TenantStatus;

  /** Un tope que no limita se escribe, no se enseña como un número enorme. */
  limite(valor: number): string {
    return valor >= SIN_LIMITE ? 'sin límite' : String(valor);
  }

  /**
   * Consumo de disco de la empresa.
   *
   * Se enseña aquí porque es el aviso temprano de que un cliente se ha vuelto
   * caro: el almacenamiento es la mayor parte del coste variable y, cuando
   * aparece en la factura, ya lleva meses creciendo.
   */
  almacenamiento(t: TenantDto): { usado: string; tope: string; pct: number } {
    const { usedStorageBytes: usado, maxStorageBytes: tope } = t.limits;
    return {
      usado: formatBytes(usado),
      tope: tope >= SIN_LIMITE ? 'sin límite' : formatBytes(tope),
      pct: tope > 0 && tope < SIN_LIMITE ? Math.min(100, Math.round((usado / tope) * 100)) : 0,
    };
  }

  readonly tenant = signal<TenantDto | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly resetting = signal(false);
  /** Credenciales recién emitidas; se pierden al salir, como debe ser. */
  readonly credentials = signal<TenantAdminCredentials | null>(null);
  readonly passwordCopied = signal(false);

  // En `ngOnInit` y no en el constructor: las entradas enlazadas desde la ruta
  // todavía no tienen valor cuando se construye el componente.
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.admin.tenant(this.id()).subscribe({
      next: (tenant) => {
        this.tenant.set(tenant);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  setStatus(status: TenantStatus): void {
    const current = this.tenant();
    if (!current) return;
    this.admin.setTenantStatus(current.id, status).subscribe({
      next: (updated) => {
        this.tenant.set(updated);
        this.toast.success('Estado actualizado');
      },
    });
  }

  /**
   * Emite una contraseña temporal nueva. Se pide confirmación porque invalida
   * la anterior: si su titular ya estaba usándola, deja de servirle.
   */
  resetPassword(): void {
    const current = this.tenant();
    if (!current || this.resetting()) return;
    this.confirm
      .ask({
        title: 'Emitir una contraseña nueva',
        message:
          `Se generará otra contraseña temporal para la administración de «${current.name}» y ` +
          'se enviará por correo. La contraseña anterior dejará de servir.',
        confirmLabel: 'Emitir',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.resetting.set(true);
        this.admin.resetTenantAdminPassword(current.id).subscribe({
          next: (credentials) => {
            this.resetting.set(false);
            this.credentials.set(credentials);
            this.passwordCopied.set(false);
            this.toast.success('Contraseña emitida');
          },
          error: () => this.resetting.set(false),
        });
      });
  }

  async copyPassword(): Promise<void> {
    const password = this.credentials()?.temporaryPassword;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      this.passwordCopied.set(true);
    } catch {
      this.toast.warning('No se pudo copiar', 'Seleccione la contraseña y cópiela a mano.');
    }
  }

  dismissCredentials(): void {
    this.credentials.set(null);
  }

  back(): void {
    void this.router.navigate(['/admin/tenants']);
  }

  statusLabel(status: TenantStatus): string {
    switch (status) {
      case TenantStatus.Active:
        return 'Activa';
      case TenantStatus.Trial:
        return 'En pruebas';
      case TenantStatus.Suspended:
        return 'Suspendida';
      default:
        return 'Archivada';
    }
  }

  planLabel(plan: TenantPlan): string {
    switch (plan) {
      case TenantPlan.Free:
        return 'Gratuito';
      case TenantPlan.Starter:
        return 'Inicial';
      case TenantPlan.Business:
        return 'Empresa';
      default:
        return 'Corporativo';
    }
  }
}
