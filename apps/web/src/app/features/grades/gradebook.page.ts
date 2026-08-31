import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GradeItemType, GraderReport } from '@maya/shared';
import { GradesService } from '../../core/services/grades.service';
import { AvatarComponent, EmptyStateComponent, IconComponent } from '../../shared';

@Component({
  selector: 'maya-gradebook',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, AvatarComponent, EmptyStateComponent],
  templateUrl: './gradebook.page.html',
})
export class GradebookPage {
  private readonly route = inject(ActivatedRoute);
  private readonly grades = inject(GradesService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly report = signal<GraderReport | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.load();
  }

  private load(): void {
    this.grades.graderReport(this.courseId).subscribe({
      next: (report) => {
        this.report.set({
          ...report,
          items: report.items.filter((item) => item.itemType !== GradeItemType.Course),
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(itemId: string, userId: string, value: string): void {
    const grade = value === '' ? null : Number(value);
    if (grade !== null && !Number.isFinite(grade)) return;
    this.grades.setGrade(this.courseId, itemId, userId, grade).subscribe(() => this.load());
  }

  exportCsv(): void {
    this.grades.exportCsv(this.courseId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'calificaciones.csv';
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}
