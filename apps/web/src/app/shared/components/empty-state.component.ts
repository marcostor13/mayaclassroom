import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Estado vacío reutilizable con icono, título, texto y acción opcional. */
@Component({
  selector: 'maya-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="maya-empty">
      <div class="maya-empty__icon">
        <maya-icon [name]="icon()" [size]="34" />
      </div>
      <p class="maya-empty__title">{{ title() }}</p>
      @if (description()) {
        <p class="maya-small">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
