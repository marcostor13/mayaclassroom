import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryNode } from '@maya/shared';
import { CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, IconComponent } from '../../shared';

@Component({
  selector: 'maya-admin-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, EmptyStateComponent],
  template: `
    <header class="maya-page-header">
      <div>
        <h1 class="maya-page-header__title">Categorías de cursos</h1>
        <p class="maya-page-header__subtitle">Organice la oferta formativa en un árbol</p>
      </div>
      <div class="maya-page-header__actions">
        <button type="button" class="maya-btn maya-btn--primary" (click)="creating.set(!creating())">
          <maya-icon name="plus" [size]="16" /> Nueva categoría
        </button>
      </div>
    </header>

    @if (creating()) {
      <section class="maya-card" style="margin-bottom: var(--maya-space-5)">
        <div class="maya-card__body maya-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))">
          <div class="maya-field">
            <label class="maya-label" for="c-name">Nombre</label>
            <input id="c-name" class="maya-input" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </div>
          <div class="maya-field">
            <label class="maya-label" for="c-parent">Categoría padre</label>
            <select
              id="c-parent"
              class="maya-select"
              [ngModel]="parentId()"
              (ngModelChange)="parentId.set($event)"
            >
              <option value="">Raíz</option>
              @for (item of flat(); track item.node.id) {
                <option [value]="item.node.id">
                  {{ '— '.repeat(item.depth) }}{{ item.node.name }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="maya-card__footer" style="display: flex; gap: var(--maya-space-2); justify-content: flex-end">
          <button type="button" class="maya-btn maya-btn--ghost" (click)="creating.set(false)">
            Cancelar
          </button>
          <button type="button" class="maya-btn maya-btn--primary" (click)="create()">Crear</button>
        </div>
      </section>
    }

    @if (flat().length) {
      <section class="maya-card">
        @for (item of flat(); track item.node.id) {
          <div
            style="display: flex; align-items: center; gap: var(--maya-space-3); padding: var(--maya-space-3) var(--maya-space-5); border-bottom: 1px solid var(--maya-border)"
            [style.padding-left.px]="20 + item.depth * 26"
          >
            <maya-icon name="folder" [size]="18" />
            <div style="flex: 1; min-width: 0">
              <p class="maya-bold maya-small">{{ item.node.name }}</p>
              @if (item.node.description) {
                <p class="maya-tiny maya-subtle maya-truncate">{{ item.node.description }}</p>
              }
            </div>
            <span class="maya-badge">{{ item.node.courseCount }} cursos</span>
            @if (!item.node.visible) {
              <span class="maya-badge maya-badge--warning">Oculta</span>
            }
          </div>
        }
      </section>
    } @else {
      <maya-empty-state
        icon="grid"
        title="Sin categorías"
        description="Cree la primera categoría para organizar sus cursos."
      />
    }
  `,
})
export class AdminCategoriesPage {
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);

  readonly tree = signal<CategoryNode[]>([]);
  readonly creating = signal(false);
  readonly name = signal('');
  readonly parentId = signal('');

  constructor() {
    this.load();
  }

  private load(): void {
    this.courses.categoryTree().subscribe({ next: (tree) => this.tree.set(tree) });
  }

  flat(): { node: CategoryNode; depth: number }[] {
    const walk = (nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] =>
      nodes.flatMap((node) => [{ node, depth }, ...walk(node.children ?? [], depth + 1)]);
    return walk(this.tree());
  }

  create(): void {
    if (!this.name().trim()) return;
    this.courses
      .createCategory({ name: this.name(), parentId: this.parentId() || undefined })
      .subscribe({
        next: () => {
          this.toast.success('Categoría creada');
          this.name.set('');
          this.creating.set(false);
          this.load();
        },
      });
  }
}
