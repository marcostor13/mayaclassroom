import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { FileRef } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { FileSizePipe } from '../pipes/file-size.pipe';
import { IconComponent } from './icon.component';

/**
 * Materiales adjuntos de una actividad: apuntes, plantillas, hojas de cálculo…
 *
 * A diferencia de las imágenes y los vídeos de la lección, estos ficheros son
 * **privados**: se guardan sin marcar como públicos y se sirven por la ruta que
 * comprueba permisos. Por eso no se enlazan con un `href` corriente —una
 * etiqueta `<a>` no envía la sesión y la descarga acabaría en un 401— sino que
 * se piden y se entregan al navegador ya descargados.
 */
@Component({
  selector: 'maya-file-attachments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FileSizePipe],
  template: `
    <div class="maya-field">
      @if (label()) {
        <label class="maya-label">{{ label() }}</label>
      }

      @if (files().length) {
        <ul class="adjuntos">
          @for (file of files(); track file.id) {
            <li class="adjunto">
              <maya-icon [name]="icono(file)" [size]="18" />
              <span class="adjunto__texto">
                <span class="maya-small maya-bold">{{ file.filename }}</span>
                <span class="maya-tiny maya-subtle">{{ file.size | fileSize }}</span>
              </span>
              <button
                type="button"
                class="maya-btn maya-btn--ghost maya-btn--icon maya-btn--sm"
                (click)="descargar(file)"
                [attr.aria-label]="'Descargar ' + file.filename"
              >
                <maya-icon name="download" [size]="15" />
              </button>
              @if (editable()) {
                <button
                  type="button"
                  class="maya-btn maya-btn--ghost maya-btn--icon maya-btn--sm"
                  (click)="quitar(file)"
                  [attr.aria-label]="'Quitar ' + file.filename"
                >
                  <maya-icon name="x" [size]="15" />
                </button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="maya-small maya-muted">Todavía no hay materiales.</p>
      }

      @if (editable()) {
        <input
          type="file"
          class="maya-sr-only"
          [id]="inputId"
          multiple
          (change)="subir($event)"
        />
        <label
          class="maya-btn maya-btn--secondary maya-btn--sm"
          style="margin-top: var(--maya-space-3)"
          [attr.for]="inputId"
        >
          <maya-icon [name]="subiendo() ? 'refresh' : 'upload'" [size]="15" />
          {{ subiendo() ? 'Subiendo…' : 'Añadir materiales' }}
        </label>
        @if (hint()) {
          <span class="maya-hint">{{ hint() }}</span>
        }
      }
    </div>
  `,
  styles: `
    .adjuntos {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--maya-space-2);
    }

    .adjunto {
      display: flex;
      align-items: center;
      gap: var(--maya-space-3);
      padding: var(--maya-space-2) var(--maya-space-3);
      border: 1px solid var(--maya-border);
      border-radius: var(--maya-radius-md);
      background: var(--maya-surface);
    }

    .adjunto__texto {
      display: flex;
      flex-direction: column;
      gap: 1px;
      flex: 1;
      min-width: 0;
    }

    .adjunto__texto span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
})
export class FileAttachmentsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly files = model<FileRef[]>([]);

  readonly label = input('Materiales');
  readonly hint = input('Apuntes, plantillas o cualquier documento de apoyo.');
  readonly editable = input(true);
  /** Dónde se guardan; sirve para agrupar los ficheros de una misma actividad. */
  readonly component = input('mod');
  readonly fileArea = input('content');

  readonly subiendo = signal(false);

  readonly inputId = `adj-${Math.random().toString(36).slice(2, 9)}`;

  icono(file: FileRef): string {
    if (file.mimeType.startsWith('image/')) return 'file-text';
    if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
      return 'play-circle';
    }
    return 'file';
  }

  subir(event: Event): void {
    const input = event.target as HTMLInputElement;
    const seleccion = Array.from(input.files ?? []);
    if (!seleccion.length) return;

    const form = new FormData();
    for (const file of seleccion) form.append('files', file);

    this.subiendo.set(true);
    this.api
      .upload<FileRef[]>('/files/upload-many', form, {
        component: this.component(),
        fileArea: this.fileArea(),
      })
      .subscribe({
        next: (subidos) => {
          this.subiendo.set(false);
          this.files.update((actual) => [...actual, ...subidos]);
          input.value = '';
        },
        error: () => {
          this.subiendo.set(false);
          input.value = '';
        },
      });
  }

  /**
   * Descarga pidiendo el fichero con la sesión puesta y entregándolo al
   * navegador. Un enlace directo devolvería 401.
   */
  descargar(file: FileRef): void {
    this.api.download(`/files/${file.id}/download`).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = file.filename;
        enlace.click();
        // Se libera enseguida: cada objeto retiene el fichero entero en memoria.
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('No se pudo descargar', file.filename),
    });
  }

  quitar(file: FileRef): void {
    this.files.update((actual) => actual.filter((item) => item.id !== file.id));
  }
}
