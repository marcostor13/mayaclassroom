import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CAP,
  EnrolmentDto,
  EnrolmentMethod,
  EnrolmentMethodDto,
  GroupDto,
} from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { CoursesService } from '../../core/services/courses.service';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../core/services/confirm.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
} from '../../shared';

@Component({
  selector: 'maya-participants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    FormatDatePipe,
    ModalComponent,
  ],
  templateUrl: './participants.page.html',
})
export class ParticipantsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly courses = inject(CoursesService);
  private readonly admin = inject(AdminService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly items = signal<EnrolmentDto[]>([]);
  readonly groups = signal<GroupDto[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly enrolling = signal(false);
  readonly candidates = signal<{ id: string; fullName: string; email: string }[]>([]);
  readonly selectedUsers = signal<string[]>([]);
  readonly selectedRole = signal('student');

  readonly canEnrol = computed(() => this.auth.can(CAP.ENROL_ENROL_USERS));
  readonly canConfigureEnrolment = computed(() => this.auth.can(CAP.ENROL_CONFIG));

  /* ------------------------- Métodos de matrícula ------------------------ */

  readonly methods = signal<EnrolmentMethodDto[]>([]);
  readonly methodsOpen = signal(false);
  readonly savingMethod = signal(false);

  /** Métodos que aún no están configurados en el curso. */
  readonly availableMethods = computed(() => {
    const used = new Set(this.methods().map((method) => method.method));
    return [
      { value: EnrolmentMethod.Self, label: 'Automatriculación' },
      { value: EnrolmentMethod.Guest, label: 'Acceso de invitado' },
      { value: EnrolmentMethod.Manual, label: 'Matriculación manual' },
    ].filter((option) => !used.has(option.value));
  });

  methodLabel(method: EnrolmentMethod): string {
    switch (method) {
      case EnrolmentMethod.Self:
        return 'Automatriculación';
      case EnrolmentMethod.Guest:
        return 'Acceso de invitado';
      case EnrolmentMethod.Manual:
        return 'Matriculación manual';
      case EnrolmentMethod.Cohort:
        return 'Sincronización con cohorte';
      default:
        return 'Invitación';
    }
  }

  openMethods(): void {
    this.methodsOpen.set(true);
    this.loadMethods();
  }

  private loadMethods(): void {
    this.courses.enrolmentMethods(this.courseId).subscribe({
      next: (methods) => this.methods.set(methods),
    });
  }

  addMethod(method: EnrolmentMethod): void {
    if (!method) return;
    this.savingMethod.set(true);
    this.courses.createEnrolmentMethod(this.courseId, { method }).subscribe({
      next: () => {
        this.savingMethod.set(false);
        this.toast.success('Método añadido');
        this.loadMethods();
      },
      error: () => this.savingMethod.set(false),
    });
  }

  patchMethod(method: EnrolmentMethodDto, payload: Record<string, unknown>): void {
    this.courses.updateEnrolmentMethod(this.courseId, method.id, payload).subscribe({
      next: (updated) => {
        this.methods.update((list) =>
          list.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.toast.success('Método actualizado');
      },
    });
  }

  removeMethod(method: EnrolmentMethodDto): void {
    this.confirm
      .ask({
        title: 'Quitar método de matriculación',
        message: `Se retirará «${this.methodLabel(method.method)}» del curso. Quien ya esté matriculado sigue estándolo.`,
        confirmLabel: 'Quitar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courses.removeEnrolmentMethod(this.courseId, method.id).subscribe({
          next: () => {
            this.methods.update((list) => list.filter((item) => item.id !== method.id));
            this.toast.success('Método retirado');
          },
        });
      });
  }

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (item) =>
        item.user?.fullName.toLowerCase().includes(term) ||
        item.user?.email.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
    this.courses.groups(this.courseId).subscribe({ next: (groups) => this.groups.set(groups) });
  }

  private load(): void {
    this.loading.set(true);
    this.courses.participants(this.courseId, { limit: 100 }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openEnrol(): void {
    this.enrolling.set(true);
    this.admin.users({ limit: 100 }).subscribe({
      next: (result) =>
        this.candidates.set(
          result.items.map((user) => ({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
          })),
        ),
    });
  }

  toggleUser(id: string): void {
    this.selectedUsers.update((list) =>
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
    );
  }

  enrol(): void {
    if (!this.selectedUsers().length) return;
    this.courses.enrol(this.courseId, this.selectedUsers(), this.selectedRole()).subscribe({
      next: (result) => {
        this.toast.success(`${result.enrolled} participantes matriculados`);
        this.enrolling.set(false);
        this.selectedUsers.set([]);
        this.load();
      },
    });
  }

  unenrol(item: EnrolmentDto): void {
    this.confirm
      .ask({
        title: 'Dar de baja del curso',
        message: `${item.user?.fullName ?? 'La persona seleccionada'} dejará de tener acceso al curso. Sus calificaciones y entregas se conservan por si vuelve a matricularse.`,
        confirmLabel: 'Dar de baja',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courses.unenrol(this.courseId, item.userId).subscribe({
          next: () => {
            this.items.update((list) => list.filter((row) => row.id !== item.id));
            this.toast.success('Participante dado de baja');
          },
        });
      });
  }
}
