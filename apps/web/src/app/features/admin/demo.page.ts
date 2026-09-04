import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DemoResetStatusDto } from '@maya/shared';
import { AdminService } from '../../core/services/admin.service';
import { ToastService } from '../../core/services/toast.service';
import { FormatDatePipe, IconComponent } from '../../shared';

/** Cada cuánto se vuelve a preguntar mientras el trabajo está en marcha. */
const SONDEO_MS = 3000;

/**
 * Reinicio de la empresa de demostración.
 *
 * La demostración la comparten todos los visitantes y puede escribir contenido
 * docente, así que se desordena con el uso: cursos borrados, notas cambiadas,
 * la página pública editada. Nada de eso rompe la plataforma —de la
 * administración se ocupa `DemoGuard`— pero sí estropea lo que ve la siguiente
 * visita, y hasta ahora arreglarlo exigía entrar por SSH a lanzar la siembra.
 *
 * La pantalla no espera a que termine: la API arranca el trabajo y devuelve, y
 * aquí se pregunta por el estado cada pocos segundos. Rehacer la demostración
 * pasa del minuto y una petición que aguantase todo eso se cortaría en el
 * proxy dejando la base a medias.
 */
@Component({
  selector: 'maya-admin-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FormatDatePipe, IconComponent],
  templateUrl: './demo.page.html',
  styleUrl: './demo.page.scss',
})
export class AdminDemoPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly estado = signal<DemoResetStatusDto | null>(null);
  readonly cargando = signal(true);
  readonly confirmacion = signal('');

  /** El trabajo está en marcha: la pantalla se pone a esperar. */
  readonly enMarcha = computed(() => this.estado()?.running === true);

  /**
   * Solo se habilita el botón cuando lo escrito coincide con el identificador
   * de la empresa. La API lo vuelve a comprobar: esto es cortesía, no barrera.
   */
  readonly puedeReiniciar = computed(() => {
    const slug = this.estado()?.tenantSlug;
    if (!slug || this.enMarcha()) return false;
    return this.confirmacion().trim().toLowerCase() === slug.toLowerCase();
  });

  /** Lo que se borró la última vez, ordenado de más a menos. */
  readonly borrados = computed(() => {
    const removed = this.estado()?.summary?.removed ?? {};
    return Object.entries(removed).sort(([, a], [, b]) => b - a);
  });

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.pararSondeo());
    this.consultar(true);
  }

  private pararSondeo(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  /**
   * Pregunta por el estado y, si el trabajo sigue, se programa otra vez.
   *
   * Con `setTimeout` encadenado y no con un intervalo: así nunca se solapan dos
   * consultas si la API tarda, que es justo lo que pasa mientras siembra.
   */
  private consultar(primera = false): void {
    this.admin.demoReset().subscribe({
      next: (estado) => {
        const veniaEnMarcha = this.enMarcha();
        this.estado.set(estado);
        this.cargando.set(false);

        if (estado.running) {
          this.temporizador = setTimeout(() => this.consultar(), SONDEO_MS);
          return;
        }

        this.pararSondeo();
        // Solo se avisa del final que hemos visto ocurrir, no del resultado
        // que ya estaba ahí al abrir la pantalla.
        if (veniaEnMarcha && !primera) {
          if (estado.ok) this.toast.success('La demostración está lista de nuevo.');
          else this.toast.error('No se pudo reiniciar', estado.error ?? 'Revise el registro.');
        }
      },
      error: () => {
        this.cargando.set(false);
        this.pararSondeo();
      },
    });
  }

  reiniciar(): void {
    if (!this.puedeReiniciar()) return;
    this.admin.startDemoReset(this.confirmacion().trim()).subscribe({
      next: (estado) => {
        this.estado.set(estado);
        this.confirmacion.set('');
        this.temporizador = setTimeout(() => this.consultar(), SONDEO_MS);
      },
    });
  }
}
