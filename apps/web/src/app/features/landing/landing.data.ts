/* -------------------------------------------------------------------------- */
/*  Contenido de la página de venta de la plataforma                           */
/*                                                                            */
/*  Vive aparte del componente porque es lo que más se va a retocar: precios,  */
/*  argumentos y preguntas cambian con cada conversación de venta, y no        */
/*  deberían obligar a leer la plantilla para encontrarlos.                    */
/*                                                                            */
/*  El eje de la página es el AULA VIRTUAL, no la venta.                      */
/*                                                                            */
/*  Antes se dirigía solo a quien vende cursos en un marketplace y paga        */
/*  comisión, y eso dejaba fuera a la mayor parte del mercado peruano:         */
/*  academias, institutos, centros de capacitación y equipos de formación que  */
/*  ya dan clase —por Zoom, por WhatsApp, con el material en Drive— y lo que   */
/*  necesitan no es dejar de pagar comisión, sino un sitio donde sus alumnos   */
/*  aprendan y quede constancia de que aprendieron. Vender es una capacidad    */
/*  más de la plataforma, y para quien la necesita sigue siendo un argumento   */
/*  fuerte; pero es el segundo, no el primero.                                 */
/*                                                                            */
/*  Los precios salen de comparar el mercado en septiembre de 2026:            */
/*  Hotmart cobra 9,9 % + 0,50 USD por venta; Teachable, de 29 a 309 USD al    */
/*  mes con 7,5 % en su plan de entrada; Thinkific, de 49 a 199; Kajabi, de    */
/*  89 a 399. Ninguna deja la plataforma en manos de quien vende. Un LMS       */
/*  corporativo en Perú se mueve entre 150 y 240 USD al mes.                   */
/*                                                                            */
/*  Frente a eso, la estrategia es entrar por debajo de todos: una             */
/*  implementación de S/ 347 y una mensualidad de S/ 47 o S/ 99. El plan de    */
/*  varias sedes no lleva precio de lista porque su alcance nunca es el mismo  */
/*  dos veces: va a cotización.                                               */
/* -------------------------------------------------------------------------- */

/** Número al que va todo botón de contacto. */
export const WHATSAPP = '51975760418';

/** Enlace de WhatsApp con el mensaje ya escrito, para que abrir sea responder. */
export function whatsapp(mensaje: string): string {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
}

/* ------------------------------- Los planes ------------------------------- */

export interface Plan {
  id: string;
  nombre: string;
  para: string;
  /** Implementación, pago único, en soles. `null` cuando va a cotización. */
  setup: number | null;
  /** Cuota mensual, en soles. `null` cuando va a cotización. */
  mensual: number | null;
  destacado?: boolean;
  incluye: string[];
}

/**
 * Lo que se paga una vez por dejar el aula montada.
 *
 * Es el mismo número en los dos planes con precio de lista: el trabajo de
 * montarla no cambia por tener más alumnos, y un solo importe se recuerda
 * mejor que dos. Se saca a una constante porque la página lo enseña en dos
 * sitios —el desglose de la implementación y las tarjetas de plan— y tienen
 * que decir lo mismo.
 */
export const IMPLEMENTACION_DESDE = 347;

export const PLANES: Plan[] = [
  {
    id: 'inicia',
    nombre: 'Inicia',
    para: 'Para tu primera aula virtual',
    setup: IMPLEMENTACION_DESDE,
    mensual: 47,
    incluye: [
      'Hasta 300 alumnos activos',
      'Cursos, lecciones y materiales ilimitados',
      'Tareas, cuestionarios y foros',
      'Avance y notas de cada alumno',
      'Certificados verificables con tu marca',
      'Tu dominio propio con certificado',
      'Soporte por WhatsApp en horario de oficina',
    ],
  },
  {
    id: 'crece',
    nombre: 'Crece',
    para: 'Para academias con varios docentes',
    setup: IMPLEMENTACION_DESDE,
    mensual: 99,
    destacado: true,
    incluye: [
      'Hasta 2 000 alumnos activos',
      'Todo lo del plan Inicia, y además:',
      'Clases en vivo con Zoom y Meet (en camino)',
      'Grupos, cohortes y matrícula por lotes',
      'Venta y cobro: Mercado Pago, PayPal, transferencia y Yape',
      'Insignias, competencias y rutas de aprendizaje',
      'Capacitación en vivo a tu equipo (2 h, grabada)',
      'Soporte prioritario y 30 días de acompañamiento',
    ],
  },
  {
    id: 'escala',
    nombre: 'Escala',
    para: 'Para varias sedes o marcas',
    setup: null,
    mensual: null,
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

/* ---------------------------- El problema real ---------------------------- */

export const DOLORES: { titulo: string; texto: string; icono: string }[] = [
  {
    titulo: 'Tu clase vive en cinco sitios a la vez',
    texto:
      'El enlace de la reunión por WhatsApp, el material en Drive, las notas en una hoja de ' +
      'cálculo y la grabación en un correo. Tu alumno pierde media hora buscando antes de ' +
      'empezar a aprender.',
    icono: 'layers',
  },
  {
    titulo: 'No sabes quién está aprendiendo',
    texto:
      'Sabes quién se conectó a la clase. No sabes quién vio la grabación, quién hizo la ' +
      'práctica ni quién lleva tres semanas atascado en la misma lección.',
    icono: 'users',
  },
  {
    titulo: 'Al terminar no queda constancia',
    texto:
      'Ni una nota, ni un registro de avance, ni un certificado que tu alumno pueda enseñar y ' +
      'que alguien pueda verificar. Lo que enseñaste no deja rastro.',
    icono: 'award',
  },
  {
    titulo: 'La marca que recuerdan no es la tuya',
    texto:
      'Tu alumno recuerda las herramientas por las que pasó, no tu academia. Y si además ' +
      'vendes en un marketplace, pagas comisión por vender lo tuyo en casa ajena.',
    icono: 'globe',
  },
];

/* ------------------------------ El aula, dentro --------------------------- */

export interface BloqueAula {
  titulo: string;
  texto: string;
  icono: string;
}

/**
 * Qué se encuentra el alumno cuando entra.
 *
 * Va primero, y en su propia columna, porque es lo que decide la compra: quien
 * contrata un aula virtual no la usa, la usan sus alumnos, y lo que teme es
 * que le den algo que ellos no vayan a abrir.
 */
export const AULA_ALUMNO: BloqueAula[] = [
  {
    titulo: 'Un solo sitio para todo',
    texto:
      'Entra con su usuario y ahí está su curso entero: el temario, los vídeos, los ' +
      'materiales, la clase en vivo y lo que tiene que entregar.',
    icono: 'book-open',
  },
  {
    titulo: 'Sabe siempre por dónde va',
    texto:
      'Cada lección se marca al completarla y su avance se ve en una barra. Vuelve tres días ' +
      'después y retoma donde lo dejó, sin buscar.',
    icono: 'route',
  },
  {
    titulo: 'Sus notas y la devolución del profesor',
    texto:
      'Entrega la tarea, hace el cuestionario y ve su calificación con el comentario de quien ' +
      'la corrigió. No hay que pedirla por WhatsApp.',
    icono: 'clipboard-check',
  },
  {
    titulo: 'Su certificado al terminar',
    texto:
      'Con tu marca y un código que cualquiera puede verificar. Le sirve para enseñarlo en ' +
      'una entrevista, que es la mitad de por qué se matriculó.',
    icono: 'award',
  },
  {
    titulo: 'Foro y mensajes para no atascarse',
    texto:
      'Pregunta dentro del curso, donde la respuesta le sirve también al resto, en lugar de ' +
      'en un grupo donde se pierde entre memes.',
    icono: 'messages-square',
  },
  {
    titulo: 'Su calendario, con lo que viene',
    texto:
      'Las clases en vivo y las fechas de entrega, en un solo sitio y con aviso. Se acabó el ' +
      '«no me enteré».',
    icono: 'calendar',
  },
];

/** Qué te llevas tú y tu equipo docente. */
export const AULA_DOCENTE: BloqueAula[] = [
  {
    titulo: 'Armas el curso sin saber programar',
    texto:
      'Temas, lecciones, vídeos, ficheros y actividades, arrastrando. Duplicas un curso que ya ' +
      'funciona y cambias lo que haga falta.',
    icono: 'layers',
  },
  {
    titulo: 'Evalúas de verdad',
    texto:
      'Tareas con entrega y corrección, cuestionarios con banco de preguntas reutilizable, ' +
      'foros calificables, consultas y encuestas.',
    icono: 'clipboard-list',
  },
  {
    titulo: 'El libro de calificaciones, solo',
    texto:
      'Todo lo que se califica cae en un único libro por curso, con su peso y su nota final. ' +
      'Exportable el día que te lo pidan.',
    icono: 'chart',
  },
  {
    titulo: 'Grupos, cohortes y matrículas',
    texto:
      'Divides por aula o por turno, matriculas por lotes y das a cada persona exactamente los ' +
      'permisos que le tocan.',
    icono: 'users-round',
  },
  {
    titulo: 'Ves quién se está quedando atrás',
    texto:
      'Avance por alumno y por curso, entregas pendientes y actividad. A tiempo de escribirle, ' +
      'no cuando ya abandonó.',
    icono: 'trending-up',
  },
  {
    titulo: 'Insignias, competencias y rutas',
    texto:
      'Reconoces lo que se va logrando y encadenas cursos en itinerarios, que es lo que ' +
      'convierte un curso suelto en un programa.',
    icono: 'target',
  },
];

/* ----------------------------- Clases en vivo ----------------------------- */

/**
 * Zoom y Google Meet dentro del curso.
 *
 * Se anuncia en la página **antes** de estar construido, y por eso lleva su
 * etiqueta de «en camino» bien visible y un texto que separa lo que ya se
 * puede hacer de lo que llegará. Prometer como presente algo que no existe se
 * descubre en la primera demostración y cuesta la venta entera; anunciarlo
 * como lo que es no cuesta nada y además ordena la expectativa.
 */
export const VIVO = {
  etiqueta: 'En camino',
  titulo: 'Tus clases en vivo, dentro del curso',
  entrada:
    'Estamos integrando Zoom y Google Meet con el aula. La sesión se programa desde el curso, ' +
    'aparece en el calendario del alumno con su aviso, y cuando termina la grabación queda ' +
    'guardada en la lección que le corresponde.',
  hoy: 'Hoy ya puedes programar tus sesiones en el calendario del curso y enlazarlas desde la lección.',
  puntos: [
    'La clase se crea desde el curso, no desde otra aplicación',
    'El alumno entra desde su aula, con un botón',
    'Queda en su calendario y le llega el aviso',
    'La grabación se guarda dentro de la lección',
    'La asistencia se registra sola',
  ],
};

/* ------------------------------ Los tres caminos -------------------------- */

export interface FilaComparativa {
  /** Qué se compara. */
  concepto: string;
  /** Zoom, Drive, WhatsApp y una hoja de cálculo. */
  suelto: string;
  /** Hotmart, Teachable y compañía. */
  marketplace: string;
  /** Maya Classroom. */
  maya: string;
}

/**
 * Los tres caminos, comparados por lo que le importa a una academia.
 *
 * Sustituye a la tabla anterior, que solo comparaba precios y comisiones
 * contra los marketplaces. Esa comparación dejaba fuera al que no vende y no
 * decía nada de lo que de verdad se compra aquí, que es el aula. La comisión
 * sigue estando —es la última fila y la nota de abajo—, pero como una
 * consecuencia más y no como el argumento entero.
 */
export const COMPARATIVA: FilaComparativa[] = [
  {
    concepto: 'Dónde entra tu alumno',
    suelto: 'Un enlace distinto cada vez',
    marketplace: 'La web de ellos, con su marca',
    maya: 'Tu aula, en tu dominio',
  },
  {
    concepto: 'Material y grabaciones',
    suelto: 'Carpetas de Drive y correos',
    marketplace: 'Dentro, pero es suyo',
    maya: 'Dentro de cada lección',
  },
  {
    concepto: 'Avance de cada alumno',
    suelto: 'Nadie lo sabe',
    marketplace: 'Solo si te lo enseñan',
    maya: 'Al día, alumno por alumno',
  },
  {
    concepto: 'Notas y evaluaciones',
    suelto: 'Una hoja de cálculo',
    marketplace: 'Poco o nada',
    maya: 'Tareas, cuestionarios y libro de notas',
  },
  {
    concepto: 'Certificados',
    suelto: 'A mano, uno a uno',
    marketplace: 'Con la marca de ellos',
    maya: 'Verificables y con tu marca',
  },
  {
    concepto: 'Clases en vivo',
    suelto: 'Zoom por su cuenta',
    marketplace: 'Fuera de la plataforma',
    maya: 'Zoom y Meet en el curso (en camino)',
  },
  {
    concepto: 'Quién cobra',
    suelto: 'Tú, por fuera y a mano',
    marketplace: 'Ellos, y luego te liquidan',
    maya: 'Tú, directo a tu cuenta',
  },
  {
    concepto: 'Comisión por venta',
    suelto: '—',
    marketplace: '7,5 % – 9,9 %',
    maya: '0 %',
  },
];

/* --------------------------- La implementación ---------------------------- */

/**
 * Lo que entra en la implementación, con su precio suelto.
 *
 * Se desglosa porque «implementación» no dice nada: la cifra se entiende
 * cuando se ve de qué está hecha.
 */
export const IMPLEMENTACION: { concepto: string; valor: number }[] = [
  { concepto: 'Instalación y configuración de tu aula virtual', valor: 900 },
  { concepto: 'Tu dominio conectado, con certificado de seguridad', valor: 250 },
  { concepto: 'Tu marca aplicada: logo, colores y tipografía', valor: 400 },
  { concepto: 'Estructura de cursos, categorías y roles de tu equipo', valor: 600 },
  { concepto: 'Carga de hasta 5 cursos con su temario y sus materiales', valor: 900 },
  { concepto: 'Página pública y cobros probados con una compra real', valor: 550 },
  { concepto: 'Capacitación en vivo a tu equipo, grabada para consultarla', valor: 500 },
  { concepto: '30 días de acompañamiento tras la publicación', valor: 600 },
];

/* ------------------------------- Cómo va ---------------------------------- */

export const PASOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Hablamos 30 minutos',
    texto:
      'Nos cuentas qué enseñas y a quién. Salimos de esa llamada con el alcance y el precio ' +
      'cerrados, o te decimos que no somos lo que necesitas.',
  },
  {
    titulo: 'Montamos tu aula',
    texto:
      'Instalamos, conectamos tu dominio, aplicamos tu marca, creamos tus cursos y tus roles, y ' +
      'dejamos cargado el contenido que nos pases.',
  },
  {
    titulo: 'Capacitamos a tu equipo',
    texto:
      'Dos horas en vivo, grabadas, para que publiques un curso y corrijas una entrega de ' +
      'principio a fin sin llamarnos. La plataforma trae además guías paso a paso dentro.',
  },
  {
    titulo: 'Tus alumnos entran',
    texto:
      'A los siete días hábiles tu aula está en internet con tus alumnos dentro. Y nos quedamos ' +
      '30 días encima por si algo se mueve.',
  },
];

/* ------------------------------ Preguntas --------------------------------- */

export const PREGUNTAS: { pregunta: string; respuesta: string }[] = [
  {
    pregunta: '¿Sirve si no vendo cursos, solo capacito a mi equipo o a mis alumnos?',
    respuesta:
      'Es justo para eso. El aula es lo principal: cursos, actividades, notas, avance y ' +
      'certificados. La parte de venta —catálogo público y cobros— se enciende solo si la ' +
      'necesitas, y si no, tu plataforma es privada y se entra por invitación.',
  },
  {
    pregunta: '¿Reemplaza a Zoom o a Google Meet?',
    respuesta:
      'No, y no queremos. Tus clases en vivo las sigues dando en Zoom o en Meet; lo que ' +
      'hacemos es meterlas dentro del curso, para que el alumno entre desde su aula, le quede ' +
      'en el calendario y la grabación se guarde en la lección. Esa integración está en ' +
      'construcción ahora mismo: hoy ya puedes programar las sesiones en el calendario del ' +
      'curso y enlazarlas desde la lección.',
  },
  {
    pregunta: '¿En qué se diferencia esto de Google Classroom, que es gratis?',
    respuesta:
      'Classroom reparte tareas; no es una academia. No tiene tu marca ni tu dominio, no vende, ' +
      'no emite certificados verificables, no tiene libro de calificaciones con pesos ni ' +
      'itinerarios ni competencias, y tus alumnos necesitan cuenta de Google. Si con repartir ' +
      'tareas te basta, quédate con Classroom y te lo decimos de frente.',
  },
  {
    pregunta: '¿Por qué pago una implementación si otras plataformas son solo mensualidad?',
    respuesta:
      'Porque en las otras te dan un usuario y te las arreglas. Aquí montamos tu aula, ' +
      'conectamos tu dominio, aplicamos tu marca, creamos tus cursos y tus roles y capacitamos ' +
      'a tu equipo. La implementación es trabajo nuestro, una sola vez; la mensualidad es la ' +
      'plataforma funcionando.',
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
    pregunta: '¿Y si ya tengo mis cursos en otra plataforma o en Drive?',
    respuesta:
      'Los migramos. En el plan Crece entran hasta cinco cursos con su temario, sus vídeos y ' +
      'sus materiales. Si son más, lo cotizamos aparte y sin sorpresas.',
  },
  {
    pregunta: '¿Qué pasa si dejo de pagar la mensualidad?',
    respuesta:
      'Tu contenido y tus datos son tuyos: te los entregamos exportados, incluidas las notas y ' +
      'el avance de tus alumnos. La plataforma deja de estar publicada, pero no te quedas sin ' +
      'lo que construiste.',
  },
  {
    pregunta: '¿Puedo verla antes de decidir?',
    respuesta:
      'Es lo que te pedimos que hagas. Arriba tienes una demostración completa, con una ' +
      'escuela de pastelería de verdad: entra como alumna y mira su aula por dentro, y entra ' +
      'después como administrador. Sin registrarte y sin dejar datos.',
  },
];
