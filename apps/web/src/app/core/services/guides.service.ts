import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { GuideId } from '@maya/shared';
import type { GuideDefinition, GuideProgressDto } from '@maya/shared';
import { ApiService } from './api.service';

interface RespuestaGuias {
  guides: GuideDefinition[];
  progress: GuideProgressDto[];
}

/**
 * Guías interactivas.
 *
 * El progreso vive en el servidor porque el recorrido cruza pantallas y a
 * menudo también dispositivos: se empieza a configurar en el portátil y se
 * comprueba en el móvil. Guardarlo en el navegador haría empezar de cero cada
 * vez, que es peor que no tener guía.
 *
 * El servicio es también quien navega: cada paso declara en qué pantalla
 * ocurre, y llevar allí a quien sigue la guía es parte de guiarle.
 */
@Injectable({ providedIn: 'root' })
export class GuidesService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly guiasSignal = signal<GuideDefinition[]>([]);
  private readonly progresoSignal = signal<GuideProgressDto[]>([]);
  private readonly activaSignal = signal<GuideId | null>(null);
  private readonly pasoSignal = signal(0);
  private readonly cargadoSignal = signal(false);

  readonly guides = this.guiasSignal.asReadonly();
  readonly progress = this.progresoSignal.asReadonly();
  readonly activeId = this.activaSignal.asReadonly();
  readonly step = this.pasoSignal.asReadonly();
  readonly loaded = this.cargadoSignal.asReadonly();

  readonly active = computed(
    () => this.guiasSignal().find((guide) => guide.id === this.activaSignal()) ?? null,
  );

  /** Guías sin terminar ni descartar: las que tiene sentido ofrecer. */
  readonly pending = computed(() =>
    this.guiasSignal().filter((guide) => {
      const progreso = this.progressOf(guide.id);
      return !progreso?.completedAt && !progreso?.dismissed;
    }),
  );

  load(): Observable<RespuestaGuias> {
    return this.api.get<RespuestaGuias>('/guides').pipe(
      tap((respuesta) => {
        this.guiasSignal.set(respuesta.guides);
        this.progresoSignal.set(respuesta.progress);
        this.cargadoSignal.set(true);
      }),
    );
  }

  progressOf(id: GuideId): GuideProgressDto | undefined {
    return this.progresoSignal().find((row) => row.guideId === id);
  }

  completedCount(id: GuideId): number {
    return this.progressOf(id)?.completedStepIds.length ?? 0;
  }

  /** Arranca una guía por donde se quedó. */
  start(id: GuideId): void {
    const guide = this.guiasSignal().find((item) => item.id === id);
    if (!guide) return;

    const progreso = this.progressOf(id);
    const paso = progreso?.completedAt ? 0 : Math.min(progreso?.currentStep ?? 0, guide.steps.length - 1);

    this.activaSignal.set(id);
    this.pasoSignal.set(Math.max(0, paso));
    this.irAlPaso(paso);
  }

  next(): void {
    const guide = this.active();
    if (!guide) return;
    const indice = this.pasoSignal();
    const paso = guide.steps[indice];
    if (paso) this.guardar(guide.id, { completedStepId: paso.id, currentStep: indice + 1 });

    if (indice + 1 >= guide.steps.length) return this.finish();
    this.pasoSignal.set(indice + 1);
    this.irAlPaso(indice + 1);
  }

  prev(): void {
    const indice = this.pasoSignal();
    if (indice <= 0) return;
    this.pasoSignal.set(indice - 1);
    this.irAlPaso(indice - 1);
  }

  /**
   * Cierra la guía sin darla por terminada.
   *
   * Se marca `dismissed` para no volver a ofrecerla sola: quien la cierra está
   * diciendo «ahora no», y reaparecer en la siguiente pantalla sería insistir.
   * Se puede reabrir a mano desde el panel.
   */
  close(): void {
    const guide = this.active();
    if (guide) this.guardar(guide.id, { dismissed: true, currentStep: this.pasoSignal() });
    this.activaSignal.set(null);
  }

  finish(): void {
    this.activaSignal.set(null);
  }

  restart(id: GuideId): void {
    this.guardar(id, { restart: true });
    this.activaSignal.set(id);
    this.pasoSignal.set(0);
    this.irAlPaso(0);
  }

  private irAlPaso(indice: number): void {
    const paso = this.active()?.steps[indice];
    if (!paso?.route) return;
    if (this.router.url.split('?')[0] === paso.route) return;
    void this.router.navigateByUrl(paso.route);
  }

  private guardar(
    id: GuideId,
    payload: {
      completedStepId?: string;
      currentStep?: number;
      dismissed?: boolean;
      restart?: boolean;
    },
  ): void {
    this.api.patch<GuideProgressDto>(`/guides/${id}`, payload).subscribe({
      next: (actualizado) => {
        this.progresoSignal.update((lista) => {
          const resto = lista.filter((row) => row.guideId !== actualizado.guideId);
          return [...resto, actualizado];
        });
      },
      // El progreso es un adorno del recorrido, no el recorrido: si no se
      // puede guardar, la guía debe seguir funcionando.
      error: () => undefined,
    });
  }
}
