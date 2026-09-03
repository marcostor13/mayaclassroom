/* -------------------------------------------------------------------------- */
/*  Contenido de la página de venta de la plataforma                           */
/*                                                                            */
/*  Vive aparte del componente porque es lo que más se va a retocar: precios,  */
/*  argumentos y preguntas cambian con cada conversación de venta, y no        */
/*  deberían obligar a leer la plantilla para encontrarlos.                    */
/*                                                                            */
/*  Los precios salen de comparar el mercado en septiembre de 2026:            */
/*  Hotmart cobra 9,9 % + 0,50 USD por venta; Teachable, de 29 a 309 USD al    */
/*  mes con 7,5 % en su plan de entrada; Thinkific, de 49 a 199; Kajabi, de    */
/*  89 a 399. Ninguna deja la plataforma en manos de quien vende. Un LMS       */
/*  corporativo en Perú se mueve entre 150 y 240 USD al mes.                   */
/* -------------------------------------------------------------------------- */

/** Número al que va todo botón de contacto. */
export const WHATSAPP = '51975760418';

/** Enlace de WhatsApp con el mensaje ya escrito, para que abrir sea responder. */
export function whatsapp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

export interface Plan {
  id: string;
  nombre: string;
  para: string;
  /** Implementación, pago único, en soles. */
  setup: number;
  /** Cuota mensual, en soles. */
  mensual: number;
  destacado?: boolean;
  incluye: string[];
}

export const PLANES: Plan[] = [
  {
    id: 'inicia',
    nombre: 'Inicia',
    para: 'Para tu primer curso a la venta',
    setup: 1490,
    mensual: 179,
    incluye: [
      'Hasta 300 alumnos activos',
      'Cursos y lecciones ilimitados',
      'Tu dominio propio con certificado',
      'Página de ventas diseñada contigo',
      'Una pasarela conectada y probada',
      'Certificados verificables',
      'Soporte por WhatsApp en horario de oficina',
    ],
  },
  {
    id: 'crece',
    nombre: 'Crece',
    para: 'Para academias que ya venden',
    setup: 2490,
    mensual: 349,
    destacado: true,
    incluye: [
      'Hasta 2 000 alumnos activos',
      'Todo lo del plan Inicia, y además:',
      'Mercado Pago, PayPal, transferencia y Yape',
      'Migramos hasta 5 cursos con su temario',
      'Insignias, competencias y rutas de aprendizaje',
      'Capacitación en vivo a tu equipo (2 h, grabada)',
      'Soporte prioritario y 30 días de acompañamiento',
    ],
  },
  {
    id: 'escala',
    nombre: 'Escala',
    para: 'Para varias sedes o marcas',
    setup: 4900,
    mensual: 749,
    incluye: [
      'Alumnado ilimitado',
      'Todo lo del plan Crece, y además:',
      'Varias empresas o sedes en una sola instalación',
      'Integraciones a medida con tus sistemas',
      'Informes y exportaciones a tu medida',
      'Acompañamiento mensual con tu equipo',
      'Acuerdo de nivel de servicio por contrato',
    ],
  },
];

/**
 * Lo que entra en la implementación, con su precio suelto.
 *
 * Se desglosa porque «implementación» no dice nada: la cifra se entiende
 * cuando se ve de qué está hecha.
 */
export const IMPLEMENTACION: { concepto: string; valor: number }[] = [
  { concepto: 'Instalación y configuración de la plataforma', valor: 900 },
  { concepto: 'Tu dominio conectado, con certificado de seguridad', valor: 250 },
  { concepto: 'Tu marca aplicada: logo, colores y tipografía', valor: 400 },
  { concepto: 'Página de ventas diseñada contigo', valor: 800 },
  { concepto: 'Pasarelas conectadas y probadas con una compra real', valor: 350 },
  { concepto: 'Carga de hasta 5 cursos con su temario y sus precios', valor: 900 },
  { concepto: 'Capacitación en vivo a tu equipo, grabada para consultarla', valor: 500 },
  { concepto: '30 días de acompañamiento tras la publicación', valor: 600 },
];

export interface FilaComparativa {
  plataforma: string;
  mensual: string;
  comision: string;
  /** Lo que se lleva al mes quien factura S/ 10 000. */
  costeReal: string;
  propia: boolean;
  nuestra?: boolean;
}

/**
 * Qué cuesta cada camino a quien vende S/ 10 000 al mes.
 *
 * El ejemplo se fija en esa cifra porque es donde la comisión deja de ser un
 * detalle: por debajo casi da igual, por encima se vuelve el gasto mayor.
 */
export const COMPARATIVA: FilaComparativa[] = [
  {
    plataforma: 'Hotmart',
    mensual: 'S/ 0',
    comision: '9,9 % + US$ 0,50 por venta',
    costeReal: '≈ S/ 990 al mes',
    propia: false,
  },
  {
    plataforma: 'Teachable (plan de entrada)',
    mensual: '≈ S/ 110',
    comision: '7,5 % por venta',
    costeReal: '≈ S/ 860 al mes',
    propia: false,
  },
  {
    plataforma: 'Thinkific',
    mensual: '≈ S/ 185 – 750',
    comision: '0 %',
    costeReal: '≈ S/ 185 – 750 al mes',
    propia: false,
  },
  {
    plataforma: 'Kajabi',
    mensual: '≈ S/ 335 – 1 500',
    comision: '0 %',
    costeReal: '≈ S/ 335 – 1 500 al mes',
    propia: false,
  },
  {
    plataforma: 'Maya Classroom',
    mensual: 'S/ 349',
    comision: '0 %',
    costeReal: 'S/ 349 al mes',
    propia: true,
    nuestra: true,
  },
];

export const DOLORES: { titulo: string; texto: string; icono: string }[] = [
  {
    titulo: 'Pagas peaje por vender lo tuyo',
    texto:
      'La comisión no se nota en la primera venta. Se nota al año, cuando sumas lo que se ' +
      'quedaron por hacer de intermediarios entre tu curso y tu alumno.',
    icono: 'alert',
  },
  {
    titulo: 'La marca que construyes no es tuya',
    texto:
      'Tu página lleva el logo de otro, tu dirección es una subcarpeta suya y tu alumno ' +
      'recuerda la plataforma, no tu academia.',
    icono: 'globe',
  },
  {
    titulo: 'No tienes la lista de tus alumnos',
    texto:
      'Los correos de quienes te compraron viven en un sistema al que no entras. El día que ' +
      'quieras irte, empiezas de cero.',
    icono: 'users',
  },
  {
    titulo: 'Las reglas cambian sin avisarte',
    texto:
      'Suben la comisión, cambian el reproductor o cierran una función. Tú te enteras cuando ' +
      'ya está hecho, y tu negocio depende de eso.',
    icono: 'refresh',
  },
];

export const PASOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Hablamos 30 minutos',
    texto:
      'Nos cuentas qué vendes y a quién. Salimos de esa llamada con el alcance y el precio ' +
      'cerrados, o te decimos que no somos lo que necesitas.',
  },
  {
    titulo: 'Montamos tu academia',
    texto:
      'Instalamos, conectamos tu dominio, aplicamos tu marca, cargamos tus cursos y dejamos ' +
      'las pasarelas probadas con una compra real.',
  },
  {
    titulo: 'Capacitamos a tu equipo',
    texto:
      'Dos horas en vivo, grabadas, para que publiques un curso de principio a fin sin ' +
      'llamarnos. La plataforma trae además guías paso a paso dentro.',
  },
  {
    titulo: 'Publicas y vendes',
    texto:
      'A los siete días hábiles tu academia está en internet cobrando en soles. Y nos quedamos ' +
      '30 días encima por si algo se mueve.',
  },
];

export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: '¿Por qué pago una implementación si otras plataformas son solo mensualidad?',
    respuesta:
      'Porque en las otras te dan un usuario y te las arreglas. Aquí montamos tu academia, ' +
      'conectamos tu dominio, aplicamos tu marca, cargamos tus cursos y dejamos el cobro ' +
      'probado con una compra real. La implementación es trabajo nuestro, una sola vez; ' +
      'la mensualidad es la plataforma funcionando.',
  },
  {
    pregunta: '¿Cuánto tarda de verdad?',
    respuesta:
      'Siete días hábiles desde que nos entregas el contenido y los accesos. Si nos retrasamos ' +
      'nosotros, te devolvemos la implementación completa.',
  },
  {
    pregunta: '¿Se queda alguien con un porcentaje de mis ventas?',
    respuesta:
      'Nadie. El cobro va de tu comprador a tu cuenta de Mercado Pago, PayPal o tu banco. ' +
      'Nosotros no tocamos ese dinero ni vemos los datos de la tarjeta: eso ocurre dentro de ' +
      'la pasarela. Solo pagas la mensualidad de la plataforma.',
  },
  {
    pregunta: '¿Puedo cobrar en soles y emitir comprobante?',
    respuesta:
      'Sí. Los precios van en soles, y las pasarelas peruanas funcionan tal cual. El ' +
      'comprobante lo emites tú desde tu sistema de facturación con los datos del pedido, ' +
      'que la plataforma te muestra y exporta.',
  },
  {
    pregunta: '¿Y si ya tengo cursos en otra plataforma?',
    respuesta:
      'Los migramos. En el plan Crece entran hasta cinco cursos con su temario, sus vídeos y ' +
      'sus precios. Si son más, lo cotizamos aparte y sin sorpresas.',
  },
  {
    pregunta: '¿Qué pasa si dejo de pagar la mensualidad?',
    respuesta:
      'Tu contenido y tus datos son tuyos: te los entregamos exportados. La plataforma deja de ' +
      'estar publicada, pero no te quedas sin lo que construiste.',
  },
  {
    pregunta: '¿Puedo verla antes de decidir?',
    respuesta:
      'Es lo que te pedimos que hagas. Arriba tienes una demostración completa, con una ' +
      'escuela de pastelería de verdad: entra, mira el catálogo, abre un curso, y entra ' +
      'también como administrador y como alumno. Sin registrarte y sin dejar datos.',
  },
];
