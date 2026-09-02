import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { FileRef } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

/** Usos admitidos; cada uno exige su capacidad en la API. */
export type ImagePurpose = 'branding' | 'course' | 'storefront';

/**
 * Subida de una imagen que queda accesible públicamente.
 *
 * Solo admite subir el fichero. No hay campo para pegar una dirección: pedir
 * una URL obliga a tener la imagen alojada en otro sitio, y las que se pegaban
 * de páginas ajenas se rompían en cuanto el origen las movía o bloqueaba el
 * enlazado desde fuera.
 */
@Component({
  selector: 'maya-image-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="maya-field">
      @if (label()) {
        <label class="maya-label" [attr.for]="inputId">{{ label() }}</label>
      }

      <div class="subida">
        @if (value()) {
          <img class="subida__vista" [src]="value()" alt="" />
        } @else {
          <div class="subida__hueco"><maya-icon name="file" [size]="20" /></div>
        }

        <div class="subida__acciones">
          <input
            type="file"
            class="maya-sr-only"
            [id]="inputId"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            (change)="pick($event)"
          />
          <label class="maya-btn maya-btn--secondary maya-btn--sm" [attr.for]="inputId">
            <maya-icon name="upload" [size]="15" />
            {{ uploading() ? 'Subiendo…' : value() ? 'Cambiar' : 'Subir imagen' }}
          </label>
          @if (value()) {
            <button type="button" class="maya-btn maya-btn--ghost maya-btn--sm" (click)="clear()">
              Quitar
            </button>
          }
        </div>
      </div>

      @if (hint()) {
        <span class="maya-hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .subida {
      display: flex;
      align-items: center;
      gap: var(--maya-space-3);
    }

    .subida__vista,
    .subida__hueco {
      width: 72px;
      height: 72px;
      flex: none;
      border-radius: var(--maya-radius-md);
      border: 1px solid var(--maya-border);
      background: var(--maya-surface-alt);
      object-fit: contain;
    }

    .subida__hueco {
      display: grid;
      place-items: center;
      color: var(--maya-text-soft);
    }

    .subida__acciones {
      display: flex;
      flex-wrap: wrap;
      gap: var(--maya-space-2);
    }
  `,
})
export class ImageUploadComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  /** Dirección de la imagen. Bidireccional: el padre la lee y la escribe. */
  readonly value = model<string | null>(null);

  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly purpose = input<ImagePurpose>('branding');

  readonly uploading = signal(false);

  /** Identificador único para enlazar la etiqueta con su campo de fichero. */
  readonly inputId = `img-${Math.random().toString(36).slice(2, 9)}`;

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);

    this.uploading.set(true);
    this.api.upload<FileRef>('/files/upload/image', form, { purpose: this.purpose() }).subscribe({
      next: (ref) => {
        this.uploading.set(false);
        this.value.set(ref.url);
        // El campo se vacía para que elegir el mismo fichero otra vez vuelva a
        // disparar el evento; si no, `change` no salta la segunda vez.
        input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        input.value = '';
      },
    });
  }

  clear(): void {
    this.value.set(null);
    this.toast.info('Imagen quitada', 'Guarde los cambios para aplicarlo.');
  }
}
