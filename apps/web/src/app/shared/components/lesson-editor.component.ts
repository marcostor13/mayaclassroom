import { ChangeDetectionStrategy, Component, inject, model, signal } from '@angular/core';
import { FileRef, LessonBlock, LessonBlockType } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from './icon.component';
import { RichEditorComponent } from './rich-editor.component';

interface TipoBloque {
  type: LessonBlockType;
  label: string;
  icono: string;
  ayuda: string;
}

/** Un identificador corto basta: solo tiene que ser único dentro de la lección. */
function nuevoId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Editor de una lección por bloques.
 *
 * Cada trozo de la lección —un párrafo, un vídeo, un aviso— es un bloque que se
 * sube, se baja, se duplica y se borra por separado. Frente a un único campo de
 * texto enriquecido, la diferencia está en mover las cosas de sitio: con un
 * solo HTML hay que cortar y pegar marcas a mano y es fácil romper el formato;
 * aquí es pulsar una flecha.
 *
 * El vídeo puede subirse a la plataforma o enlazarse desde YouTube o Vimeo. Se
 * admiten las dos vías porque resuelven cosas distintas: subir da control y no
 * depende de nadie; enlazar no consume almacenamiento y aprovecha el material
 * que muchas empresas ya tienen publicado.
 */
@Component({
  selector: 'maya-lesson-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RichEditorComponent],
  templateUrl: './lesson-editor.component.html',
  styleUrl: './lesson-editor.component.scss',
})
export class LessonEditorComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly blocks = model<LessonBlock[]>([]);

  readonly Tipo = LessonBlockType;
  readonly subiendoEn = signal<string | null>(null);
  /** Bloque cuyo menú de ajustes está abierto. */
  readonly abierto = signal<string | null>(null);

  readonly tipos: TipoBloque[] = [
    {
      type: LessonBlockType.Text,
      label: 'Texto',
      icono: 'file-text',
      ayuda: 'Párrafos, títulos y listas',
    },
    { type: LessonBlockType.Image, label: 'Imagen', icono: 'file', ayuda: 'Una imagen con pie' },
    {
      type: LessonBlockType.Media,
      label: 'Vídeo o audio',
      icono: 'play-circle',
      ayuda: 'Subido a la plataforma',
    },
    {
      type: LessonBlockType.Embed,
      label: 'Vídeo externo',
      icono: 'link',
      ayuda: 'YouTube o Vimeo',
    },
    {
      type: LessonBlockType.Callout,
      label: 'Aviso',
      icono: 'info',
      ayuda: 'Destacar algo importante',
    },
    { type: LessonBlockType.Quote, label: 'Cita', icono: 'message-square', ayuda: 'Una cita' },
    { type: LessonBlockType.Code, label: 'Código', icono: 'template', ayuda: 'Bloque de código' },
    {
      type: LessonBlockType.Divider,
      label: 'Separador',
      icono: 'minus',
      ayuda: 'Una línea de separación',
    },
  ];

  etiqueta(type: LessonBlockType): string {
    return this.tipos.find((t) => t.type === type)?.label ?? 'Bloque';
  }

  icono(type: LessonBlockType): string {
    return this.tipos.find((t) => t.type === type)?.icono ?? 'file';
  }

  /* --------------------------- Gestión de bloques ------------------------- */

  /** Añade un bloque; si se indica una posición, justo después de ella. */
  add(type: LessonBlockType, despuesDe?: string): void {
    const bloque: LessonBlock = {
      id: nuevoId(),
      type,
      content: type === LessonBlockType.Text ? '' : null,
      url: null,
      title: null,
      variant: type === LessonBlockType.Callout ? 'info' : null,
      mimeType: null,
      filename: null,
    };

    this.blocks.update((lista) => {
      if (!despuesDe) return [...lista, bloque];
      const i = lista.findIndex((b) => b.id === despuesDe);
      return [...lista.slice(0, i + 1), bloque, ...lista.slice(i + 1)];
    });
    this.abierto.set(bloque.id);
  }

  update(id: string, cambio: Partial<LessonBlock>): void {
    this.blocks.update((lista) => lista.map((b) => (b.id === id ? { ...b, ...cambio } : b)));
  }

  /**
   * Sube o baja un bloque.
   *
   * Con botones y no arrastrando: funciona con el teclado, y arrastrar un
   * bloque alto —un vídeo, un texto largo— en una pantalla táctil es incómodo
   * de verdad.
   */
  move(id: string, delta: -1 | 1): void {
    this.blocks.update((lista) => {
      const from = lista.findIndex((b) => b.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= lista.length) return lista;
      const copia = [...lista];
      [copia[from], copia[to]] = [copia[to], copia[from]];
      return copia;
    });
  }

  duplicate(id: string): void {
    this.blocks.update((lista) => {
      const i = lista.findIndex((b) => b.id === id);
      if (i < 0) return lista;
      return [...lista.slice(0, i + 1), { ...lista[i], id: nuevoId() }, ...lista.slice(i + 1)];
    });
  }

  remove(id: string): void {
    this.blocks.update((lista) => lista.filter((b) => b.id !== id));
  }

  /* --------------------------------- Medios ------------------------------- */

  subirMedio(id: string, event: Event, tipo: 'image' | 'media'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append('file', file);
    this.subiendoEn.set(id);
    this.api.upload<FileRef>('/files/upload/image', form, { purpose: 'course' }).subscribe({
      next: (ref) => {
        this.subiendoEn.set(null);
        this.update(id, {
          url: ref.url,
          mimeType: ref.mimeType,
          filename: ref.filename,
          title: tipo === 'image' ? (ref.filename ?? null) : null,
        });
        input.value = '';
      },
      error: () => {
        this.subiendoEn.set(null);
        input.value = '';
      },
    });
  }

  /**
   * Convierte la dirección de YouTube o Vimeo en la de incrustar.
   *
   * Pegar el enlace de la barra del navegador es lo que hace todo el mundo, y
   * esa dirección no se puede meter en un marco: el navegador la rechaza. Se
   * traduce aquí para que funcione sin tener que explicarlo.
   */
  fijarIncrustado(id: string, valor: string): void {
    const url = valor.trim();
    if (!url) return this.update(id, { url: null });

    const youtube = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{11})/,
    );
    if (youtube) {
      return this.update(id, { url: `https://www.youtube.com/embed/${youtube[1]}` });
    }

    const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeo) return this.update(id, { url: `https://player.vimeo.com/video/${vimeo[1]}` });

    if (!/^https?:\/\//i.test(url)) {
      this.toast.warning('Dirección no válida', 'Pegue el enlace completo del vídeo.');
      return;
    }
    this.update(id, { url });
  }

  esAudio(block: LessonBlock): boolean {
    return (block.mimeType ?? '').startsWith('audio/');
  }
}
