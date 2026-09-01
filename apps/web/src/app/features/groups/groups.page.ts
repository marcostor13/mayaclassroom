import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CAP, EnrolmentDto, GroupDto, GroupingDto } from '@maya/shared';
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

/** Grupos y agrupamientos de un curso, como en Moodle. */
@Component({
  selector: 'maya-groups',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    ModalComponent,
  ],
  templateUrl: './groups.page.html',
})
export class GroupsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly courseId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly groups = signal<GroupDto[]>([]);
  readonly groupings = signal<GroupingDto[]>([]);
  readonly participants = signal<EnrolmentDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly tab = signal<'groups' | 'groupings'>('groups');

  /** Grupo cuyos integrantes se están gestionando. */
  readonly managing = signal<GroupDto | null>(null);
  readonly editing = signal<GroupDto | null>(null);
  readonly groupFormOpen = signal(false);
  readonly autoOpen = signal(false);
  readonly groupingEditing = signal<GroupingDto | null>(null);
  readonly groupingFormOpen = signal(false);
  readonly memberSearch = signal('');

  readonly canManage = computed(() => this.auth.can(CAP.GROUP_MANAGE));

  readonly groupForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    enrolmentKey: [''],
  });

  readonly autoForm = this.fb.nonNullable.group({
    mode: ['numberOfGroups' as 'numberOfGroups' | 'membersPerGroup'],
    value: [2, [Validators.required, Validators.min(1)]],
    namingScheme: ['Grupo @'],
    allocation: ['random' as 'random' | 'alphabetical'],
  });

  readonly groupingForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    groupIds: [[] as string[]],
  });

  /** Personas matriculadas que aún no están en el grupo que se gestiona. */
  readonly candidates = computed(() => {
    const group = this.managing();
    if (!group) return [];
    const inGroup = new Set((group.members ?? []).map((member) => member.id));
    const term = this.memberSearch().trim().toLowerCase();
    return this.participants()
      .filter((item) => item.user && !inGroup.has(item.user.id))
      .filter((item) => !term || (item.user?.fullName ?? '').toLowerCase().includes(term));
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.courses.groups(this.courseId).subscribe({
      next: (groups) => {
        this.groups.set(groups);
        this.loading.set(false);
        // Mantener abierto el panel de integrantes tras cada cambio.
        const open = this.managing();
        if (open) {
          this.managing.set(groups.find((group) => group.id === open.id) ?? null);
        }
      },
      error: () => this.loading.set(false),
    });
    this.courses.groupings(this.courseId).subscribe({
      next: (groupings) => this.groupings.set(groupings),
    });
    this.courses.participants(this.courseId, { limit: 500 }).subscribe({
      next: (result) => this.participants.set(result.items),
    });
  }

  groupingName(id: string): string {
    return this.groupings().find((item) => item.id === id)?.name ?? '';
  }

  /* -------------------------------- Grupos ------------------------------- */

  openNewGroup(): void {
    this.editing.set(null);
    this.groupForm.reset({ name: '', description: '', enrolmentKey: '' });
    this.groupFormOpen.set(true);
  }

  openEditGroup(group: GroupDto): void {
    this.editing.set(group);
    this.groupForm.reset({
      name: group.name,
      description: group.description ?? '',
      enrolmentKey: group.enrolmentKey ?? '',
    });
    this.groupFormOpen.set(true);
  }

  saveGroup(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }
    const value = this.groupForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      enrolmentKey: value.enrolmentKey.trim() || undefined,
    };
    const current = this.editing();
    const request = current
      ? this.courses.updateGroup(this.courseId, current.id, payload)
      : this.courses.createGroup(this.courseId, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Grupo actualizado' : 'Grupo creado');
        this.groupFormOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  removeGroup(group: GroupDto): void {
    this.confirm
      .ask({
        title: 'Eliminar grupo',
        message: `Se eliminará «${group.name}». Sus ${group.memberCount} integrantes siguen matriculados en el curso.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courses.removeGroup(this.courseId, group.id).subscribe({
          next: () => {
            this.toast.success('Grupo eliminado');
            if (this.managing()?.id === group.id) this.managing.set(null);
            this.load();
          },
        });
      });
  }

  autoCreate(): void {
    if (this.autoForm.invalid) {
      this.autoForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.courses.autoCreateGroups(this.courseId, this.autoForm.getRawValue()).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.toast.success(`${created.length} grupos creados`);
        this.autoOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  /* ----------------------------- Integrantes ----------------------------- */

  manage(group: GroupDto): void {
    this.memberSearch.set('');
    this.managing.set(group);
  }

  addMember(userId: string): void {
    const group = this.managing();
    if (!group) return;
    this.courses.addGroupMembers(this.courseId, group.id, [userId]).subscribe({
      next: () => this.load(),
    });
  }

  removeMember(userId: string): void {
    const group = this.managing();
    if (!group) return;
    this.courses.removeGroupMembers(this.courseId, group.id, [userId]).subscribe({
      next: () => this.load(),
    });
  }

  /* ---------------------------- Agrupamientos ---------------------------- */

  openNewGrouping(): void {
    this.groupingEditing.set(null);
    this.groupingForm.reset({ name: '', description: '', groupIds: [] });
    this.groupingFormOpen.set(true);
  }

  openEditGrouping(grouping: GroupingDto): void {
    this.groupingEditing.set(grouping);
    this.groupingForm.reset({
      name: grouping.name,
      description: grouping.description ?? '',
      groupIds: [...grouping.groupIds],
    });
    this.groupingFormOpen.set(true);
  }

  toggleGroupInGrouping(groupId: string, checked: boolean): void {
    const current = this.groupingForm.controls.groupIds.value;
    this.groupingForm.controls.groupIds.setValue(
      checked ? [...current, groupId] : current.filter((id) => id !== groupId),
    );
  }

  isInGrouping(groupId: string): boolean {
    return this.groupingForm.controls.groupIds.value.includes(groupId);
  }

  saveGrouping(): void {
    if (this.groupingForm.invalid) {
      this.groupingForm.markAllAsTouched();
      return;
    }
    const value = this.groupingForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      groupIds: value.groupIds,
    };
    const current = this.groupingEditing();
    const request = current
      ? this.courses.updateGrouping(this.courseId, current.id, payload)
      : this.courses.createGrouping(this.courseId, payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Agrupamiento actualizado' : 'Agrupamiento creado');
        this.groupingFormOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  removeGrouping(grouping: GroupingDto): void {
    this.confirm
      .ask({
        title: 'Eliminar agrupamiento',
        message: `Se eliminará «${grouping.name}». Los grupos que contiene se conservan.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.courses.removeGrouping(this.courseId, grouping.id).subscribe({
          next: () => {
            this.toast.success('Agrupamiento eliminado');
            this.load();
          },
        });
      });
  }
}
