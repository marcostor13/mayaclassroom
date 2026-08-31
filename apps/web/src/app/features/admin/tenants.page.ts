import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TenantDto, TenantPlan, TenantStatus } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, FormatDatePipe, IconComponent } from '../../shared';

/**
 * Alta y gobierno de las empresas de la plataforma. Es la única pantalla de
 * ámbito global: el resto de la administración trabaja siempre dentro de una
 * empresa. Reservada a administradores de plataforma, igual que los endpoints
 * que consume (`@PlatformAdminOnly` en `tenants.controller.ts`).
 */
@Component({
  selector: 'maya-admin-tenants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, IconComponent, EmptyStateComponent, FormatDatePipe],
  templateUrl: './tenants.page.html',
})
export class AdminTenantsPage {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly TenantStatus = TenantStatus;

  readonly tenants = signal<TenantDto[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly status = signal('');
  readonly creating = signal(false);

  readonly plans = [
    { value: TenantPlan.Free, label: 'Gratuito' },
    { value: TenantPlan.Starter, label: 'Inicial' },
    { value: TenantPlan.Business, label: 'Empresa' },
    { value: TenantPlan.Enterprise, label: 'Corporativo' },
  ];

  readonly form = this.fb.nonNullable.group({
    // El patrón replica la validación del servidor para avisar antes de enviar.
    slug: ['', [Validators.required, Validators.maxLength(40), Validators.pattern(/^[a-z0-9-]+$/)]],
    name: ['', [Validators.required]],
    contactEmail: ['', [Validators.required, Validators.email]],
    legalName: [''],
    taxId: [''],
    domain: [''],
    contactPhone: [''],
    plan: [TenantPlan.Free],
    status: [TenantStatus.Trial],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.admin
      .tenants({ limit: 50, search: this.search() || undefined, status: this.status() || undefined })
      .subscribe({
        next: (result) => {
          this.tenants.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Los opcionales vacíos se omiten: el servidor los valida si vienen.
    const raw = this.form.getRawValue();
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== '' && value !== null),
    );
    this.admin.createTenant(payload).subscribe({
      next: (tenant) => {
        this.toast.success('Empresa creada', `«${tenant.name}» ya puede recibir usuarios.`);
        this.form.reset({ plan: TenantPlan.Free, status: TenantStatus.Trial });
        this.creating.set(false);
        this.load();
      },
    });
  }

  setStatus(tenant: TenantDto, status: TenantStatus): void {
    this.admin.setTenantStatus(tenant.id, status).subscribe({
      next: (updated) => {
        this.tenants.update((list) =>
          list.map((item) => (item.id === tenant.id ? updated : item)),
        );
        this.toast.success('Estado actualizado');
      },
    });
  }

  remove(tenant: TenantDto): void {
    this.admin.deleteTenant(tenant.id).subscribe({
      next: () => {
        this.tenants.update((list) => list.filter((item) => item.id !== tenant.id));
        this.total.update((n) => Math.max(0, n - 1));
        this.toast.success('Empresa dada de baja');
      },
    });
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
    return this.plans.find((p) => p.value === plan)?.label ?? plan;
  }
}
