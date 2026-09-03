import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { AvatarComponent, IconComponent } from '../../shared';

/**
 * Un recuadro de la sala: el vídeo de alguien, o su avatar cuando no publica.
 *
 * El flujo se asigna por código y no con una atadura de plantilla porque
 * `srcObject` es una propiedad del elemento que no acepta cadenas: Angular la
 * escribiría igual, pero perderíamos el control de cuándo reanudar la
 * reproducción, que es lo que hace falta cuando la pista cambia en caliente al
 * cambiar de cámara.
 */
@Component({
  selector: 'maya-live-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AvatarComponent],
  template: `
    <div class="tile" [class.tile--speaking]="speaking()" [class.tile--screen]="screen()">
      <video
        #video
        class="tile__video"
        [class.tile__video--mirror]="mirrored()"
        [class.tile__video--contain]="screen()"
        [class.is-hidden]="!hasVideo()"
        autoplay
        playsinline
        [muted]="muted()"
      ></video>

      @if (!hasVideo()) {
        <div class="tile__placeholder">
          <maya-avatar [name]="name()" [src]="avatarUrl()" size="xl" />
        </div>
      }

      <div class="tile__bar">
        <span class="tile__name">{{ name() }}</span>
        @if (hand()) {
          <span class="tile__badge tile__badge--hand" title="Ha pedido la palabra">
            <maya-icon name="alert" [size]="13" />
          </span>
        }
        <span class="tile__badge" [class.tile__badge--off]="!audio()">
          <maya-icon [name]="audio() ? 'phone' : 'eye-off'" [size]="13" />
        </span>
      </div>

      @if (connecting()) {
        <span class="tile__status">Conectando…</span>
      }
    </div>
  `,
  styleUrl: './live-tile.component.scss',
})
export class LiveTileComponent {
  readonly stream = input<MediaStream | null>(null);
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly audio = input(false);
  readonly hand = input(false);
  readonly speaking = input(false);
  /** El recuadro propio se refleja: es como la gente espera verse. */
  readonly mirrored = input(false);
  /** Silencia el elemento; obligatorio en el recuadro propio para no acoplar. */
  readonly muted = input(false);
  readonly screen = input(false);
  readonly connecting = input(false);
  readonly hasVideo = input(false);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  constructor() {
    effect(() => {
      const element = this.videoRef()?.nativeElement;
      const stream = this.stream();
      if (!element) return;
      if (element.srcObject !== stream) element.srcObject = stream;
      if (stream) void element.play().catch(() => undefined);
    });
  }
}
