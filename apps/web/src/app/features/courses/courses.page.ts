import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CAP, CourseSummary } from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
import { CoursesService } from '../../core/services/courses.service';
import {
  EmptyStateComponent,
  IconComponent,
  ProgressBarComponent,
} from '../../shared';

type Filter = 'all' | 'inprogress' | 'future' | 'past' | 'favourites';

@Component({
  selector: 'maya-courses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, IconComponent, ProgressBarComponent, EmptyStateComponent],
  templateUrl: './courses.page.html',
  styleUrl: './courses.page.scss',
})
export class CoursesPage {
  private readonly courses = inject(CoursesService);
  readonly auth = inject(AuthService);

  readonly items = signal<CourseSummary[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly filter = signal<Filter>('all');
  readonly view = signal<'cards' | 'list'>('cards');

  readonly canCreate = computed(() => this.auth.can(CAP.COURSE_CREATE));

  readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'inprogress', label: 'En curso' },
    { value: 'future', label: 'Próximos' },
    { value: 'past', label: 'Finalizados' },
    { value: 'favourites', label: 'Favoritos' },
  ];

  readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter(
      (course) =>
        course.fullName.toLowerCase().includes(term) ||
        course.shortName.toLowerCase().includes(term),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.courses
      .myCourses({ limit: 60, classification: this.filter() === 'all' ? undefined : this.filter() })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  setFilter(value: Filter): void {
    this.filter.set(value);
    this.load();
  }

  toggleFavourite(course: CourseSummary, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.courses.toggleFavourite(course.id).subscribe((result) => {
      this.items.update((list) =>
        list.map((item) =>
          item.id === course.id ? { ...item, favourite: result.favourite } : item,
        ),
      );
    });
  }

  courseColor(index: number): string {
    const palette = ['#FF3B2E', '#FFB020', '#1E6FE0', '#12A150', '#A81609', '#A855C7'];
    return palette[index % palette.length];
  }
}
