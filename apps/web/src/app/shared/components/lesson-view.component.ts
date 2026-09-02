import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LessonBlock, LessonBlockType } from '@maya/shared';
import { IconComponent } from './icon.component';
import { SafeHtmlPipe } from '../pipes/safe-html.pipe';
import { SafeResourcePipe } from '../pipes/safe-resource.pipe';

/**
 * Lección compuesta por bloques, tal como la ve quien la estudia.
 *
 * Va aparte del editor a propósito: el editor pesa —trae el editor de texto y
 * la subida de ficheros— y quien solo lee no tiene por qué descargarlo.
 */
@Component({
  selector: 'maya-lesson-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SafeHtmlPipe, SafeResourcePipe],
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
            } @else {
              <video class="medio" controls preload="metadata" [src]="block.url"></video>
            }
          }

          @case (Tipo.Embed) {
            @if (block.url | safeResource; as src) {
              <div class="marco">
                <iframe
                  [src]="src"
                  title="Vídeo de la lección"
                  loading="lazy"
                  allowfullscreen
                  referrerpolicy="strict-origin-when-cross-origin"
                ></iframe>
              </div>
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

    .marco {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--maya-radius-md);
      overflow: hidden;
      background: #000;
    }

    .marco iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
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
  readonly blocks = input<LessonBlock[]>([]);

  readonly Tipo = LessonBlockType;

  esAudio(block: LessonBlock): boolean {
    return (block.mimeType ?? '').startsWith('audio/');
  }

  iconoAviso(block: LessonBlock): string {
    if (block.variant === 'success') return 'check';
    if (block.variant === 'warning') return 'alert';
    return 'info';
  }
}
