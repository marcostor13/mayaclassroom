/**
 * Guías interactivas.
 *
 * Son recorridos paso a paso que se superponen a la interfaz real en lugar de
 * un vídeo o una página de ayuda: se aprende haciendo, sobre los datos propios,
 * y cada paso se marca solo cuando la acción está de verdad hecha.
 *
 * El catálogo de guías vive aquí, en el contrato compartido, porque la API
 * necesita saber qué pasos existen para poder darlos por cumplidos, y el
 * cliente necesita saber a qué elemento de la pantalla apunta cada uno.
 */

export enum GuideId {
  /** Publicar la primera página de venta. Es la guía de la demo pública. */
  PublishStorefront = 'publicar-pagina',
  /** Crear un curso, ponerle contenido y publicarlo a la venta. */
  CreateCourse = 'crear-curso',
  /** Cobrar: configurar la pasarela y comprobar la primera venta. */
  StartSelling = 'empezar-a-vender',
}

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  /** Ruta de la aplicación donde ocurre el paso. */
  route?: string | null;
  /**
   * Selector del elemento al que apunta el foco. Es un atributo propio
   * (`data-guia="…"`) y no una clase ni un identificador de CSS: así el
   * recorrido no se rompe al cambiar estilos o al renombrar un contenedor.
   */
  target?: string | null;
  /** Texto del botón que avanza. */
  actionLabel?: string | null;
}

export interface GuideDefinition {
  id: GuideId;
  title: string;
  description: string;
  icon: string;
  steps: GuideStep[];
  /** Capacidades necesarias para que la guía tenga sentido; vacío es para todos. */
  capabilities?: string[];
}

export interface GuideProgressDto {
  guideId: GuideId;
  completedStepIds: string[];
  /** Índice del paso en el que se quedó. */
  currentStep: number;
  dismissed: boolean;
  completedAt?: string | null;
  updatedAt: string;
}
