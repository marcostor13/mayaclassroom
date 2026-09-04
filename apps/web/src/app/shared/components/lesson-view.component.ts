import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { LessonBlock, LessonBlockType, MediaProgressDto, MediaSourceKind } from '@maya/shared';
import { IconComponent } from './icon.component';
import { VideoTrackerDirective } from './video-tracker.directive';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { SafeResourcePipe } from '../pipes/safe-resource.pipe';
import { MediaProgressService } from '../../core/services/media-progress.service';
import { resolveVideo } from '../utils/embed';
import type { VideoResuelto } from '../utils/embed';

/**
 * Lección compuesta por bloques, tal como la ve quien la estudia.
 *
 * Va aparte del editor a propósito: el editor pesa —trae el editor de texto y
 * la subida de ficheros— y quien solo lee no tiene por qué descargarlo.
 */
@Component({
  selector: 'maya-lesson-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, VideoTrackerDirective, SafeHtmlPipe, SafeResourcePipe],
  template: `
    <div class="leccion">
      @for (block of blocks(); track block.id) {
        @switch (block.type) {
          @case (Tipo.Text) {
            <div class="prosa" [innerHTML]="block.content ?? '' | safeHtml"></div>
          }

          @case (Tipo.Image) {
            <figure class="figura">
              <img [src]="block.url" [alt]="block.title ?? ''" loading="lazy" />
              @if (block.title) {
                <figcaption class="maya-tiny maya-subtle">{{ block.title }}</figcaption>
              }
            </figure>
          }

          @case (Tipo.Media) {
            @if (esAudio(block)) {
              <audio controls preload="metadata" [src]="block.url"></audio>
            } @else if (moduleId(); as modulo) {
              <video
                class="medio"
                controls
                preload="metadata"
                [src]="block.url"
                mayaVideoTracker
                [moduleId]="modulo"
                [mediaId]="block.id"
                [mediaTitle]="block.title ?? null"
                (progress)="anotar($event)"
              ></video>
              @if (avance(block.id); as visto) {
                <p class="visto maya-tiny" [class.visto--hecho]="visto.completed">
                  <maya-icon [name]="visto.completed ? 'check' : 'play'" [size]="14" />
                  {{ visto.completed ? 'Vídeo completado' : 'Visto el ' + visto.percent + ' %' }}
                </p>
              }
            } @else {
              <video class="medio" controls preload="metadata" [src]="block.url"></video>
            }
          }

          @case (Tipo.Embed) {
            @if (video(block.url); as clip) {
              <div class="marco">
                @if (clip.tipo === 'fichero' && moduleId()) {
                  <video
                    [src]="clip.src"
                    controls
                    playsinline
                    preload="metadata"
                    mayaVideoTracker
                    [moduleId]="moduleId()!"
                    [mediaId]="block.id"
                    [mediaTitle]="block.title ?? null"
                    (progress)="anotar($event)"
                  ></video>
                } @else if (clip.tipo === 'fichero') {
                  <video [src]="clip.src" controls playsinline preload="metadata"></video>
                } @else if (clip.src | safeResource; as src) {
                  <iframe
                    [src]="src"
                    title="Vídeo de la lección"
                    loading="lazy"
                    allowfullscreen
                    referrerpolicy="strict-origin-when-cross-origin"
                  ></iframe>
                }
              </div>

              <!-- Un vídeo alojado fuera no informa de la posición: su avance
                   no se puede medir, así que se confirma a mano. -->
              @if (moduleId() && clip.tipo !== 'fichero') {
                @if (estaVisto(block.id)) {
                  <p class="visto visto--hecho maya-tiny">
                    <maya-icon name="check" [size]="14" /> Vídeo confirmado como visto
                  </p>
                } @else {
                  <button type="button" class="maya-btn maya-btn--ghost maya-btn--sm"
                          (click)="confirmarExterno(block)">
                    <maya-icon name="check" [size]="16" /> He terminado de ver este vídeo
                  </button>
                }
              }
            }
          }

          @case (Tipo.Callout) {
            <aside class="aviso" [class]="'aviso aviso--' + (block.variant ?? 'info')">
              <maya-icon [name]="iconoAviso(block)" [size]="18" />
              <div>
                @if (block.title) {
                  <p class="maya-small maya-bold">{{ block.title }}</p>
                }
                <div class="prosa" [innerHTML]="block.content ?? '' | safeHtml"></div>
              </div>
            </aside>
          }

          @case (Tipo.Quote) {
            <blockquote class="cita">
              <div [innerHTML]="block.content ?? '' | safeHtml"></div>
              @if (block.title) {
                <footer class="maya-small maya-subtle">— {{ block.title }}</footer>
              }
            </blockquote>
          }

          @case (Tipo.Code) {
            <pre class="codigo"><code>{{ block.content }}</code></pre>
          }

          @case (Tipo.Divider) {
            <hr class="separador" />
          }
        }
      }
    </div>
  `,
  styles: `
    .leccion {
      display: grid;
      gap: var(--maya-space-4);
      /* Ancho de lectura cómodo: más allá de unos 70 caracteres el ojo pierde
         el renglón al saltar de línea. */
      max-width: 72ch;
    }

    .prosa :is(h2, h3) {
      margin: var(--maya-space-4) 0 var(--maya-space-2);
      line-height: 1.3;
    }

    .prosa p {
      margin: 0 0 var(--maya-space-3);
      line-height: 1.7;
    }

    .prosa :is(ul, ol) {
      margin: 0 0 var(--maya-space-3);
      padding-left: 1.4rem;
    }

    .prosa a {
      color: var(--maya-primary-ink);
    }

    .prosa :is(img, video) {
      max-width: 100%;
      height: auto;
      border-radius: var(--maya-radius-md);
    }

    .figura {
      margin: 0;
      display: grid;
      gap: var(--maya-space-2);
    }

    .figura img,
    .medio {
      width: 100%;
      border-radius: var(--maya-radius-md);
    }

    audio {
      width: 100%;
    }

    .visto {
      display: flex;
      align-items: center;
      gap: var(--maya-space-2);
      margin: 0;
      color: var(--maya-text-soft);
    }

    .visto--hecho {
      color: var(--maya-success);
    }

    .marco {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--maya-radius-md);
      overflow: hidden;
      background: #000;
    }

    .marco :is(iframe, video) {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .marco video {
      object-fit: contain;
    }

    .aviso {
      display: flex;
      gap: var(--maya-space-3);
      padding: var(--maya-space-4);
      border-left: 3px solid var(--maya-info);
      background: var(--maya-info-soft);
      border-radius: 0 var(--maya-radius-md) var(--maya-radius-md) 0;
    }

    .aviso--success {
      border-left-color: var(--maya-success);
      background: var(--maya-success-soft);
    }

    .aviso--warning {
      border-left-color: var(--maya-warning);
      background: var(--maya-warning-soft);
    }

    .aviso .prosa p:last-child {
      margin-bottom: 0;
    }

    .cita {
      margin: 0;
      padding-left: var(--maya-space-4);
      border-left: 3px solid var(--maya-primary);
      font-size: var(--maya-text-md);
      font-style: italic;
      color: var(--maya-text-soft);
    }

    .codigo {
      margin: 0;
      padding: var(--maya-space-4);
      background: var(--maya-surface-alt);
      border: 1px solid var(--maya-border);
      border-radius: var(--maya-radius-md);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: var(--maya-text-sm);
      /* El código no se parte: se desplaza dentro de su caja y no desborda la
         página, que es lo que rompería la maqueta en móvil. */
      overflow-x: auto;
    }

    .separador {
      border: none;
      border-top: 1px solid var(--maya-border);
      margin: var(--maya-space-2) 0;
    }
  `,
})
export class LessonViewComponent {
  private readonly media = inject(MediaProgressService);

  readonly blocks = input<LessonBlock[]>([]);

  /**
   * Actividad que contiene la lección.
   *
   * Sin ella la lección se ve igual pero no se registra nada: es lo que pasa
   * en la vista previa del editor y en el escaparate público, donde todavía no
   * hay ni matrícula ni a quién atribuir el avance.
   */
  readonly moduleId = input<string | null>(null);

  readonly Tipo = LessonBlockType;

  /** Avance por bloque, tal como lo devuelve el servidor. */
  private readonly progreso = signal<Record<string, MediaProgressDto>>({});

  /** Vídeos de la lección ya completados, para la barra de la actividad. */
  readonly completados = computed(
    () => Object.values(this.progreso()).filter((p) => p.completed).length,
  );

  constructor() {
    // El avance ya registrado se pide al conocerse la actividad: sin esto,
    // volver a una lección terminada la enseñaría como si no se hubiera visto
    // nunca. Va en un efecto y no en el constructor porque una entrada de
    // señal todavía no tiene valor cuando se construye el componente.
    effect((onCleanup) => {
      const modulo = this.moduleId();
      if (!modulo) return;
      const sub = this.media.ofModule(modulo).subscribe({
        next: (items) =>
          this.progreso.set(Object.fromEntries(items.map((item) => [item.mediaId, item]))),
        error: () => undefined,
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  avance(mediaId: string): MediaProgressDto | null {
    return this.progreso()[mediaId] ?? null;
  }

  estaVisto(mediaId: string): boolean {
    return this.progreso()[mediaId]?.completed ?? false;
  }

  anotar(dto: MediaProgressDto): void {
    this.progreso.update((map) => ({ ...map, [dto.mediaId]: dto }));
  }

  /** Marca como visto un vídeo alojado fuera, que no se puede medir. */
  confirmarExterno(block: LessonBlock): void {
    const modulo = this.moduleId();
    if (!modulo) return;
    this.media
      .play(modulo, {
        mediaId: block.id,
        kind: MediaSourceKind.Embed,
        title: block.title ?? null,
        durationSeconds: 0,
      })
      .subscribe({ next: (dto) => this.anotar(dto), error: () => undefined });
  }

  /**
   * Un bloque incrustado puede traer un vídeo de YouTube o la dirección de un
   * fichero. Se resuelve aquí para pintar cada uno con lo que le corresponde.
   */
  video(url: string | null | undefined): VideoResuelto | null {
    return resolveVideo(url);
  }

  esAudio(block: LessonBlock): boolean {
    return (block.mimeType ?? '').startsWith('audio/');
  }

  iconoAviso(block: LessonBlock): string {
    if (block.variant === 'success') return 'check';
    if (block.variant === 'warning') return 'alert';
    return 'info';
  }
}
