import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@maya/shared';
import { IconComponent, LogoComponent } from '../../shared';
import {
  AULA_ALUMNO,
  AULA_DOCENTE,
  COMPARATIVA,
  DOLORES,
  IMPLEMENTACION,
  IMPLEMENTACION_DESDE,
  PASOS,
  PLANES,
  PREGUNTAS,
  VIVO,
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
  readonly implementacionDesde = IMPLEMENTACION_DESDE;
  readonly comparativa = COMPARATIVA;
  readonly dolores = DOLORES;
  readonly aulaAlumno = AULA_ALUMNO;
  readonly aulaDocente = AULA_DOCENTE;
  readonly vivo = VIVO;
  readonly pasos = PASOS;
  readonly preguntas = PREGUNTAS;

  /** La pregunta abierta. Solo una: una lista toda desplegada no se lee. */
  readonly abierta = signal<number | null>(0);

  /** Lo que costaría suelto todo lo que entra en la implementación. */
  readonly valorImplementacion = computed(() =>
    this.implementacion.reduce((suma, linea) => suma + linea.valor, 0),
  );

  constructor() {
    this.title.setTitle('Tu propia aula virtual · Maya Classroom');
    this.meta.updateTag({
      name: 'description',
      content:
        'Aula virtual propia para tu academia: cursos, clases en vivo, tareas, notas, avance y ' +
        'certificados, con tu marca y tu dominio. Y si vendes, cobras en soles sin comisión. ' +
        'Funcionando en 7 días.',
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
    'Hola, vi la página de Maya Classroom y quiero mi propia aula virtual. ¿Lo vemos?',
  );

  readonly telefono = WHATSAPP;

  /** Cada plan escribe su propio mensaje: la conversación empieza ya situada. */
  whatsappPlan(plan: Plan): string {
    const detalle =
      plan.setup === null || plan.mensual === null
        ? 'y necesito que lo coticen para mi caso'
        : `(implementación ${this.precio(plan.setup)} + ${this.precio(plan.mensual)} al mes)`;

    return whatsapp(
      `Hola, me interesa el plan ${plan.nombre} de Maya Classroom ${detalle}. ¿Podemos conversar?`,
    );
  }
}
