import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantAdminCredentials, TenantDto, TenantPlan, TenantStatus } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, FormatDatePipe, IconComponent } from '../../shared';
import { ConfirmService } from '../../core/services/confirm.service';

type FormField =
  | 'slug'
  | 'name'
  | 'contactEmail'
  | 'legalName'
  | 'taxId'
  | 'domain'
  | 'contactPhone'
  | 'adminEmail'
  | 'adminFirstName'
  | 'adminLastName'
  | 'plan'
  | 'status';

/**
 * Alta y gobierno de las empresas de la plataforma. Es la única pantalla de
 * ámbito global: el resto de la administración trabaja siempre dentro de una
 * empresa. Reservada a administradores de plataforma, igual que los endpoints
 * que consume (`@PlatformAdminOnly` en `tenants.controller.ts`).
 *
 * El alta crea también la cuenta de quien administrará la empresa, con una
 * contraseña temporal que solo se ve una vez: la respuesta del servidor es la
 * única ocasión de copiarla, de ahí el panel de credenciales.
 */
@Component({
  selector: 'maya-admin-tenants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    FormatDatePipe,
  ],
  templateUrl: './tenants.page.html',
})
export class AdminTenantsPage {
  private readonly admin = inject(AdminService);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly TenantStatus = TenantStatus;

  readonly tenants = signal<TenantDto[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly status = signal('');
  readonly creating = signal(false);
  readonly submitting = signal(false);
  /** Credenciales del último alta, visibles hasta que se cierran a mano. */
  readonly credentials = signal<{
    tenant: string;
    tenantId: string;
    admin: TenantAdminCredentials;
  } | null>(null);
  readonly passwordCopied = signal(false);

  readonly plans = [
    { value: TenantPlan.Free, label: 'Gratuito' },
    { value: TenantPlan.Starter, label: 'Inicial' },
    { value: TenantPlan.Business, label: 'Empresa' },
    { value: TenantPlan.Enterprise, label: 'Corporativo' },
  ];

  readonly form = this.fb.nonNullable.group({
    // Las reglas replican las del servidor (`CreateTenantDto`) para avisar
    // antes de enviar, no después de un 400.
    slug: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(40),
        Validators.pattern(/^[a-z0-9][a-z0-9-]*$/),
      ],
    ],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    legalName: [''],
    taxId: [''],
    domain: [''],
    contactPhone: [''],
    adminEmail: ['', [Validators.email]],
    adminFirstName: ['', [Validators.maxLength(80)]],
    adminLastName: ['', [Validators.maxLength(80)]],
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

  /** ¿Debe marcarse el campo en rojo y mostrar su mensaje? */
  invalid(control: FormField): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.dirty || field.touched);
  }

  /** Mensaje concreto del primer error del campo. */
  error(control: FormField): string {
    const errors = this.form.controls[control].errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['email']) return 'El correo electrónico no es válido.';
    if (errors['pattern']) {
      return 'Solo minúsculas, números y guiones, empezando por letra o número.';
    }
    if (errors['minlength']) {
      return `Debe tener al menos ${errors['minlength'].requiredLength} caracteres.`;
    }
    if (errors['maxlength']) {
      return `No puede superar los ${errors['maxlength'].requiredLength} caracteres.`;
    }
    return 'El valor no es válido.';
  }

  openForm(): void {
    this.creating.set(true);
    this.credentials.set(null);
  }

  cancel(): void {
    this.creating.set(false);
    this.resetForm();
  }

  /** Deriva el identificador del nombre mientras no se haya tocado a mano. */
  suggestSlug(): void {
    const slug = this.form.controls.slug;
    if (slug.dirty && slug.value) return;
    const suggestion = this.form.controls.name.value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    if (suggestion) slug.setValue(suggestion);
  }

  create(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(
        'Faltan datos',
        'Revise los campos marcados en rojo antes de crear la empresa.',
      );
      return;
    }

    // Los opcionales vacíos se omiten: el servidor los valida si vienen.
    const raw = this.form.getRawValue();
    const payload = Object.fromEntries(
      Object.entries(raw).filter(([, value]) => value !== '' && value !== null),
    );

    this.submitting.set(true);
    this.admin.createTenant(payload).subscribe({
      next: (result) => {
        this.submitting.set(false);
        this.creating.set(false);
        this.resetForm();
        this.credentials.set({
          tenant: result.tenant.name,
          tenantId: result.tenant.id,
          admin: result.admin,
        });
        this.passwordCopied.set(false);
        this.toast.success(
          'Empresa creada',
          `«${result.tenant.name}» ya tiene su cuenta de administración.`,
        );
        this.load();
      },
      // El aviso del error lo da `errorInterceptor`; aquí solo se reactiva el
      // botón para poder corregir y reintentar.
      error: () => this.submitting.set(false),
    });
  }

  async copyPassword(): Promise<void> {
    const password = this.credentials()?.admin.temporaryPassword;
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
    this.confirm
      .ask({
        title: 'Dar de baja la empresa',
        message: `Se dará de baja «${tenant.name}» con todos sus cursos, usuarios y calificaciones. Esta acción no se puede deshacer.`,
        confirmLabel: 'Dar de baja',
        requireText: tenant.slug,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.admin.deleteTenant(tenant.id).subscribe({
          next: () => {
            this.tenants.update((list) => list.filter((item) => item.id !== tenant.id));
            this.total.update((n) => Math.max(0, n - 1));
            this.toast.success('Empresa dada de baja');
          },
        });
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

  private resetForm(): void {
    this.form.reset({ plan: TenantPlan.Free, status: TenantStatus.Trial });
  }
}
