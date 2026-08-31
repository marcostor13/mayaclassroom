import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardOverview, DashboardService } from '../../core/services/dashboard.service';
import {
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ProgressBarComponent,
  RelativeTimePipe,
} from '../../shared';

@Component({
  selector: 'maya-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    ProgressBarComponent,
    EmptyStateComponent,
    FormatDatePipe,
    RelativeTimePipe,
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  private readonly dashboard = inject(DashboardService);
  readonly auth = inject(AuthService);

  readonly data = signal<DashboardOverview | null>(null);
  readonly loading = signal(true);

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 6) return 'Buenas noches';
    if (hour < 13) return 'Buenos días';
    if (hour < 21) return 'Buenas tardes';
    return 'Buenas noches';
  });

  readonly pendingDeadlines = computed(() =>
    (this.data()?.deadlines ?? []).filter((deadline) => !deadline.submitted).slice(0, 5),
  );

  readonly inProgressCourses = computed(() =>
    (this.data()?.courses ?? []).filter((course) => (course.progress ?? 0) < 100),
  );

  constructor() {
    this.dashboard.overview().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  courseColor(index: number): string {
    const palette = ['#FF3B2E', '#FFB020', '#1E6FE0', '#12A150', '#A81609', '#A855C7'];
    return palette[index % palette.length];
  }
}
