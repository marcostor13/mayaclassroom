import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AssignDto,
  AssignSubmissionDto,
  CourseModuleDto,
  SubmissionStatus,
} from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  FormatDatePipe,
  IconComponent,
  RelativeTimePipe,
  SafeHtmlPipe,
} from '../../shared';

@Component({
  selector: 'maya-assign',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    AvatarComponent,
    SafeHtmlPipe,
    FormatDatePipe,
    RelativeTimePipe,
  ],
  templateUrl: './assign.page.html',
  styleUrl: './activity.shared.scss',
})
export class AssignPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly assign = signal<AssignDto | null>(null);
  readonly submission = signal<AssignSubmissionDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly text = signal('');
  readonly acceptStatement = signal(false);

  /** Vista del profesorado: entregas por corregir. */
  readonly submissions = signal<AssignSubmissionDto[]>([]);
  readonly teacherView = signal(false);
  readonly summary = signal<{
    participants: number;
    submitted: number;
    graded: number;
    needsGrading: number;
  } | null>(null);

  readonly isSubmitted = computed(
    () =>
      this.submission()?.status === SubmissionStatus.Submitted ||
      this.submission()?.status === SubmissionStatus.Graded,
  );

  readonly overdue = computed(() => {
    const due = this.assign()?.dueDate;
    return Boolean(due && new Date(due) < new Date() && !this.isSubmitted());
  });

  constructor() {
    this.activities.assign(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.assign.set(data.assign);
        this.submission.set(data.submission);
        this.text.set(data.submission?.onlineText ?? '');
        this.loading.set(false);
        if (this.auth.isTeacherOf(String(data.module.courseId))) this.loadTeacherView();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadTeacherView(): void {
    this.teacherView.set(true);
    this.activities.assignSubmissions(this.moduleId).subscribe({
      next: (list) => this.submissions.set(list),
    });
    this.activities.assignSummary(this.moduleId).subscribe({
      next: (summary) => this.summary.set(summary),
    });
  }

  submit(draft = false): void {
    const assign = this.assign();
    if (!assign) return;
    if (assign.requireSubmissionStatement && !draft && !this.acceptStatement()) {
      this.toast.warning('Falta confirmar', 'Debe aceptar la declaración de autoría.');
      return;
    }
    this.saving.set(true);
    this.activities
      .submitAssign(this.moduleId, {
        onlineText: this.text(),
        draft,
        acceptStatement: this.acceptStatement(),
      })
      .subscribe({
        next: (submission) => {
          this.submission.set(submission);
          this.saving.set(false);
          this.toast.success(draft ? 'Borrador guardado' : 'Entrega realizada');
        },
        error: () => this.saving.set(false),
      });
  }

  grade(submission: AssignSubmissionDto, gradeValue: string, feedback: string): void {
    const grade = Number(gradeValue);
    if (!Number.isFinite(grade)) return;
    this.activities
      .gradeSubmission(this.moduleId, submission.id, { grade, feedbackText: feedback })
      .subscribe({
        next: (updated) => {
          this.submissions.update((list) =>
            list.map((item) => (item.id === updated.id ? updated : item)),
          );
          this.toast.success('Entrega calificada');
        },
      });
  }

  statusLabel(status: SubmissionStatus | undefined): string {
    switch (status) {
      case SubmissionStatus.Submitted:
        return 'Enviada';
      case SubmissionStatus.Graded:
        return 'Calificada';
      case SubmissionStatus.Draft:
        return 'Borrador';
      case SubmissionStatus.Reopened:
        return 'Reabierta';
      default:
        return 'Sin enviar';
    }
  }
}
