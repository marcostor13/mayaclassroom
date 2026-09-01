import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CAP,
  CourseBackupDto,
  CourseSummary,
  CustomFieldDto,
  CustomFieldScope,
  CustomFieldType,
  DataRequestDto,
  ScheduledTaskDto,
  ScheduledTaskStatus,
  TagDto,
  WebServiceTokenDto,
  WebhookDto,
} from '@maya/shared';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { CoursesService } from '../../../core/services/courses.service';
import { LogEntry, PlatformService } from '../../../core/services/platform.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  EmptyStateComponent,
  FileSizePipe,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
} from '../../../shared';

type Seccion = 'logs' | 'backups' | 'tags' | 'fields' | 'privacy' | 'services' | 'tasks';

/**
 * Administración del sitio. Reúne en un solo lugar las capacidades de
 * plataforma que la API ya ofrecía y que no tenían interfaz: registro de
 * eventos, copias de seguridad, etiquetas, campos personalizados, RGPD,
 * servicios web y tareas programadas.
 */
@Component({
  selector: 'maya-admin-site',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    EmptyStateComponent,
    FormatDatePipe,
    FileSizePipe,
    ModalComponent,
  ],
  templateUrl: './site.page.html',
})
export class AdminSitePage {
  private readonly platform = inject(PlatformService);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly section = signal<Seccion>('logs');
  readonly loading = signal(false);
  readonly saving = signal(false);

  readonly logs = signal<LogEntry[]>([]);
  readonly backups = signal<CourseBackupDto[]>([]);
  readonly tags = signal<TagDto[]>([]);
  readonly fields = signal<CustomFieldDto[]>([]);
  readonly requests = signal<DataRequestDto[]>([]);
  readonly tokens = signal<WebServiceTokenDto[]>([]);
  readonly webhooks = signal<WebhookDto[]>([]);
  readonly tasks = signal<ScheduledTaskDto[]>([]);
  readonly myCourses = signal<CourseSummary[]>([]);

  readonly logSearch = signal('');
  readonly tagSearch = signal('');
  readonly backupCourseId = signal('');
  readonly backupIncludeUsers = signal(false);

  readonly fieldFormOpen = signal(false);
  readonly tokenFormOpen = signal(false);
  readonly webhookFormOpen = signal(false);
  /** Valor completo del token recién creado: sólo se muestra una vez. */
  readonly freshToken = signal<string | null>(null);

  readonly canViewLogs = computed(() =>
    this.auth.canAny([CAP.REPORT_VIEW_LOGS, CAP.SITE_VIEW_AUDIT]),
  );
  readonly canBackup = computed(() => this.auth.can(CAP.BACKUP_COURSE));
  readonly canManageTags = computed(() => this.auth.can(CAP.TAG_MANAGE));
  readonly canManageFields = computed(() => this.auth.can(CAP.CUSTOMFIELD_MANAGE));
  readonly canManageGdpr = computed(() => this.auth.can(CAP.GDPR_MANAGE_REQUESTS));
  readonly canManageServices = computed(() => this.auth.can(CAP.TENANT_MANAGE_WEBSERVICES));
  readonly isPlatformAdmin = computed(() => this.auth.user()?.isPlatformAdmin ?? false);

  /** Secciones visibles según las capacidades de quien mira. */
  readonly sections = computed(() =>
    [
      { key: 'logs' as const, label: 'Registros', icon: 'list-checks', visible: this.canViewLogs() },
      { key: 'backups' as const, label: 'Copias', icon: 'database', visible: this.canBackup() },
      { key: 'tags' as const, label: 'Etiquetas', icon: 'tag', visible: this.canManageTags() },
      {
        key: 'fields' as const,
        label: 'Campos',
        icon: 'sliders',
        visible: this.canManageFields(),
      },
      { key: 'privacy' as const, label: 'RGPD', icon: 'shield', visible: this.canManageGdpr() },
      {
        key: 'services' as const,
        label: 'Servicios web',
        icon: 'plug',
        visible: this.canManageServices(),
      },
      {
        key: 'tasks' as const,
        label: 'Tareas',
        icon: 'clock',
        visible: this.isPlatformAdmin(),
      },
    ].filter((item) => item.visible),
  );

  readonly fieldForm = this.fb.nonNullable.group({
    scope: [CustomFieldScope.User as CustomFieldScope],
    shortName: ['', [Validators.required]],
    name: ['', [Validators.required]],
    type: [CustomFieldType.Text as CustomFieldType],
    categoryName: [''],
    description: [''],
    required: [false],
    /** Una opción por línea, sólo para los campos de tipo lista. */
    options: [''],
  });

  readonly tokenForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    scopes: ['read'],
    expiresAt: [''],
  });

  readonly webhookForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    url: ['', [Validators.required]],
    events: ['course.completed'],
    secret: [''],
  });

  constructor() {
    // Se abre la primera sección a la que se tenga acceso.
    const first = this.sections()[0];
    if (first) this.select(first.key);
    this.courses.list({ limit: 200 }).subscribe({
      next: (result) => this.myCourses.set(result.items),
    });
  }

  select(section: Seccion): void {
    this.section.set(section);
    this.loading.set(true);
    const done = { next: () => this.loading.set(false), error: () => this.loading.set(false) };

    switch (section) {
      case 'logs':
        this.platform.logs({ limit: 50, search: this.logSearch() || undefined }).subscribe({
          next: (result) => {
            this.logs.set(result.items);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
      case 'backups':
        this.platform.backups().subscribe({
          next: (list) => {
            this.backups.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
      case 'tags':
        this.platform.tags(this.tagSearch() || undefined).subscribe({
          next: (list) => {
            this.tags.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
      case 'fields':
        this.platform.customFields().subscribe({
          next: (list) => {
            this.fields.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
      case 'privacy':
        this.platform.privacyRequests().subscribe({
          next: (list) => {
            this.requests.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
      case 'services':
        this.platform.tokens().subscribe({
          next: (list) => {
            this.tokens.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        this.platform.webhooks().subscribe({ next: (list) => this.webhooks.set(list) });
        break;
      case 'tasks':
        this.platform.scheduledTasks().subscribe({
          next: (list) => {
            this.tasks.set(list);
            this.loading.set(false);
          },
          error: done.error,
        });
        break;
    }
  }

  courseName(courseId: string): string {
    return this.myCourses().find((course) => course.id === courseId)?.fullName ?? courseId;
  }

  /* ------------------------ Copias de seguridad -------------------------- */

  createBackup(): void {
    const courseId = this.backupCourseId();
    if (!courseId) {
      this.toast.warning('Falta el curso', 'Elija de qué curso quiere la copia.');
      return;
    }
    this.saving.set(true);
    this.platform.createBackup(courseId, this.backupIncludeUsers()).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Copia creada');
        this.select('backups');
      },
      error: () => this.saving.set(false),
    });
  }

  downloadBackup(backup: CourseBackupDto): void {
    this.platform.downloadBackup(backup.id).subscribe({
      next: (blob) => saveBlob(blob, backup.filename),
    });
  }

  removeBackup(backup: CourseBackupDto): void {
    this.confirm
      .ask({
        title: 'Eliminar copia de seguridad',
        message: `Se eliminará «${backup.filename}». No se podrá restaurar a partir de ella.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.platform.deleteBackup(backup.id).subscribe({
          next: () => {
            this.backups.update((list) => list.filter((item) => item.id !== backup.id));
            this.toast.success('Copia eliminada');
          },
        });
      });
  }

  /* ------------------------------ Etiquetas ------------------------------ */

  toggleStandard(tag: TagDto): void {
    this.platform.setTagStandard(tag.id, !tag.isStandard).subscribe({
      next: (updated) => {
        this.tags.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      },
    });
  }

  removeTag(tag: TagDto): void {
    this.confirm
      .ask({
        title: 'Eliminar etiqueta',
        message: `Se eliminará «${tag.rawName}» de los ${tag.usageCount} elementos que la usan.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.platform.deleteTag(tag.id).subscribe({
          next: () => {
            this.tags.update((list) => list.filter((item) => item.id !== tag.id));
            this.toast.success('Etiqueta eliminada');
          },
        });
      });
  }

  /* ------------------------ Campos personalizados ------------------------ */

  openNewField(): void {
    this.fieldForm.reset({
      scope: CustomFieldScope.User,
      shortName: '',
      name: '',
      type: CustomFieldType.Text,
      categoryName: '',
      description: '',
      required: false,
      options: '',
    });
    this.fieldFormOpen.set(true);
  }

  saveField(): void {
    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      return;
    }
    const value = this.fieldForm.getRawValue();
    const options = value.options
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    this.saving.set(true);
    this.platform
      .createCustomField({
        scope: value.scope,
        shortName: value.shortName.trim(),
        name: value.name.trim(),
        type: value.type,
        categoryName: value.categoryName.trim() || undefined,
        description: value.description.trim() || undefined,
        required: value.required,
        ...(options.length ? { options } : {}),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Campo creado');
          this.fieldFormOpen.set(false);
          this.select('fields');
        },
        error: () => this.saving.set(false),
      });
  }

  removeField(field: CustomFieldDto): void {
    this.confirm
      .ask({
        title: 'Eliminar campo personalizado',
        message: `Se eliminará «${field.name}» y los valores guardados en él.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.platform.deleteCustomField(field.id).subscribe({
          next: () => {
            this.fields.update((list) => list.filter((item) => item.id !== field.id));
            this.toast.success('Campo eliminado');
          },
        });
      });
  }

  /* --------------------------------- RGPD -------------------------------- */

  resolveRequest(request: DataRequestDto, status: 'approved' | 'rejected'): void {
    this.platform.resolvePrivacyRequest(request.id, status).subscribe({
      next: (updated) => {
        this.requests.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.toast.success(status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada');
      },
    });
  }

  taskStatusLabel(status: ScheduledTaskDto['status']): string {
    switch (status) {
      case ScheduledTaskStatus.Running:
        return 'En ejecución';
      case ScheduledTaskStatus.Failed:
        return 'Con errores';
      default:
        return 'En espera';
    }
  }

  requestTypeLabel(type: 'export' | 'delete'): string {
    return type === 'export' ? 'Exportación de datos' : 'Eliminación de datos';
  }

  requestStatusLabel(status: DataRequestDto['status']): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      default:
        return 'Completada';
    }
  }

  /* ----------------------------- Servicios web --------------------------- */

  openNewToken(): void {
    this.freshToken.set(null);
    this.tokenForm.reset({ name: '', scopes: 'read', expiresAt: '' });
    this.tokenFormOpen.set(true);
  }

  saveToken(): void {
    if (this.tokenForm.invalid) {
      this.tokenForm.markAllAsTouched();
      return;
    }
    const value = this.tokenForm.getRawValue();
    this.saving.set(true);
    this.platform
      .createToken({
        name: value.name.trim(),
        scopes: value.scopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean),
        expiresAt: value.expiresAt ? new Date(value.expiresAt).toISOString() : undefined,
      })
      .subscribe({
        next: (created) => {
          this.saving.set(false);
          this.tokenFormOpen.set(false);
          // El token en claro no vuelve a mostrarse: se deja a la vista.
          this.freshToken.set(created.token);
          this.select('services');
        },
        error: () => this.saving.set(false),
      });
  }

  revokeToken(token: WebServiceTokenDto): void {
    this.confirm
      .ask({
        title: 'Revocar token',
        message: `Se revocará «${token.name}». Las integraciones que lo usen dejarán de funcionar de inmediato.`,
        confirmLabel: 'Revocar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.platform.revokeToken(token.id).subscribe({
          next: () => {
            this.tokens.update((list) => list.filter((item) => item.id !== token.id));
            this.toast.success('Token revocado');
          },
        });
      });
  }

  openNewWebhook(): void {
    this.webhookForm.reset({
      name: '',
      url: '',
      events: 'course.completed',
      secret: '',
    });
    this.webhookFormOpen.set(true);
  }

  saveWebhook(): void {
    if (this.webhookForm.invalid) {
      this.webhookForm.markAllAsTouched();
      return;
    }
    const value = this.webhookForm.getRawValue();
    this.saving.set(true);
    this.platform
      .createWebhook({
        name: value.name.trim(),
        url: value.url.trim(),
        events: value.events
          .split(',')
          .map((event) => event.trim())
          .filter(Boolean),
        secret: value.secret.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Webhook creado');
          this.webhookFormOpen.set(false);
          this.select('services');
        },
        error: () => this.saving.set(false),
      });
  }

  removeWebhook(webhook: WebhookDto): void {
    this.confirm
      .ask({
        title: 'Eliminar webhook',
        message: `Se dejará de notificar a «${webhook.url}».`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.platform.deleteWebhook(webhook.id).subscribe({
          next: () => {
            this.webhooks.update((list) => list.filter((item) => item.id !== webhook.id));
            this.toast.success('Webhook eliminado');
          },
        });
      });
  }

  copyToken(): void {
    const token = this.freshToken();
    if (!token) return;
    void navigator.clipboard?.writeText(token).then(
      () => this.toast.success('Token copiado'),
      () => this.toast.warning('No se pudo copiar', 'Selecciónelo y cópielo a mano.'),
    );
  }
}

/** Descarga un blob con el nombre indicado. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
