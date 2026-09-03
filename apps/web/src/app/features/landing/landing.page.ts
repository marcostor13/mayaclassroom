import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { DemoRole, formatMoney } from '@maya/shared';
import type { DemoAccessDto } from '@maya/shared';
import { AuthService } from '../../core/services/auth.service';
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
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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

  /* ------------------------------ Demostración ---------------------------- */

  /*
   * «Ver la demostración» abre un selector en lugar de llevar a un sitio.
   *
   * Antes caía en el escaparate público, que es la parte menos interesante de
   * lo que se vende: quien llega desde una página que habla de aulas, notas y
   * avance aterrizaba en un catálogo de cursos y tenía que adivinar que además
   * podía entrar por dentro. Ahora se pregunta desde dónde quiere mirar, que
   * son los tres lados de la plataforma.
   */
  readonly demoAbierta = signal(false);

  /**
   * Qué papeles ofrece este despliegue.
   *
   * Se pregunta a la API y no se decide aquí porque el acceso lo abre el
   * despliegue: en la instalación de un cliente llega apagado, y entonces el
   * selector solo enseña el escaparate público, que sí es de todos.
   */
  readonly demo = signal<DemoAccessDto | null>(null);
  readonly entrandoComo = signal<DemoRole | null>(null);
  readonly Papel = DemoRole;

  /** El escaparate de la empresa de demostración. */
  readonly enlaceEscaparate = computed(() => `/p/${this.demo()?.tenantSlug ?? 'demo'}`);

  ofrece(papel: DemoRole): boolean {
    return this.demo()?.roles.includes(papel) ?? false;
  }

  abrirDemo(): void {
    this.demoAbierta.set(true);
    // Una sola vez: el selector se abre y se cierra varias veces por visita.
    if (this.demo()) return;
    this.auth.demoAccess().subscribe({
      next: (demo) => this.demo.set(demo.enabled ? demo : null),
      // Sin demostración disponible queda el escaparate, que no necesita sesión.
      error: () => this.demo.set(null),
    });
  }

  cerrarDemo(): void {
    // A medio entrar no se cierra: la sesión ya está en camino y cerrar el
    // panel dejaría la página quieta mientras por debajo cambia todo.
    if (this.entrandoComo()) return;
    this.demoAbierta.set(false);
  }

  /** Entra en la demostración con el papel elegido. Sin escribir credenciales. */
  entrarComo(papel: DemoRole): void {
    if (this.entrandoComo()) return;
    this.entrandoComo.set(papel);
    this.auth.demoLogin(papel).subscribe({
      next: (respuesta) => {
        this.entrandoComo.set(null);
        this.demoAbierta.set(false);
        void this.router.navigateByUrl(
          respuesta.user.mustChangePassword ? '/password-change' : '/dashboard',
        );
      },
      error: () => this.entrandoComo.set(null),
    });
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
