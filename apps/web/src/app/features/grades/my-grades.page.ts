import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseGradeSummaryDto, UserGradeReport } from '@maya/shared';
import { GradesService } from '../../core/services/grades.service';
import { EmptyStateComponent, IconComponent, ProgressBarComponent } from '../../shared';

@Component({
  selector: 'maya-my-grades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ProgressBarComponent, EmptyStateComponent, IconComponent],
  templateUrl: './my-grades.page.html',
  styleUrl: './my-grades.page.scss',
})
export class MyGradesPage {
  private readonly route = inject(ActivatedRoute);
  private readonly grades = inject(GradesService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly report = signal<UserGradeReport | null>(null);
  /**
   * Situación académica: la nota en la escala del curso y qué falta para
   * aprobar. Va aparte del informe de calificaciones porque responde a otra
   * pregunta —«¿apruebo?» en lugar de «¿cuánto saqué en cada cosa?»— y es la
   * primera que se hace el alumno al entrar aquí.
   */
  readonly summary = signal<CourseGradeSummaryDto | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.grades.myReport(this.courseId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.grades.mySummary(this.courseId).subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => undefined,
    });
  }
}
