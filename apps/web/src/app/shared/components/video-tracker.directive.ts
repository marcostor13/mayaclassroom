import { Directive, ElementRef, OnDestroy, effect, inject, input, output } from '@angular/core';
import { MediaSourceKind, MediaProgressDto } from '@maya/shared';
import { MediaProgressService } from '../../core/services/media-progress.service';

/** Cada cuántos segundos de reproducción se envía un latido al servidor. */
const HEARTBEAT_SECONDS = 15;

/**
 * Mide cuánto se ha visto de verdad de un `<video>` y lo registra.
 *
 * Cuenta el tiempo entre `timeupdate` consecutivos en lugar de la posición del
 * cursor: así, arrastrar la barra hasta el final no suma nada y una pestaña en
 * segundo plano tampoco, porque el navegador deja de emitir el evento. Los
 * saltos mayores que un latido se descartan por lo mismo.
 *
 * Se envía un latido cada quince segundos de reproducción y otro al pausar,
 * al terminar y al salir de la página: con un solo envío al final se perdería
 * todo lo visto de quien cierra la pestaña, que es justo lo habitual.
 */
@Directive({
  selector: 'video[mayaVideoTracker]',
})
export class VideoTrackerDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLVideoElement>>(ElementRef);
  private readonly media = inject(MediaProgressService);

  /** Actividad a la que pertenece el vídeo. Sin ella no se registra nada. */
  readonly moduleId = input.required<string>();
  /** Bloque de la lección, para distinguir varios vídeos en la misma página. */
  readonly mediaId = input.required<string>();
  readonly mediaTitle = input<string | null>(null);
  readonly kind = input<MediaSourceKind>(MediaSourceKind.Media);

  /** Avance devuelto por el servidor tras cada latido. */
  readonly progress = output<MediaProgressDto>();

  /** Segundos reproducidos aún sin enviar. */
  private pending = 0;
  private lastTime = 0;
  private started = false;
  private readonly onTimeUpdate = () => this.accumulate();
  private readonly onPlay = () => this.handlePlay();
  private readonly onPause = () => this.flush();
  private readonly onEnded = () => this.flush();
  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden') this.flush();
  };

  constructor() {
    const video = this.element.nativeElement;
    video.addEventListener('timeupdate', this.onTimeUpdate);
    video.addEventListener('play', this.onPlay);
    video.addEventListener('pause', this.onPause);
    video.addEventListener('ended', this.onEnded);
    document.addEventListener('visibilitychange', this.onHidden);

    // Cambiar de vídeo dentro de la misma página (un libro con capítulos)
    // reinicia el contador: lo pendiente pertenece al vídeo anterior.
    effect(() => {
      this.mediaId();
      this.pending = 0;
      this.lastTime = 0;
      this.started = false;
    });
  }

  ngOnDestroy(): void {
    const video = this.element.nativeElement;
    video.removeEventListener('timeupdate', this.onTimeUpdate);
    video.removeEventListener('play', this.onPlay);
    video.removeEventListener('pause', this.onPause);
    video.removeEventListener('ended', this.onEnded);
    document.removeEventListener('visibilitychange', this.onHidden);
    this.flush();
  }

  private handlePlay(): void {
    this.lastTime = this.element.nativeElement.currentTime;
    if (this.started) return;
    this.started = true;
    this.media
      .play(this.moduleId(), {
        mediaId: this.mediaId(),
        kind: this.kind(),
        title: this.mediaTitle(),
        durationSeconds: Math.round(this.element.nativeElement.duration || 0),
      })
      .subscribe({ next: (dto) => this.progress.emit(dto), error: () => undefined });
  }

  private accumulate(): void {
    const video = this.element.nativeElement;
    const delta = video.currentTime - this.lastTime;
    this.lastTime = video.currentTime;

    // Un salto hacia atrás o un adelanto mayor que un latido es una búsqueda,
    // no tiempo visto.
    if (delta > 0 && delta <= HEARTBEAT_SECONDS) this.pending += delta;
    if (this.pending >= HEARTBEAT_SECONDS) this.flush();
  }

  private flush(): void {
    const video = this.element.nativeElement;
    if (this.pending <= 0.5) return;

    const delta = Math.min(this.pending, 120);
    this.pending = 0;
    this.media
      .heartbeat(this.moduleId(), {
        mediaId: this.mediaId(),
        kind: this.kind(),
        title: this.mediaTitle(),
        durationSeconds: Math.round(video.duration || 0),
        positionSeconds: Math.round(video.currentTime),
        deltaSeconds: Math.round(delta),
      })
      .subscribe({ next: (dto) => this.progress.emit(dto), error: () => undefined });
  }
}
