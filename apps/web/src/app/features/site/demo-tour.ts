import type { GuideStep } from '@maya/shared';

/**
 * Recorrido de la demostración pública.
 *
 * Vive aquí y no en `@maya/shared` porque no es una guía de la plataforma: no
 * hay sesión, no hay progreso que guardar en el servidor y sus pasos apuntan a
 * los bloques de una página de escaparate, no a pantallas de la aplicación.
 *
 * Enseña la página desde el lado de quien la visita —esto es una portada, esto
 * un catálogo, así se compra— y termina invitando a crear la suya, que es la
 * pregunta que deja una demostración bien hecha.
 */
export const DEMO_TOUR: GuideStep[] = [
  {
    id: 'bienvenida',
    title: 'Esto es una página de venta de cursos',
    body:
      'Todo lo que ve aquí lo ha compuesto una empresa desde el editor, bloque a bloque y sin ' +
      'tocar código. Le enseñamos las piezas en un minuto.',
    target: null,
    actionLabel: 'Enséñeme',
  },
  {
    id: 'portada',
    title: 'La portada',
    body:
      'Titular, frase y botón. Es lo primero que decide si alguien sigue leyendo, así que se ' +
      'edita pulsando encima y se ve el cambio al momento.',
    target: 'seccion-hero',
  },
  {
    id: 'ventajas',
    title: 'Los argumentos',
    body:
      'Bloques de ventajas, cifras, testimonios o preguntas frecuentes. Se añaden, se ordenan y ' +
      'se ocultan uno a uno.',
    target: 'seccion-features',
  },
  {
    id: 'catalogo',
    title: 'El catálogo',
    body:
      'Los cursos a la venta, con su precio. Pulse cualquiera para ver su ficha: temario, ' +
      'profesorado y botón de compra.',
    target: 'seccion-courses',
  },
  {
    id: 'compra',
    title: 'La compra',
    body:
      'Al comprar, la persona paga con Mercado Pago o PayPal, recibe su acceso por correo y ' +
      'entra directamente al aula. Sin intervención de nadie.',
    target: 'seccion-courses',
  },
  {
    id: 'crear',
    title: 'Su página, en una tarde',
    body:
      'Cree una cuenta y le acompañamos paso a paso: diseñar la página, crear el primer curso y ' +
      'conectar el cobro.',
    target: 'barra-acciones',
    actionLabel: 'Terminar',
  },
];

/** Clave con la que se recuerda que ya se ha visto, en este navegador. */
export const DEMO_TOUR_KEY = 'maya.demo-tour.visto';
