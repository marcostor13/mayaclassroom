import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChoiceDto, CourseModuleDto } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, SafeHtmlPipe } from '../../shared';

@Component({
  selector: 'maya-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SafeHtmlPipe],
  templateUrl: './choice.page.html',
  styleUrl: './activity.shared.scss',
})
export class ChoicePage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly choice = signal<ChoiceDto | null>(null);
  readonly selected = signal<string[]>([]);
  readonly loading = signal(true);

  constructor() {
    this.activities.choice(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.choice.set(data.choice);
        this.selected.set(data.myAnswer);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(optionId: string): void {
    const multiple = this.choice()?.allowMultiple ?? false;
    this.selected.update((current) => {
      if (!multiple) return [optionId];
      return current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    });
  }

  save(): void {
    if (!this.selected().length) return;
    this.activities.answerChoice(this.moduleId, this.selected()).subscribe({
      next: (updated) => {
        this.choice.set(updated);
        this.toast.success('Respuesta registrada');
      },
    });
  }

  percentage(count: number | undefined): number {
    const total = (this.choice()?.options ?? []).reduce((sum, o) => sum + (o.count ?? 0), 0);
    if (!total || !count) return 0;
    return Math.round((count / total) * 100);
  }
}
