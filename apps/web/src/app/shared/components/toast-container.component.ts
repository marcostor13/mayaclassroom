import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

/** Región de avisos flotantes anunciada por lectores de pantalla. */
@Component({
  selector: 'maya-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="maya-toasts" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="maya-toast" [class]="'maya-toast--' + toast.kind">
          <maya-icon [name]="iconFor(toast.kind)" [size]="20" />
          <div class="maya-stack" style="gap: 2px; flex: 1;">
            <strong class="maya-small">{{ toast.title }}</strong>
            @if (toast.message) {
              <span class="maya-tiny maya-muted">{{ toast.message }}</span>
            }
          </div>
          <button
            type="button"
            class="maya-btn maya-btn--ghost maya-btn--icon maya-btn--sm"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Cerrar aviso"
          >
            <maya-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toasts = inject(ToastService);

  iconFor(kind: string): string {
    switch (kind) {
      case 'success':
        return 'check';
      case 'danger':
        return 'alert';
      case 'warning':
        return 'alert';
      default:
        return 'info';
    }
  }
}
