import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CapabilityDefinition, PermissionValue } from '@maya/shared';
import { AdminService, RoleSummary } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-admin-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  templateUrl: './roles.page.html',
  styleUrl: './roles.page.scss',
})
export class AdminRolesPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly PermissionValue = PermissionValue;

  readonly roles = signal<RoleSummary[]>([]);
  readonly selectedRole = signal<RoleSummary | null>(null);
  readonly catalog = signal<Record<string, CapabilityDefinition[]>>({});
  readonly permissions = signal<Record<string, number>>({});
  readonly loading = signal(true);
  readonly filter = signal('');

  readonly components = computed(() => Object.keys(this.catalog()).sort());

  readonly visibleCatalog = computed(() => {
    const term = this.filter().trim().toLowerCase();
    const catalog = this.catalog();
    if (!term) return catalog;
    const filtered: Record<string, CapabilityDefinition[]> = {};
    for (const [component, items] of Object.entries(catalog)) {
      const matches = items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) || item.title.toLowerCase().includes(term),
      );
      if (matches.length) filtered[component] = matches;
    }
    return filtered;
  });

  readonly grantedCount = computed(
    () => Object.values(this.permissions()).filter((value) => value === PermissionValue.Allow).length,
  );

  constructor() {
    this.admin.roles().subscribe({
      next: (roles) => {
        this.roles.set(roles);
        if (roles.length) this.select(roles[0]);
      },
    });
    this.admin.capabilityCatalog().subscribe({
      next: (result) => {
        this.catalog.set(result.byComponent);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  select(role: RoleSummary): void {
    this.selectedRole.set(role);
    this.admin.roleCapabilities(role.id).subscribe({
      next: (permissions) => this.permissions.set(permissions),
    });
  }

  setPermission(capability: string, permission: number): void {
    const role = this.selectedRole();
    if (!role) return;
    this.admin.setRoleCapability(role.id, capability, permission).subscribe({
      next: () => {
        this.permissions.update((map) => ({ ...map, [capability]: permission }));
        this.toast.success('Permiso actualizado');
      },
    });
  }

  valueOf(capability: string): number {
    return this.permissions()[capability] ?? PermissionValue.NotSet;
  }

  componentLabel(component: string): string {
    if (component === 'core') return 'Núcleo de la plataforma';
    if (component.startsWith('mod/')) return `Actividad · ${component.replace('mod/', '')}`;
    if (component.startsWith('report/')) return `Informe · ${component.replace('report/', '')}`;
    return component;
  }
}
