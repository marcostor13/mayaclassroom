import { CAP } from './capabilities';
import { GuideId } from '../types/guide';
import type { GuideDefinition } from '../types/guide';

/* -------------------------------------------------------------------------- */
/*  Guías interactivas — Maya Classroom                                        */
/*                                                                            */
/*  El catálogo vive en el contrato compartido y no en el cliente porque la    */
/*  API valida contra él qué pasos existen antes de darlos por cumplidos: un   */
/*  identificador inventado desde fuera no debe poder completar una guía.      */
/* -------------------------------------------------------------------------- */

export const GUIDES: readonly GuideDefinition[] = [
  {
    id: GuideId.PublishStorefront,
    title: 'Publica tu página de venta',
    description: 'De la plantilla en blanco a una página en Internet, en cinco pasos.',
    icon: 'globe',
    capabilities: [CAP.SITE_MANAGE],
    steps: [
      {
        id: 'abrir-editor',
        title: 'Abre el editor de la página',
        body:
          'Todo el diseño se hace sobre la página de verdad: lo que ve aquí es exactamente ' +
          'lo que verá quien la visite.',
        route: '/admin/storefront',
        target: 'editor-lienzo',
        actionLabel: 'Ya lo veo',
      },
      {
        id: 'elegir-plantilla',
        title: 'Elige el aspecto',
        body:
          'La plantilla decide la tipografía, el ritmo y cómo se comporta en móvil. ' +
          'Puede cambiarla cuando quiera sin perder el contenido.',
        route: '/admin/storefront',
        target: 'selector-plantilla',
        actionLabel: 'Siguiente',
      },
      {
        id: 'editar-portada',
        title: 'Escribe tu portada',
        body:
          'Pulse sobre cualquier bloque de la página para editarlo. Empiece por la portada: ' +
          'un titular claro y una frase que diga a quién va dirigido.',
        route: '/admin/storefront',
        target: 'seccion-hero',
        actionLabel: 'Hecho',
      },
      {
        id: 'anadir-seccion',
        title: 'Añade lo que falte',
        body:
          'Con «Añadir bloque» pone testimonios, preguntas frecuentes, cifras o un vídeo. ' +
          'Arriba y abajo se ordenan con las flechas de cada bloque.',
        route: '/admin/storefront',
        target: 'anadir-seccion',
        actionLabel: 'Siguiente',
      },
      {
        id: 'publicar',
        title: 'Publica y comparte',
        body:
          'Al publicar, la dirección queda accesible para cualquiera. Cópiela y compártala: ' +
          'es su escaparate.',
        route: '/admin/storefront',
        target: 'publicar',
        actionLabel: 'Terminar',
      },
    ],
  },
  {
    id: GuideId.CreateCourse,
    title: 'Crea y publica tu primer curso',
    description: 'Del curso vacío al curso a la venta, con su temario y su precio.',
    icon: 'book',
    capabilities: [CAP.COURSE_CREATE],
    steps: [
      {
        id: 'crear-curso',
        title: 'Crea el curso',
        body: 'Nombre, categoría y poco más: lo demás se puede cambiar después.',
        route: '/courses/new',
        target: 'form-curso',
        actionLabel: 'Siguiente',
      },
      {
        id: 'anadir-contenido',
        title: 'Pon contenido',
        body:
          'Cada tema admite páginas, vídeos, cuestionarios y tareas. Con una página de ' +
          'bienvenida y un vídeo ya hay curso.',
        route: '/courses',
        target: 'editor-curso',
        actionLabel: 'Siguiente',
      },
      {
        id: 'ficha-venta',
        title: 'Rellena la ficha de venta',
        body:
          'El gancho, lo que aprenderá el alumnado, la duración y el nivel. Es lo que ' +
          'decide la compra, más que el temario.',
        route: '/admin/storefront',
        target: 'pestana-cursos',
        actionLabel: 'Siguiente',
      },
      {
        id: 'poner-precio',
        title: 'Ponle precio',
        body: 'En la moneda que tenga configurada en Cobros. Un cero lo deja gratuito y la matrícula se hace al instante.',
        route: '/admin/storefront',
        target: 'precio-curso',
        actionLabel: 'Siguiente',
      },
      {
        id: 'publicar-curso',
        title: 'Sácalo al catálogo',
        body: 'Al marcarlo, aparece en su página pública con su propia ficha de venta.',
        route: '/admin/storefront',
        target: 'listar-curso',
        actionLabel: 'Terminar',
      },
    ],
  },
  {
    id: GuideId.StartSelling,
    title: 'Empieza a cobrar',
    description: 'Conecta Mercado Pago o PayPal y comprueba tu primera venta.',
    icon: 'credit-card',
    capabilities: [CAP.PAYMENT_MANAGE],
    steps: [
      {
        id: 'abrir-cobros',
        title: 'Abre los ajustes de cobro',
        body: 'Aquí se conectan las pasarelas. Los datos se piden una sola vez.',
        route: '/admin/payments',
        target: 'ajustes-cobro',
        actionLabel: 'Siguiente',
      },
      {
        id: 'conectar-pasarela',
        title: 'Conecta la pasarela',
        body:
          'Mercado Pago pide la clave pública y el token de acceso; PayPal, el identificador ' +
          'de cliente y su secreto. Los dos los da su panel de vendedor.',
        route: '/admin/payments',
        target: 'pasarelas',
        actionLabel: 'Siguiente',
      },
      {
        id: 'modo-prueba',
        title: 'Pruébalo en modo prueba',
        body:
          'Con el modo de prueba activo puede comprar su propio curso sin mover dinero y ' +
          'ver el pedido entrar.',
        route: '/admin/payments',
        target: 'modo-prueba',
        actionLabel: 'Siguiente',
      },
      {
        id: 'ver-pedidos',
        title: 'Mira tus pedidos',
        body:
          'Cada compra deja un pedido con su referencia. Al confirmarse el pago, la ' +
          'matrícula se hace sola y la persona recibe su acceso.',
        route: '/admin/storefront',
        target: 'lista-pedidos',
        actionLabel: 'Terminar',
      },
    ],
  },
];

export function findGuide(id: GuideId): GuideDefinition | undefined {
  return GUIDES.find((guide) => guide.id === id);
}
