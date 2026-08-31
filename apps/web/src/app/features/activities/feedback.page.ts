import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseModuleDto, FeedbackDto } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, SafeHtmlPipe } from '../../shared';

@Component({
  selector: 'maya-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, SafeHtmlPipe],
  templateUrl: './feedback.page.html',
  styleUrl: './activity.shared.scss',
})
export class FeedbackPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly survey = signal<FeedbackDto | null>(null);
  readonly responded = signal(false);
  readonly answers = signal<Record<string, unknown>>({});
  readonly loading = signal(true);

  constructor() {
    this.activities.feedback(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.survey.set(data.feedback);
        this.responded.set(data.responded);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setAnswer(itemId: string, value: unknown): void {
    this.answers.update((map) => ({ ...map, [itemId]: value }));
  }

  submit(): void {
    this.activities.submitFeedback(this.moduleId, this.answers()).subscribe({
      next: () => {
        this.responded.set(true);
        this.toast.success('Gracias por su participación');
      },
    });
  }
}
