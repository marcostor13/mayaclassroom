import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FileRef } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';

interface Herramienta {
  comando: string;
  valor?: string;
  icono: string;
  titulo: string;
}

/**
 * Editor de texto enriquecido.
 *
 * Se apoya en `contenteditable` y `execCommand` en lugar de traer una
 * biblioteca de editor: para lo que hace falta aquí —negrita, títulos, listas,
 * enlaces e imágenes— una dependencia de cientos de kilobytes no se justifica,
 * y el paquete del cliente lo pagan quienes solo leen los cursos.
 *
 * `execCommand` está marcado como obsoleto, pero no hay sustituto estándar y
 * todos los navegadores lo mantienen. Si algún día deja de funcionar, el
 * contenido seguirá siendo HTML corriente y el cambio quedaría acotado a este
 * fichero.
 *
 * Lo que se escribe aquí lo limpia el servidor antes de guardarlo.
 */
@Component({
  selector: 'maya-rich-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="editor" [class.editor--enfocado]="focused()">
      <div class="editor__barra" role="toolbar" aria-label="Formato">
        @for (h of herramientas; track h.comando + (h.valor ?? '')) {
          <button
            type="button"
            class="editor__boton"
            [title]="h.titulo"
            [attr.aria-label]="h.titulo"
            (mousedown)="$event.preventDefault()"
            (click)="ejecutar(h.comando, h.valor)"
          >
            <maya-icon [name]="h.icono" [size]="15" />
          </button>
        }

        <span class="editor__separador"></span>

        <button
          type="button"
          class="editor__boton"
          title="Insertar enlace"
          (mousedown)="$event.preventDefault()"
          (click)="insertarEnlace()"
        >
          <maya-icon name="link" [size]="15" />
        </button>

        <input
          type="file"
          class="maya-sr-only"
          [id]="idImagen"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          (change)="insertarImagen($event)"
        />
        <label class="editor__boton" [attr.for]="idImagen" [title]="'Insertar imagen'">
          <maya-icon [name]="subiendo() ? 'refresh' : 'file'" [size]="15" />
        </label>

        <input
          type="file"
          class="maya-sr-only"
          [id]="idVideo"
          accept="video/mp4,video/webm,video/ogg,audio/mpeg,audio/ogg,audio/wav"
          (change)="insertarMedia($event)"
        />
        <label class="editor__boton" [attr.for]="idVideo" [title]="'Insertar vídeo o audio'">
          <maya-icon [name]="subiendo() ? 'refresh' : 'play-circle'" [size]="15" />
        </label>

        <button
          type="button"
          class="editor__boton"
          title="Quitar formato"
          (mousedown)="$event.preventDefault()"
          (click)="ejecutar('removeFormat')"
        >
          <maya-icon name="x" [size]="15" />
        </button>
      </div>

      <div
        #cuerpo
        class="editor__cuerpo"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        [attr.data-vacio]="placeholder()"
        (input)="alEscribir()"
        (focus)="focused.set(true)"
        (blur)="focused.set(false)"
      ></div>
    </div>
  `,
  styles: `
    .editor {
      border: 1px solid var(--maya-border);
      border-radius: var(--maya-radius-md);
      background: var(--maya-surface);
      overflow: hidden;
      transition: border-color var(--maya-duration) var(--maya-ease);
    }

    .editor--enfocado {
      border-color: var(--maya-primary);
    }

    .editor__barra {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      padding: var(--maya-space-2);
      border-bottom: 1px solid var(--maya-border);
      background: var(--maya-surface-alt);
      /* La barra sigue accesible al desplazarse por un texto largo. */
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .editor__boton {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: var(--maya-radius-sm);
      background: transparent;
      color: var(--maya-text-soft);
      cursor: pointer;
    }

    .editor__boton:hover,
    .editor__boton:active {
      background: var(--maya-primary-softer);
      color: var(--maya-primary-deep);
    }

    .editor__separador {
      width: 1px;
      height: 20px;
      margin-inline: var(--maya-space-1);
      background: var(--maya-border);
    }

    .editor__cuerpo {
      min-height: 260px;
      max-height: 60vh;
      overflow-y: auto;
      padding: var(--maya-space-4);
      /* 16px como mínimo: por debajo, Safari de iOS hace zoom al enfocar. */
      font-size: 16px;
      line-height: 1.65;
      outline: none;
    }

    .editor__cuerpo:empty::before {
      content: attr(data-vacio);
      color: var(--maya-text-soft);
      pointer-events: none;
    }

    .editor__cuerpo :is(h2, h3) {
      margin: var(--maya-space-4) 0 var(--maya-space-2);
      line-height: 1.3;
    }

    .editor__cuerpo p {
      margin: 0 0 var(--maya-space-3);
    }

    .editor__cuerpo :is(ul, ol) {
      margin: 0 0 var(--maya-space-3);
      padding-left: 1.4rem;
    }

    .editor__cuerpo :is(img, video) {
      max-width: 100%;
      height: auto;
      border-radius: var(--maya-radius-md);
    }

    .editor__cuerpo audio {
      width: 100%;
    }

    .editor__cuerpo a {
      color: var(--maya-primary-ink);
    }
  `,
})
export class RichEditorComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly value = model<string>('');
  readonly placeholder = input('Escriba aquí el contenido…');

  readonly focused = signal(false);
  readonly subiendo = signal(false);
  readonly idImagen = `rich-img-${Math.random().toString(36).slice(2, 9)}`;
  readonly idVideo = `rich-media-${Math.random().toString(36).slice(2, 9)}`;

  private readonly cuerpo = viewChild.required<ElementRef<HTMLDivElement>>('cuerpo');

  /** El contenido inicial se vuelca una sola vez. */
  private volcado = false;

  readonly herramientas: Herramienta[] = [
    { comando: 'bold', icono: 'edit', titulo: 'Negrita' },
    { comando: 'formatBlock', valor: 'h2', icono: 'template', titulo: 'Título' },
    { comando: 'formatBlock', valor: 'h3', icono: 'layers', titulo: 'Subtítulo' },
    { comando: 'insertUnorderedList', icono: 'list-checks', titulo: 'Lista' },
    { comando: 'insertOrderedList', icono: 'clipboard-list', titulo: 'Lista numerada' },
    { comando: 'formatBlock', valor: 'blockquote', icono: 'message-square', titulo: 'Cita' },
  ];

  ngAfterViewInit(): void {
    // Se escribe el valor recibido sin pasar por `innerHTML` en cada cambio:
    // reescribir el nodo mientras se teclea le quita el cursor de sitio.
    if (!this.volcado) {
      this.cuerpo().nativeElement.innerHTML = this.value() ?? '';
      this.volcado = true;
    }
  }

  ejecutar(comando: string, valor?: string): void {
    this.cuerpo().nativeElement.focus();
    document.execCommand(comando, false, valor);
    this.alEscribir();
  }

  insertarEnlace(): void {
    const url = prompt('Dirección del enlace');
    if (!url) return;
    this.ejecutar('createLink', url);
  }

  insertarImagen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);
    this.subiendo.set(true);
    this.api.upload<FileRef>('/files/upload/image', form, { purpose: 'course' }).subscribe({
      next: (ref) => {
        this.subiendo.set(false);
        this.ejecutar('insertImage', ref.url);
        input.value = '';
      },
      error: () => {
        this.subiendo.set(false);
        input.value = '';
      },
    });
  }

  /**
   * Inserta un vídeo o un audio con sus controles.
   *
   * No hay comando de `execCommand` para esto, así que se compone la etiqueta
   * y se inserta como HTML. `preload="metadata"` evita que la lección se
   * descargue entera de golpe al abrirla: basta con la duración para pintar la
   * barra.
   */
  insertarMedia(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);
    this.subiendo.set(true);
    this.api.upload<FileRef>('/files/upload/image', form, { purpose: 'course' }).subscribe({
      next: (ref) => {
        this.subiendo.set(false);
        const etiqueta = ref.mimeType.startsWith('audio/') ? 'audio' : 'video';
        this.ejecutar(
          'insertHTML',
          `<${etiqueta} controls preload="metadata" src="${ref.url}"></${etiqueta}><p></p>`,
        );
        input.value = '';
      },
      error: () => {
        this.subiendo.set(false);
        input.value = '';
      },
    });
  }

  alEscribir(): void {
    this.value.set(this.cuerpo().nativeElement.innerHTML);
  }
}
