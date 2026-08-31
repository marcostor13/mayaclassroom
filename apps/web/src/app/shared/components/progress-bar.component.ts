import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Barra de progreso accesible. */
@Component({
  selector: 'maya-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="maya-progress"
      [class.maya-progress--thin]="size() === 'thin'"
      [class.maya-progress--thick]="size() === 'thick'"
      [class.maya-progress--success]="complete()"
      role="progressbar"
      [attr.aria-valuenow]="clamped()"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label()"
    >
      <div class="maya-progress__bar" [style.width.%]="clamped()"></div>
    </div>
  `,
})
export class ProgressBarComponent {
  readonly value = input<number>(0);
  readonly size = input<'thin' | 'default' | 'thick'>('default');
  readonly label = input<string>('Progreso');

  readonly clamped = computed(() => Math.min(100, Math.max(0, Math.round(this.value()))));
  readonly complete = computed(() => this.clamped() >= 100);
}
