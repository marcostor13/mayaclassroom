import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserGradeReport } from '@maya/shared';
import { GradesService } from '../../core/services/grades.service';
import { EmptyStateComponent, ProgressBarComponent } from '../../shared';

@Component({
  selector: 'maya-my-grades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProgressBarComponent, EmptyStateComponent],
  templateUrl: './my-grades.page.html',
})
export class MyGradesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly grades = inject(GradesService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly report = signal<UserGradeReport | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.grades.myReport(this.courseId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
