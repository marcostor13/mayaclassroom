import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { GuideStep } from '@maya/shared';
import { IconComponent } from '../icon.component';

/** Hueco iluminado alrededor del elemento del paso. */
interface Foco {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Margen alrededor del elemento resaltado, para que no quede pegado al borde. */
const AIRE = 8;

/**
 * Recorrido guiado sobre la interfaz real.
 *
 * Ilumina el elemento del paso y explica al lado qué hacer con él. Se apoya en
 * el atributo `data-guia="…"` y no en clases ni identificadores de CSS: así el
 * recorrido no se rompe al cambiar estilos ni al renombrar un contenedor, que
 * es exactamente lo que ocurre con los tutoriales que apuntan a selectores.
 *
 * Cuando el paso no señala nada —o el elemento aún no está en pantalla— la
 * tarjeta se centra y el recorrido sigue: quedarse esperando a un elemento que
 * no llega es la forma más rápida de dejar a alguien atrapado.
 */
@Component({
  selector: 'maya-guide-tour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './guide-tour.component.html',
  styleUrl: './guide-tour.component.scss',
})
export class GuideTourComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly title = input.required<string>();
  readonly steps = input.required<GuideStep[]>();
  readonly index = input.required<number>();

  readonly next = output<void>();
  readonly prev = output<void>();
  readonly close = output<void>();

  readonly foco = signal<Foco | null>(null);

  readonly paso = computed<GuideStep | null>(() => this.steps()[this.index()] ?? null);
  readonly total = computed(() => this.steps().length);
  readonly esUltimo = computed(() => this.index() >= this.total() - 1);
  readonly progreso = computed(() =>
    this.total() ? Math.round(((this.index() + 1) / this.total()) * 100) : 0,
  );

  /**
   * La tarjeta va debajo del foco si cabe y, si no, encima. Se calcula aquí y
   * no en CSS porque depende de dónde haya quedado el elemento tras el
   * desplazamiento, que solo se sabe en tiempo de ejecución.
   */
  readonly tarjetaArriba = computed(() => {
    const foco = this.foco();
    if (!foco) return false;
    return foco.top + foco.height > window.innerHeight - 260;
  });

  constructor() {
    // Recalcula el foco cada vez que cambia el paso.
    effect(() => {
      this.index();
      this.steps();
      queueMicrotask(() => this.medir());
    });
  }

  ngOnInit(): void {
    const recalcular = (): void => this.medir();
    window.addEventListener('resize', recalcular);
    window.addEventListener('scroll', recalcular, true);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('scroll', recalcular, true);
    });
    this.medir();
  }

  /** Localiza el elemento del paso, lo trae a la vista y mide su hueco. */
  private medir(): void {
    const target = this.paso()?.target;
    if (!target) return this.foco.set(null);

    const el = document.querySelector<HTMLElement>(`[data-guia="${target}"]`);
    if (!el) return this.foco.set(null);

    const rect = el.getBoundingClientRect();
    // Fuera de la ventana: se acerca primero y se vuelve a medir después de
    // que el navegador haya terminado de desplazarse.
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        const nuevo = el.getBoundingClientRect();
        this.foco.set({
          top: nuevo.top - AIRE,
          left: nuevo.left - AIRE,
          width: nuevo.width + AIRE * 2,
          height: nuevo.height + AIRE * 2,
        });
      }, 320);
      return;
    }

    this.foco.set({
      top: rect.top - AIRE,
      left: rect.left - AIRE,
      width: rect.width + AIRE * 2,
      height: rect.height + AIRE * 2,
    });
  }
}
