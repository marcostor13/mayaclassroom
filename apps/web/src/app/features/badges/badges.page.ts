import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  BadgeCriteriaType,
  BadgeDto,
  BadgeStatus,
  BadgeType,
  CAP,
  IssuedBadgeDto,
  UserDto,
} from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
} from '../../shared';

@Component({
  selector: 'maya-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    FormatDatePipe,
    ModalComponent,
  ],
  templateUrl: './badges.page.html',
  styles: [
    `
      .badge-medal {
        display: grid;
        place-items: center;
        width: 84px;
        height: 84px;
        border-radius: var(--maya-radius-pill);
        background: var(--maya-primary-softer);
        color: var(--maya-primary-deep);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }
      }
    `,
  ],
})
export class BadgesPage {
  private readonly admin = inject(AdminService);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly badges = signal<IssuedBadgeDto[]>([]);
  readonly catalogue = signal<BadgeDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly tab = signal<'mine' | 'manage'>('mine');

  readonly editing = signal<BadgeDto | null>(null);
  readonly formOpen = signal(false);

  /** Insignia que se está otorgando a mano. */
  readonly awarding = signal<BadgeDto | null>(null);
  readonly candidates = signal<UserDto[]>([]);
  readonly awardSearch = signal('');

  readonly canCreate = computed(() => this.auth.can(CAP.BADGE_CREATE));
  readonly canAward = computed(() => this.auth.can(CAP.BADGE_AWARD));

  readonly criteriaTypes = [
    { value: BadgeCriteriaType.Manual, label: 'Otorgada a mano' },
    { value: BadgeCriteriaType.CourseCompletion, label: 'Al completar un curso' },
    { value: BadgeCriteriaType.ActivityCompletion, label: 'Al completar actividades' },
    { value: BadgeCriteriaType.Grade, label: 'Al alcanzar una calificación' },
    { value: BadgeCriteriaType.Competency, label: 'Al lograr una competencia' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    imageUrl: [''],
    type: [BadgeType.Site as BadgeType],
    expiryDate: [''],
    criteriaType: [BadgeCriteriaType.Manual as BadgeCriteriaType],
    minGrade: [50],
  });

  constructor() {
    this.loadMine();
  }

  private loadMine(): void {
    this.loading.set(true);
    this.admin.myBadges().subscribe({
      next: (list) => {
        this.badges.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openManage(): void {
    this.tab.set('manage');
    this.admin.badges().subscribe({ next: (list) => this.catalogue.set(list) });
  }

  statusLabel(status: BadgeStatus): string {
    switch (status) {
      case BadgeStatus.Active:
        return 'Activa';
      case BadgeStatus.Draft:
        return 'Borrador';
      default:
        return 'Archivada';
    }
  }

  criteriaLabel(badge: BadgeDto): string {
    if (!badge.criteria.length) return 'Sin criterios';
    return badge.criteria
      .map(
        (criterion) =>
          this.criteriaTypes.find((item) => item.value === criterion.type)?.label ?? criterion.type,
      )
      .join(badge.criteriaAggregation === 'all' ? ' y ' : ' o ');
  }

  /**
   * La verificación es pública y devuelve JSON; se abre en una pestaña nueva
   * apuntando a la API, no al cliente.
   */
  verifyUrl(item: IssuedBadgeDto): string {
    return `${this.api.baseUrl}/badges/verify/${item.uniqueHash}`;
  }

  /* ------------------------------- Gestión ------------------------------- */

  openNew(): void {
    this.editing.set(null);
    this.form.reset({
      name: '',
      description: '',
      imageUrl: '',
      type: BadgeType.Site,
      expiryDate: '',
      criteriaType: BadgeCriteriaType.Manual,
      minGrade: 50,
    });
    this.formOpen.set(true);
  }

  openEdit(badge: BadgeDto): void {
    this.editing.set(badge);
    this.form.reset({
      name: badge.name,
      description: badge.description,
      imageUrl: badge.imageUrl ?? '',
      type: badge.type,
      expiryDate: badge.expiryDate ? badge.expiryDate.slice(0, 10) : '',
      criteriaType: badge.criteria[0]?.type ?? BadgeCriteriaType.Manual,
      minGrade: badge.criteria[0]?.minGrade ?? 50,
    });
    this.formOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      name: value.name.trim(),
      description: value.description.trim(),
      imageUrl: value.imageUrl.trim() || undefined,
      type: value.type,
      expiryDate: value.expiryDate ? new Date(value.expiryDate).toISOString() : undefined,
      criteria: [
        {
          type: value.criteriaType,
          ...(value.criteriaType === BadgeCriteriaType.Grade
            ? { minGrade: Number(value.minGrade) }
            : {}),
        },
      ],
      criteriaAggregation: 'all',
    };

    const current = this.editing();
    const request = current
      ? this.admin.updateBadge(current.id, payload)
      : this.admin.createBadge(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Insignia actualizada' : 'Insignia creada');
        this.formOpen.set(false);
        this.openManage();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleStatus(badge: BadgeDto): void {
    const next = badge.status === BadgeStatus.Active ? BadgeStatus.Draft : BadgeStatus.Active;
    this.admin.setBadgeStatus(badge.id, next).subscribe({
      next: (updated) => {
        this.catalogue.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.toast.success(
          next === BadgeStatus.Active ? 'Insignia activada' : 'Insignia pasada a borrador',
        );
      },
    });
  }

  remove(badge: BadgeDto): void {
    this.confirm
      .ask({
        title: 'Eliminar insignia',
        message: `Se eliminará «${badge.name}». Las ${badge.awardedCount} ya otorgadas dejan de poder verificarse.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.admin.deleteBadge(badge.id).subscribe({
          next: () => {
            this.catalogue.update((list) => list.filter((item) => item.id !== badge.id));
            this.toast.success('Insignia eliminada');
          },
        });
      });
  }

  /* ------------------------------ Otorgar -------------------------------- */

  openAward(badge: BadgeDto): void {
    this.awarding.set(badge);
    this.awardSearch.set('');
    this.searchCandidates();
  }

  searchCandidates(): void {
    this.admin
      .users({ limit: 20, search: this.awardSearch().trim() || undefined })
      .subscribe({ next: (result) => this.candidates.set(result.items) });
  }

  award(userId: string, fullName: string): void {
    const badge = this.awarding();
    if (!badge) return;
    this.admin.awardBadge(badge.id, userId).subscribe({
      next: () => {
        this.toast.success('Insignia otorgada', `${fullName} ya la tiene.`);
        this.openManage();
      },
    });
  }
}
