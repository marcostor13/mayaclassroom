import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CAP,
  CompetencyDto,
  CompetencyFrameworkDto,
  CompetencyProficiency,
  LearningPlanDto,
  UserCompetencyDto,
} from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import {
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
  ProgressBarComponent,
} from '../../shared';

@Component({
  selector: 'maya-competencies',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    EmptyStateComponent,
    ProgressBarComponent,
    FormatDatePipe,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './competencies.page.html',
})
export class CompetenciesPage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly plans = signal<LearningPlanDto[]>([]);
  readonly competencies = signal<UserCompetencyDto[]>([]);
  readonly tab = signal<'mine' | 'frameworks'>('mine');
  readonly saving = signal(false);

  /* -------------------------- Marcos de competencias --------------------- */

  readonly frameworks = signal<CompetencyFrameworkDto[]>([]);
  /** Marco abierto y su árbol de competencias. */
  readonly openFramework = signal<CompetencyFrameworkDto | null>(null);
  readonly tree = signal<CompetencyDto[]>([]);
  readonly frameworkFormOpen = signal(false);
  readonly competencyFormOpen = signal(false);

  readonly canManage = computed(() => this.auth.can(CAP.COMPETENCY_MANAGE));

  readonly frameworkForm = this.fb.nonNullable.group({
    shortName: ['', [Validators.required]],
    name: ['', [Validators.required]],
    description: [''],
    idNumber: [''],
  });

  readonly competencyForm = this.fb.nonNullable.group({
    shortName: ['', [Validators.required]],
    description: [''],
    parentId: [''],
  });

  /** Árbol aplanado, para pintarlo con sangría y ofrecerlo como padre. */
  readonly flatTree = computed(() => flatten(this.tree()));

  constructor() {
    this.api.get<LearningPlanDto[]>('/competencies/plans/me').subscribe({
      next: (plans) => this.plans.set(plans),
    });
    this.api.get<UserCompetencyDto[]>('/competencies/me').subscribe({
      next: (list) => this.competencies.set(list),
    });
  }

  openFrameworks(): void {
    this.tab.set('frameworks');
    this.loadFrameworks();
  }

  private loadFrameworks(): void {
    this.api.get<CompetencyFrameworkDto[]>('/competencies/frameworks').subscribe({
      next: (list) => this.frameworks.set(list),
    });
  }

  selectFramework(framework: CompetencyFrameworkDto): void {
    this.openFramework.set(framework);
    this.api.get<CompetencyDto[]>(`/competencies/frameworks/${framework.id}/tree`).subscribe({
      next: (tree) => this.tree.set(tree),
    });
  }

  /* ----------------------------- Marcos ---------------------------------- */

  openNewFramework(): void {
    this.frameworkForm.reset({ shortName: '', name: '', description: '', idNumber: '' });
    this.frameworkFormOpen.set(true);
  }

  saveFramework(): void {
    if (this.frameworkForm.invalid) {
      this.frameworkForm.markAllAsTouched();
      return;
    }
    const value = this.frameworkForm.getRawValue();
    this.saving.set(true);
    this.api
      .post<CompetencyFrameworkDto>('/competencies/frameworks', {
        shortName: value.shortName.trim(),
        name: value.name.trim(),
        description: value.description.trim() || undefined,
        idNumber: value.idNumber.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Marco creado');
          this.frameworkFormOpen.set(false);
          this.loadFrameworks();
        },
        error: () => this.saving.set(false),
      });
  }

  removeFramework(framework: CompetencyFrameworkDto): void {
    this.confirm
      .ask({
        title: 'Eliminar marco de competencias',
        message: `Se eliminará «${framework.name}» con sus ${framework.competencyCount} competencias y las evaluaciones asociadas.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.delete(`/competencies/frameworks/${framework.id}`).subscribe({
          next: () => {
            this.toast.success('Marco eliminado');
            if (this.openFramework()?.id === framework.id) {
              this.openFramework.set(null);
              this.tree.set([]);
            }
            this.loadFrameworks();
          },
        });
      });
  }

  /* -------------------------- Competencias ------------------------------- */

  openNewCompetency(): void {
    this.competencyForm.reset({ shortName: '', description: '', parentId: '' });
    this.competencyFormOpen.set(true);
  }

  saveCompetency(): void {
    const framework = this.openFramework();
    if (!framework || this.competencyForm.invalid) {
      this.competencyForm.markAllAsTouched();
      return;
    }
    const value = this.competencyForm.getRawValue();
    this.saving.set(true);
    this.api
      .post<CompetencyDto>('/competencies', {
        frameworkId: framework.id,
        parentId: value.parentId || undefined,
        shortName: value.shortName.trim(),
        description: value.description.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Competencia añadida');
          this.competencyFormOpen.set(false);
          this.selectFramework(framework);
          this.loadFrameworks();
        },
        error: () => this.saving.set(false),
      });
  }

  removeCompetency(competency: CompetencyDto): void {
    const framework = this.openFramework();
    this.confirm
      .ask({
        title: 'Eliminar competencia',
        message: `Se eliminará «${competency.shortName}» y las competencias que dependan de ella.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.delete(`/competencies/${competency.id}`).subscribe({
          next: () => {
            this.toast.success('Competencia eliminada');
            if (framework) this.selectFramework(framework);
            this.loadFrameworks();
          },
        });
      });
  }

  label(proficiency: CompetencyProficiency): string {
    switch (proficiency) {
      case CompetencyProficiency.Proficient:
        return 'Competente';
      case CompetencyProficiency.InProgress:
        return 'En progreso';
      default:
        return 'Sin evaluar';
    }
  }

  badgeClass(item: UserCompetencyDto): string {
    if (item.proficiency === CompetencyProficiency.Proficient) return 'maya-badge--success';
    if (item.proficiency === CompetencyProficiency.InProgress) return 'maya-badge--warning';
    return '';
  }
}

/** Aplana el árbol conservando la profundidad, para pintarlo con sangría. */
function flatten(nodes: CompetencyDto[]): { node: CompetencyDto; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth: node.depth },
    ...flatten(node.children ?? []),
  ]);
}
