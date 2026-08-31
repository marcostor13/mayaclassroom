import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnalyticsCourseOverview, CourseSummary } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { CoursesService } from '../../core/services/courses.service';
import { EmptyStateComponent, IconComponent, ProgressBarComponent } from '../../shared';

@Component({
  selector: 'maya-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, ProgressBarComponent, EmptyStateComponent],
  templateUrl: './analytics.page.html',
  styleUrl: './analytics.page.scss',
})
export class AnalyticsPage {
  private readonly admin = inject(AdminService);
  private readonly courses = inject(CoursesService);

  readonly myCourses = signal<CourseSummary[]>([]);
  readonly selectedCourse = signal('');
  readonly overview = signal<AnalyticsCourseOverview | null>(null);
  readonly loading = signal(false);

  /** Altura relativa de cada barra de la gráfica de actividad. */
  readonly chart = computed(() => {
    const days = this.overview()?.activityByDay ?? [];
    const max = Math.max(1, ...days.map((d) => d.views + d.posts + d.submissions));
    return days.map((day) => ({
      ...day,
      height: Math.round(((day.views + day.posts + day.submissions) / max) * 100),
    }));
  });

  constructor() {
    this.courses.myCourses({ limit: 50 }).subscribe({
      next: (result) => {
        this.myCourses.set(result.items);
        if (result.items.length) {
          this.selectedCourse.set(result.items[0].id);
          this.load();
        }
      },
    });
  }

  load(): void {
    if (!this.selectedCourse()) return;
    this.loading.set(true);
    this.admin.courseAnalytics(this.selectedCourse()).subscribe({
      next: (data) => {
        this.overview.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
