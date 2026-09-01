import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CAP, CohortDto, CourseSummary, UserDto } from '@maya/shared';
import { AdminService, CohortMember } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  IconComponent,
  ModalComponent,
} from '../../shared';

/** Cohortes de la empresa: alta, integrantes y matriculación masiva. */
@Component({
  selector: 'maya-admin-cohorts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './cohorts.page.html',
})
export class AdminCohortsPage {
  private readonly admin = inject(AdminService);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly cohorts = signal<CohortDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly editing = signal<CohortDto | null>(null);
  readonly formOpen = signal(false);

  /** Cohorte cuyos integrantes se gestionan. */
  readonly managing = signal<CohortDto | null>(null);
  readonly members = signal<CohortMember[]>([]);
  readonly candidates = signal<UserDto[]>([]);
  readonly memberSearch = signal('');

  /** Cohorte que se va a matricular en un curso. */
  readonly syncing = signal<CohortDto | null>(null);
  readonly myCourses = signal<CourseSummary[]>([]);
  readonly syncCourseId = signal('');
  readonly syncRole = signal('student');

  readonly canManage = computed(() => this.auth.can(CAP.COHORT_MANAGE));
  readonly canAssign = computed(() => this.auth.can(CAP.COHORT_ASSIGN));
  readonly canEnrol = computed(() => this.auth.can(CAP.ENROL_ENROL_USERS));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    idNumber: [''],
    description: [''],
    visible: [true],
  });

  /** Personas de la empresa que aún no pertenecen a la cohorte abierta. */
  readonly availableUsers = computed(() => {
    const inCohort = new Set(this.members().map((member) => member.id));
    return this.candidates().filter((user) => !inCohort.has(user.id));
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.admin.cohorts({ limit: 100 }).subscribe({
      next: (result) => {
        this.cohorts.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /* ------------------------------ Alta y edición ------------------------- */

  openNew(): void {
    this.editing.set(null);
    this.form.reset({ name: '', idNumber: '', description: '', visible: true });
    this.formOpen.set(true);
  }

  openEdit(cohort: CohortDto): void {
    this.editing.set(cohort);
    this.form.reset({
      name: cohort.name,
      idNumber: cohort.idNumber ?? '',
      description: cohort.description ?? '',
      visible: cohort.visible,
    });
    this.formOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      idNumber: value.idNumber.trim() || undefined,
      description: value.description.trim() || undefined,
      visible: value.visible,
    };
    const current = this.editing();
    const request = current
      ? this.admin.updateCohort(current.id, payload)
      : this.admin.createCohort(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Cohorte actualizada' : 'Cohorte creada');
        this.formOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(cohort: CohortDto): void {
    this.confirm
      .ask({
        title: 'Eliminar cohorte',
        message: `Se eliminará «${cohort.name}». Sus ${cohort.memberCount} integrantes conservan las matrículas que ya tuvieran.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.admin.deleteCohort(cohort.id).subscribe({
          next: () => {
            this.cohorts.update((list) => list.filter((item) => item.id !== cohort.id));
            this.toast.success('Cohorte eliminada');
          },
        });
      });
  }

  /* ----------------------------- Integrantes ----------------------------- */

  manage(cohort: CohortDto): void {
    this.managing.set(cohort);
    this.memberSearch.set('');
    this.loadMembers(cohort.id);
    this.searchUsers();
  }

  private loadMembers(id: string): void {
    this.admin.cohortMembers(id).subscribe({ next: (list) => this.members.set(list) });
  }

  searchUsers(): void {
    this.admin
      .users({ limit: 30, search: this.memberSearch().trim() || undefined })
      .subscribe({ next: (result) => this.candidates.set(result.items) });
  }

  addMember(userId: string): void {
    const cohort = this.managing();
    if (!cohort) return;
    this.admin.addCohortMembers(cohort.id, [userId]).subscribe({
      next: (updated) => {
        this.managing.set(updated);
        this.syncCohortInList(updated);
        this.loadMembers(cohort.id);
      },
    });
  }

  removeMember(userId: string): void {
    const cohort = this.managing();
    if (!cohort) return;
    this.admin.removeCohortMembers(cohort.id, [userId]).subscribe({
      next: (updated) => {
        this.managing.set(updated);
        this.syncCohortInList(updated);
        this.members.update((list) => list.filter((member) => member.id !== userId));
      },
    });
  }

  private syncCohortInList(updated: CohortDto): void {
    this.cohorts.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  /* --------------------------- Matriculación ----------------------------- */

  openSync(cohort: CohortDto): void {
    this.syncing.set(cohort);
    this.syncCourseId.set('');
    if (!this.myCourses().length) {
      this.courses.list({ limit: 200 }).subscribe({
        next: (result) => this.myCourses.set(result.items),
      });
    }
  }

  runSync(): void {
    const cohort = this.syncing();
    const courseId = this.syncCourseId();
    if (!cohort || !courseId) {
      this.toast.warning('Falta el curso', 'Elija en qué curso matricular la cohorte.');
      return;
    }
    this.saving.set(true);
    this.admin.syncCohortToCourse(cohort.id, courseId, this.syncRole()).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(`${result.enrolled} personas matriculadas`);
        this.syncing.set(null);
      },
      error: () => this.saving.set(false),
    });
  }

  fullName(member: CohortMember): string {
    return `${member.firstName} ${member.lastName}`.trim();
  }
}
