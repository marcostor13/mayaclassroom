import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../core/services/confirm.service';
import { ModalComponent } from './modal.component';

/**
 * Punto único donde se pinta el diálogo de confirmación. Va montado en el
 * armazón, de modo que cualquier pantalla puede pedir una confirmación con
 * `ConfirmService.ask()` sin declarar nada.
 */
@Component({
  selector: 'maya-confirm-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, FormsModule],
  template: `
    @if (confirm.pending(); as request) {
      <maya-modal [title]="request.title" (dismissed)="cancel()">
        <p class="maya-small" style="white-space: pre-line">{{ request.message }}</p>

        @if (request.requireText) {
          <div class="maya-field" style="margin-top: var(--maya-space-4)">
            <label class="maya-label" for="maya-confirm-text">
              Escriba <strong>{{ request.requireText }}</strong> para continuar
            </label>
            <input
              id="maya-confirm-text"
              class="maya-input"
              autocomplete="off"
              [ngModel]="typed()"
              (ngModelChange)="typed.set($event)"
            />
          </div>
        }

        <ng-container footer>
          <button type="button" class="maya-btn maya-btn--ghost" (click)="cancel()">
            {{ request.cancelLabel ?? 'Cancelar' }}
          </button>
          <button
            type="button"
            class="maya-btn"
            [class.maya-btn--danger]="request.danger !== false"
            [class.maya-btn--primary]="request.danger === false"
            [disabled]="!ready()"
            (click)="accept()"
          >
            {{ request.confirmLabel ?? 'Confirmar' }}
          </button>
        </ng-container>
      </maya-modal>
    }
  `,
})
export class ConfirmHostComponent {
  readonly confirm = inject(ConfirmService);
  readonly typed = signal('');

  readonly ready = computed(() => {
    const request = this.confirm.pending();
    if (!request?.requireText) return true;
    return this.typed().trim() === request.requireText;
  });

  accept(): void {
    if (!this.ready()) return;
    this.typed.set('');
    this.confirm.resolve(true);
  }

  cancel(): void {
    this.typed.set('');
    this.confirm.resolve(false);
  }
}
