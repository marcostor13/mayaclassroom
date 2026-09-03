import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@maya/shared';
import { IconComponent, LogoComponent } from '../../shared';
import {
  COMPARATIVA,
  DOLORES,
  IMPLEMENTACION,
  PASOS,
  PLANES,
  PREGUNTAS,
  WHATSAPP,
  whatsapp,
} from './landing.data';
import type { Plan } from './landing.data';

/**
 * Página de venta de la plataforma.
 *
 * Su público no es quien ya usa Maya Classroom, sino quien vende cursos por
 * internet y todavía paga comisión a un tercero. Por eso vive fuera del
 * armazón de la aplicación, sin barra lateral ni sesión, y todo lo que hay en
 * ella empuja hacia dos sitios: ver la demostración o escribir por WhatsApp.
 */
@Component({
  selector: 'maya-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, LogoComponent],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
})
export class LandingPage {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly planes = PLANES;
  readonly implementacion = IMPLEMENTACION;
  readonly comparativa = COMPARATIVA;
  readonly dolores = DOLORES;
  readonly pasos = PASOS;
  readonly preguntas = PREGUNTAS;

  /** La pregunta abierta. Solo una: una lista toda desplegada no se lee. */
  readonly abierta = signal<number | null>(0);

  /** Lo que costaría suelto todo lo que entra en la implementación. */
  readonly valorImplementacion = computed(() =>
    this.implementacion.reduce((suma, linea) => suma + linea.valor, 0),
  );

  constructor() {
    this.title.setTitle('Tu propia academia en internet · Maya Classroom');
    this.meta.updateTag({
      name: 'description',
      content:
        'Vende tus cursos desde tu propia plataforma, con tu marca y tu dominio, cobrando en ' +
        'soles y sin pagar comisión por venta. Implementación en 7 días.',
    });
  }

  precio(soles: number): string {
    return formatMoney(soles * 100);
  }

  alternar(indice: number): void {
    this.abierta.set(this.abierta() === indice ? null : indice);
  }

  /* --------------------------------- Enlaces ------------------------------ */

  readonly whatsappGeneral = whatsapp(
    'Hola, vi la página de Maya Classroom y quiero mi propia plataforma de cursos. ¿Lo vemos?',
  );

  readonly telefono = WHATSAPP;

  /** Cada plan escribe su propio mensaje: la conversación empieza ya situada. */
  whatsappPlan(plan: Plan): string {
    return whatsapp(
      `Hola, me interesa el plan ${plan.nombre} de Maya Classroom ` +
        `(implementación ${this.precio(plan.setup)} + ${this.precio(plan.mensual)} al mes). ` +
        '¿Podemos conversar?',
    );
  }
}
