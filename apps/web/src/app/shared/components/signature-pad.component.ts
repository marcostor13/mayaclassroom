import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Lienzo para firmar con el dedo o con el ratón.
 *
 * Se dibuja a la resolución real de la pantalla (`devicePixelRatio`) y se
 * escala por CSS: en un móvil moderno, un lienzo a resolución lógica produce un
 * trazo dentado que en el certificado se nota mucho.
 *
 * Usa eventos de puntero, que cubren dedo, lápiz y ratón con el mismo código;
 * `touch-action: none` evita que el navegador entienda el trazo como un
 * desplazamiento de la página y se lleve la firma a medias.
 */
@Component({
  selector: 'maya-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="firma">
      <canvas
        #lienzo
        class="firma__lienzo"
        [attr.aria-label]="label()"
        role="img"
        (pointerdown)="empezar($event)"
        (pointermove)="mover($event)"
        (pointerup)="terminar()"
        (pointerleave)="terminar()"
        (pointercancel)="terminar()"
      ></canvas>

      <!-- La línea guía dice dónde firmar sin necesidad de explicarlo. -->
      @if (vacio()) {
        <span class="firma__pista maya-small maya-subtle">Firme aquí</span>
      }

      <div class="firma__acciones">
        <button
          type="button"
          class="maya-btn maya-btn--ghost maya-btn--sm"
          [disabled]="vacio()"
          (click)="limpiar()"
        >
          <maya-icon name="refresh" [size]="15" /> Borrar y repetir
        </button>
      </div>
    </div>
  `,
  styles: `
    .firma {
      position: relative;
      display: grid;
      gap: var(--maya-space-2);
    }

    .firma__lienzo {
      width: 100%;
      aspect-ratio: 3 / 1;
      background: var(--maya-surface);
      border: 1px dashed var(--maya-border-strong, var(--maya-border));
      border-radius: var(--maya-radius-md);
      /* Sin esto, el navegador interpreta el trazo como un arrastre de la
         página y la firma se corta en cuanto se mueve el dedo. */
      touch-action: none;
      cursor: crosshair;
    }

    .firma__pista {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
    }

    .firma__acciones {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class SignaturePadComponent implements AfterViewInit, OnDestroy {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  readonly label = input('Lienzo para firmar');
  /** Trazo del color del texto; el certificado lo imprime tal cual. */
  readonly strokeColor = input('#1a1a1a');

  /** Emite el PNG en base64 cada vez que se termina un trazo. */
  readonly changed = output<string | null>();

  readonly vacio = signal(true);

  private ctx: CanvasRenderingContext2D | null = null;
  private dibujando = false;
  private readonly onResize = () => this.ajustar();

  ngAfterViewInit(): void {
    this.ajustar();
    window.addEventListener('resize', this.onResize);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Ajusta el lienzo al tamaño real que ocupa.
   *
   * Redimensionar un `<canvas>` lo borra, así que se conserva lo dibujado y se
   * vuelve a pintar: girar el móvil no debe costar la firma.
   */
  private ajustar(): void {
    const canvas = this.canvas().nativeElement;
    const previo = this.vacio() ? null : canvas.toDataURL('image/png');

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.strokeColor();
    this.ctx = ctx;

    if (previo) {
      const imagen = new Image();
      imagen.onload = () => ctx.drawImage(imagen, 0, 0, rect.width, rect.height);
      imagen.src = previo;
    }
  }

  private punto(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas().nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  empezar(event: PointerEvent): void {
    if (!this.ctx) return;
    event.preventDefault();
    this.canvas().nativeElement.setPointerCapture(event.pointerId);
    this.dibujando = true;
    const { x, y } = this.punto(event);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    // Un toque sin arrastre debe dejar marca: sin esto, un punto no pinta nada.
    this.ctx.lineTo(x + 0.1, y);
    this.ctx.stroke();
    this.vacio.set(false);
  }

  mover(event: PointerEvent): void {
    if (!this.dibujando || !this.ctx) return;
    event.preventDefault();
    const { x, y } = this.punto(event);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  terminar(): void {
    if (!this.dibujando) return;
    this.dibujando = false;
    this.changed.emit(this.dataUrl());
  }

  limpiar(): void {
    const canvas = this.canvas().nativeElement;
    this.ctx?.clearRect(0, 0, canvas.width, canvas.height);
    this.vacio.set(true);
    this.changed.emit(null);
  }

  /** El trazo como PNG, o `null` si el lienzo está en blanco. */
  dataUrl(): string | null {
    if (this.vacio()) return null;
    return this.canvas().nativeElement.toDataURL('image/png');
  }
}
