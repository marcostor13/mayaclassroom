import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryNode, CourseSummary } from '@maya/shared';
import { CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent, SafeHtmlPipe } from '../../shared';

@Component({
  selector: 'maya-catalogue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, EmptyStateComponent, SafeHtmlPipe],
  templateUrl: './catalogue.page.html',
})
export class CataloguePage {
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);

  readonly categories = signal<CategoryNode[]>([]);
  readonly items = signal<CourseSummary[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');
  readonly categoryId = signal<string>('');

  constructor() {
    this.courses.categoryTree().subscribe({ next: (tree) => this.categories.set(tree) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.courses
      .list({
        limit: 60,
        search: this.search() || undefined,
        categoryId: this.categoryId() || undefined,
        includeSubcategories: true,
      })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  selfEnrol(course: CourseSummary, event: Event): void {
    event.preventDefault();
    this.courses.selfEnrol(course.id).subscribe({
      next: () => this.toast.success('Matriculación completada', `Ya puede acceder a ${course.fullName}.`),
    });
  }

  flatten(nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] {
    const result: { node: CategoryNode; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ node, depth });
      if (node.children?.length) result.push(...this.flatten(node.children, depth + 1));
    }
    return result;
  }
}
