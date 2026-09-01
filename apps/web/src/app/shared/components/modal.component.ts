import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Diálogo modal reutilizable. En móvil se comporta como hoja deslizante y a
 * partir de `md` como diálogo centrado, siguiendo el sistema de diseño.
 *
 * El contenido va en dos ranuras: el cuerpo por defecto y el pie con los
 * botones, marcado con `[footer]`.
 */
@Component({
  selector: 'maya-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="maya-backdrop" (click)="dismissed.emit()" aria-hidden="true"></div>
    <div
      class="maya-modal"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      (keydown.escape)="dismissed.emit()"
    >
      <div class="maya-modal__panel" #panel tabindex="-1">
        <div class="maya-modal__handle" aria-hidden="true"></div>
        <header class="maya-modal__header">
          <h2 style="font-size: var(--maya-text-lg); font-weight: 700">{{ title() }}</h2>
          <button
            type="button"
            class="maya-btn maya-btn--ghost maya-btn--icon"
            aria-label="Cerrar"
            (click)="dismissed.emit()"
          >
            <maya-icon name="x" [size]="18" />
          </button>
        </header>
        <div class="maya-modal__body">
          <ng-content />
        </div>
        <footer class="maya-modal__footer">
          <ng-content select="[footer]" />
        </footer>
      </div>
    </div>
  `,
})
export class ModalComponent {
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly title = input.required<string>();
  /** Cierre pedido por el usuario: aspa, fondo o Escape. */
  readonly dismissed = output<void>();

  constructor() {
    // El foco entra en el diálogo al abrirse; sin esto el teclado se queda
    // detrás, sobre la página, y Escape no llega.
    afterNextRender(() => this.panel()?.nativeElement.focus());
  }
}
