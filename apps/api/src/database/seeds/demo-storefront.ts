import { Logger } from '@nestjs/common';
import type { Model, Types } from 'mongoose';
import {
  CourseFormat,
  ModuleType,
  OrderStatus,
  PaymentProvider,
} from '@maya/shared';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import type { CoursesService } from '../../modules/courses/courses.service';
import type { CategoriesService } from '../../modules/categories/categories.service';
import type { EnrolmentsService } from '../../modules/enrolments/enrolments.service';
import type { GradesService } from '../../modules/grades/grades.service';
import type { SiteService } from '../../modules/site/site.service';
import type { PaymentsService } from '../../modules/commerce/payments.service';
import type { OrderDocument } from '../../modules/commerce/schemas/order.schema';
import { VIDEOS, leccion, miniatura, paginaCurso, paginaDemo, youtube } from './demo-content';

const logger = new Logger('Seed·Escaparate');

export interface EntornoDemo {
  tenantId: Types.ObjectId;
  tenantName: string;
  teacherId: Types.ObjectId;
  studentIds: Types.ObjectId[];
  courses: CoursesService;
  categories: CategoriesService;
  enrolments: EnrolmentsService;
  grades: GradesService;
  site: SiteService;
  payments: PaymentsService;
  orderModel: Model<OrderDocument>;
  courseModel: Model<CourseDocument>;
  angularCourseId: Types.ObjectId;
  nestCourseId: Types.ObjectId;
}

/**
 * Convierte la empresa de demostración en una academia que vende de verdad:
 * catálogo con precios, fichas de venta diseñadas, escaparate publicado,
 * cobro configurado y pedidos ya recibidos.
 *
 * Todo es idempotente: la siembra se ejecuta muchas veces sobre la misma base
 * y no debe duplicar cursos, pedidos ni secciones.
 */
export async function seedStorefront(env: EntornoDemo): Promise<void> {
  const iaCourse = await asegurarCursoIA(env);

  logger.log('Catálogo de venta');
  await ponerALaVenta(env, iaCourse);

  logger.log('Escaparate publicado');
  await publicarEscaparate(env);

  logger.log('Cobros y pedidos');
  await configurarCobros(env);
  await sembrarPedidos(env, iaCourse);
}

/* ---------------------------- Curso de IA --------------------------------- */

/**
 * El tercer curso de la demostración: gratuito, para que la compra se pueda
 * probar de punta a punta sin pasarela ni tarjeta.
 */
async function asegurarCursoIA(env: EntornoDemo): Promise<CourseDocument> {
  const existente = await env.courseModel
    .findOne({ tenant: env.tenantId, shortName: 'IA-101', deletedAt: null })
    .exec();
  if (existente) return existente;

  const categorias = await env.categories.list(env.tenantId, { includeHidden: true });
  const raiz = categorias.find((c) => c.name === 'Formación profesional') ?? categorias[0];
  const categoria =
    categorias.find((c) => c.name === 'Inteligencia artificial') ??
    (await env.categories.create(env.tenantId, {
      name: 'Inteligencia artificial',
      parentId: raiz?.id,
      description: 'Formación aplicada en IA para equipos no técnicos.',
    }));

  const curso = await env.courses.create(
    env.tenantId,
    {
      shortName: 'IA-101',
      fullName: 'Inteligencia Artificial Aplicada: de curioso a productivo en 5 horas',
      summary:
        '<p>Cuatro módulos prácticos para delegar en la IA una tarea real de su trabajo, ' +
        'verificar lo que produce y saber qué datos no debe pegar nunca en un chat.</p>',
      categoryId: categoria.id,
      format: CourseFormat.Topics,
      numSections: 4,
      enableCompletion: true,
    },
    env.teacherId,
  );
  await env.grades.provisionCourse(curso._id);
  await env.enrolments.provisionDefaults(curso._id);
  await env.enrolments.enrol({
    courseId: curso._id,
    tenantId: env.tenantId,
    userId: env.teacherId,
    roleShortName: 'editingteacher',
  });

  await contenidoCursoIA(env, curso);
  return curso;
}

/** Los cuatro módulos del curso, cada uno con su lección en vídeo. */
async function contenidoCursoIA(env: EntornoDemo, curso: CourseDocument): Promise<void> {
  const secciones = await env.courses.sections(curso._id);
  const temas = [
    {
      nombre: 'Módulo 1 · Entender la IA de verdad',
      resumen:
        '<p>Qué hace un modelo de lenguaje, dónde rinde y dónde falla, y cómo reconocer una ' +
        'alucinación antes de que cueste un cliente.</p>',
      leccion: {
        prefijo: 'ia1',
        intro:
          '<h2>Qué es esto en una frase</h2><p>Un modelo de lenguaje predice el siguiente ' +
          'fragmento de texto más probable. Ni busca, ni razona como una persona, ni sabe ' +
          'lo que no le ha llegado. Entender eso predice casi todos sus aciertos y sus fallos.</p>',
        youtubeId: VIDEOS.cosmosLaundromat,
        desarrollo:
          '<h3>Los cuatro terrenos</h3><ul><li><strong>Rinde alto:</strong> reescribir, ' +
          'resumir, clasificar y generar borradores.</li><li><strong>Rinde mal:</strong> datos ' +
          'exactos, cálculos, hechos recientes y todo lo que exija responsabilidad legal.</li></ul>' +
          '<p>La regla práctica: úsela donde usted sepa corregirla.</p>',
        avisoTitulo: 'Ejercicio del módulo',
        avisoTexto:
          'Elija una tarea de su semana y clasifíquela en uno de los cuatro terrenos. La usará ' +
          'en el resto del curso.',
      },
    },
    {
      nombre: 'Módulo 2 · Hablarle bien a la IA',
      resumen:
        '<p>Por qué a otras personas les da mejores resultados: contexto, formato de salida y ' +
        'ejemplos.</p>',
      leccion: {
        prefijo: 'ia2',
        intro:
          '<h2>La diferencia no está en la herramienta</h2><p>Está en cuánto contexto recibe. ' +
          'Una petición sin contexto obliga al modelo a inventarse el que le falta.</p>',
        youtubeId: VIDEOS.bigBuckBunny,
        desarrollo:
          '<h3>Los cuatro ingredientes</h3><ol><li><strong>Papel:</strong> desde qué punto de ' +
          'vista escribe.</li><li><strong>Contexto:</strong> a quién va dirigido y con qué fin.' +
          '</li><li><strong>Formato:</strong> qué forma exacta debe tener la respuesta.</li>' +
          '<li><strong>Ejemplo:</strong> uno bueno vale más que tres párrafos de instrucciones.' +
          '</li></ol>',
        avisoTitulo: 'Entregable',
        avisoTexto:
          'Reescriba su peor petición de la semana con los cuatro ingredientes y compare las dos ' +
          'respuestas.',
      },
    },
    {
      nombre: 'Módulo 3 · De asistente a agente',
      resumen:
        '<p>Dejar de copiar y pegar: encadenar pasos, conectar sus documentos y automatizar lo ' +
        'que se repite.</p>',
      leccion: {
        prefijo: 'ia3',
        intro:
          '<h2>El salto</h2><p>Un asistente responde; un agente hace. La diferencia está en ' +
          'darle herramientas y un criterio de parada.</p>',
        youtubeId: VIDEOS.sintel,
        desarrollo:
          '<h3>Qué automatizar primero</h3><p>Lo que hace todas las semanas, sigue siempre los ' +
          'mismos pasos y tiene un resultado que usted sabe revisar de un vistazo. Nada más, de ' +
          'momento.</p>',
        avisoTitulo: 'Cuidado',
        avisoTexto:
          'Automatizar algo que no sabe revisar no ahorra trabajo: lo traslada al momento en que ' +
          'sale mal.',
      },
    },
    {
      nombre: 'Módulo 4 · Implantarla sin romper nada',
      resumen:
        '<p>Datos que no deben salir de la empresa, revisión humana y cómo presentarlo al equipo ' +
        'sin que lo viva como una amenaza.</p>',
      leccion: {
        prefijo: 'ia4',
        intro:
          '<h2>Lo que nunca se pega en un chat</h2><p>Datos personales de terceros, credenciales, ' +
          'información sujeta a contrato de confidencialidad y cualquier cosa que no enviaría por ' +
          'correo a un proveedor.</p>',
        youtubeId: VIDEOS.tearsOfSteel,
        desarrollo:
          '<h3>Una política en una página</h3><p>Qué se puede usar, qué no, quién revisa y qué ' +
          'pasa cuando algo sale mal. Si no cabe en una página, nadie la va a leer.</p>',
        avisoTitulo: 'Entregable final',
        avisoTexto:
          'Redacte la política de una página para su equipo y el flujo de trabajo que ha ' +
          'automatizado en el módulo 3.',
      },
    },
  ];

  for (const [indice, tema] of temas.entries()) {
    const seccion = secciones.find((s) => s.sectionNumber === indice + 1);
    if (!seccion) continue;

    await env.courses.updateSection(seccion.id as string, {
      name: tema.nombre,
      summary: tema.resumen,
    });

    await env.courses.addModule(
      curso._id,
      {
        moduleType: ModuleType.Page,
        sectionId: seccion.id as string,
        name: tema.nombre.split('·')[1]?.trim() ?? tema.nombre,
        completionTracking: 2,
        completionRules: { view: true },
        settings: { blocks: leccion(tema.leccion) },
      },
      env.teacherId,
    );
  }

  await env.courses.addModule(
    curso._id,
    {
      moduleType: ModuleType.Forum,
      sectionId: (secciones[0]?.id ?? secciones[1]?.id) as string,
      name: 'Foro del curso',
      settings: {
        intro: '<p>Comparta aquí el flujo que ha automatizado y resuelva sus dudas.</p>',
      },
    },
    env.teacherId,
  );
}

/* ----------------------------- Puesta a la venta -------------------------- */

async function ponerALaVenta(env: EntornoDemo, iaCourse: CourseDocument): Promise<void> {
  await actualizarCatalogo(env, env.angularCourseId, {
    listed: true,
    priceCents: 4900,
    compareAtPriceCents: 9900,
    currency: 'EUR',
    headline:
      'Construya aplicaciones Angular que se entienden a los seis meses: señales, componentes ' +
      'independientes y renderizado sin zonas.',
    highlights: [
      'Modelar el estado con señales en lugar de con suscripciones sueltas',
      'Componer pantallas con componentes independientes y carga perezosa',
      'Detectar y arreglar los repintados que sobran',
      'Dejar la aplicación lista para producción, con pruebas incluidas',
    ],
    requirements: [
      'Haber programado en JavaScript o TypeScript',
      'No hace falta experiencia previa con Angular',
    ],
    audience: [
      'Personas que desarrollan interfaces y quieren dar el salto a Angular moderno',
      'Equipos que arrastran una aplicación con Angular antiguo',
    ],
    level: 'Intermedio',
    durationHours: 14,
    certificate: true,
    promoVideoUrl: youtube(VIDEOS.bigBuckBunny),
    imageUrl: miniatura(VIDEOS.bigBuckBunny),
    instructorName: 'Daniel Ortega',
    instructorRole: 'Desarrollador frontend · 11 años de oficio',
    instructorBio:
      'Lleva desde AngularJS metido en esto. Ha migrado media docena de aplicaciones grandes a ' +
      'señales y cuenta en el curso lo que funcionó y lo que hubo que deshacer.',
    ratingAverage: 4.8,
    ratingCount: 187,
    landing: paginaCurso({
      titulo: 'Desarrollo frontend con Angular 22',
      gancho:
        'De las suscripciones sueltas a un estado que se lee de un vistazo. Catorce horas, un ' +
        'proyecto real y todo el código a su disposición.',
      youtubeId: VIDEOS.bigBuckBunny,
      ventajas: [
        {
          title: 'Señales de verdad',
          body: 'Cuándo usar signal, computed y effect, y por qué un getter no es un computed.',
          icon: 'zap',
        },
        {
          title: 'Sin zonas',
          body: 'Qué cambia al quitar Zone.js y cómo depurar cuando algo no se repinta.',
          icon: 'target',
        },
        {
          title: 'Arquitectura que aguanta',
          body: 'Rutas perezosas, servicios de raíz y dónde vive de verdad cada estado.',
          icon: 'layers',
        },
        {
          title: 'Listo para producir',
          body: 'Pruebas, tamaño del paquete y los errores que solo salen al compilar en serio.',
          icon: 'shield-check',
        },
      ],
      preguntas: [
        {
          title: '¿Sirve si vengo de React?',
          body:
            'Sí, y de hecho es de donde viene buena parte del alumnado. El módulo 1 traduce los ' +
            'conceptos que ya conoce.',
        },
        {
          title: '¿Se actualiza con cada versión de Angular?',
          body: 'Sí, y las actualizaciones están incluidas: el acceso no caduca.',
        },
      ],
    }),
  });

  await actualizarCatalogo(env, env.nestCourseId, {
    listed: true,
    priceCents: 5900,
    currency: 'EUR',
    headline:
      'Diseñe una API que otro equipo pueda mantener: módulos, validación, permisos por ' +
      'contexto y despliegue.',
    highlights: [
      'Estructurar módulos, servicios y controladores sin acabar con un archivo de mil líneas',
      'Validar toda la entrada y documentarla sola con Swagger',
      'Aislar los datos de cada cliente en una base multiempresa',
      'Autorizar por capacidades en vez de por rol',
    ],
    requirements: ['Node y TypeScript a nivel de uso diario', 'Nociones de bases de datos'],
    audience: [
      'Perfiles de backend que quieren dejar de improvisar la estructura',
      'Equipos que arrancan una plataforma multiempresa',
    ],
    level: 'Avanzado',
    durationHours: 16,
    certificate: true,
    promoVideoUrl: youtube(VIDEOS.sintel),
    imageUrl: miniatura(VIDEOS.sintel),
    instructorName: 'Daniel Ortega',
    instructorRole: 'Desarrollador backend · APIs en producción desde 2015',
    instructorBio:
      'Ha montado y mantenido plataformas multiempresa con miles de usuarios. El curso está ' +
      'construido sobre los errores que costaron una noche en producción.',
    ratingAverage: 4.7,
    ratingCount: 96,
  });

  await actualizarCatalogo(env, iaCourse._id, {
    listed: true,
    // Gratuito a propósito: deja probar la matrícula de punta a punta sin
    // pasarela ni tarjeta, que es lo primero que se quiere ver en una demo.
    priceCents: 0,
    currency: 'EUR',
    headline:
      'Cinco horas para que una tarea real de su semana la haga la IA, y usted sepa revisarla.',
    highlights: [
      'Explicar en una frase qué hace un modelo y dónde falla',
      'Escribir peticiones que devuelven lo que necesita a la primera',
      'Automatizar un flujo de trabajo suyo, no un caso de ejemplo',
      'Saber qué datos de su empresa no deben salir nunca',
    ],
    requirements: ['Ninguno. Un ordenador y una cuenta gratuita en un asistente de IA.'],
    audience: [
      'Profesionales y mandos medios sin perfil técnico',
      'Equipos de pymes que quieren empezar sin romper nada',
    ],
    level: 'Iniciación',
    durationHours: 5,
    certificate: true,
    promoVideoUrl: youtube(VIDEOS.cosmosLaundromat),
    imageUrl: miniatura(VIDEOS.cosmosLaundromat),
    instructorName: 'Lucía Fernández',
    instructorRole: 'Consultora de operaciones',
    instructorBio:
      'Acompaña a equipos pequeños en la adopción de herramientas nuevas. Su criterio: si algo ' +
      'no se puede revisar de un vistazo, todavía no está listo para delegarlo.',
    ratingAverage: 4.9,
    ratingCount: 312,
    landing: paginaCurso({
      titulo: 'Inteligencia Artificial Aplicada',
      gancho:
        'De curioso a productivo en cinco horas. 70 % manos en el teclado sobre sus propios ' +
        'documentos, 30 % concepto. Y es gratis.',
      youtubeId: VIDEOS.cosmosLaundromat,
      ventajas: [
        {
          title: 'Sobre su trabajo, no sobre casos inventados',
          body: 'Cada ejercicio se hace con documentos y tareas suyas de verdad.',
          icon: 'target',
        },
        {
          title: 'Un entregable por módulo',
          body: 'Sale con un flujo automatizado y una política de uso para su equipo.',
          icon: 'clipboard-check',
        },
        {
          title: 'Sin programar',
          body: 'No hay una línea de código en todo el curso.',
          icon: 'smile',
        },
        {
          title: 'Con criterio de riesgo',
          body: 'Qué datos no salen de la empresa y cómo reconocer una alucinación a tiempo.',
          icon: 'shield-check',
        },
      ],
      preguntas: [
        {
          title: '¿De verdad es gratis?',
          body: 'Sí. Es nuestra carta de presentación: si le convence, hablamos de los demás.',
        },
        {
          title: '¿Sirve para mi equipo entero?',
          body: 'Sí. Escríbanos y preparamos una sesión guiada con sus casos reales.',
        },
      ],
    }),
  });
}

/**
 * Escribe los datos de venta sobre el curso.
 *
 * Se hace con el modelo y no con el servicio porque `imageUrl` vive en el
 * curso y `catalog` en su subdocumento: una sola escritura evita dejar el
 * curso a medio actualizar si algo falla por el camino.
 */
async function actualizarCatalogo(
  env: EntornoDemo,
  courseId: Types.ObjectId,
  datos: Record<string, unknown> & { imageUrl?: string },
): Promise<void> {
  const { imageUrl, ...catalog } = datos;
  await env.courseModel
    .updateOne(
      { _id: courseId, tenant: env.tenantId },
      { $set: { catalog, ...(imageUrl ? { imageUrl } : {}) } },
    )
    .exec();
}

/* ------------------------------- Escaparate ------------------------------- */

async function publicarEscaparate(env: EntornoDemo): Promise<void> {
  const pagina = paginaDemo(env.tenantName);
  await env.site.update(env.tenantId, {
    published: true,
    template: pagina.template,
    sections: pagina.sections,
    seo: {
      title: `${env.tenantName} · Formación en desarrollo e IA`,
      description:
        'Cursos en línea de Angular, NestJS e inteligencia artificial aplicada. Acceso de por ' +
        'vida, certificado y acompañamiento real.',
    },
    contact: {
      email: 'info@academiamaya.example',
      phone: '+34 900 123 456',
      address: 'Calle de la Formación 12, 28001 Madrid',
      website: 'https://academiamaya.example',
    },
  } as never);
}

/* --------------------------------- Cobros --------------------------------- */

/**
 * Se activa la transferencia y no una pasarela.
 *
 * Mercado Pago y PayPal necesitan credenciales de una cuenta real, que no se
 * pueden inventar en una siembra. La transferencia deja la demostración
 * completa igualmente: se compra, entra el pedido, se confirma a mano desde
 * Pedidos y la matrícula se hace sola.
 */
async function configurarCobros(env: EntornoDemo): Promise<void> {
  await env.payments.update(env.tenantId, {
    currency: 'EUR',
    manual: {
      enabled: true,
      instructions:
        'Haga una transferencia a ES00 0000 0000 0000 0000 0000 indicando la referencia de su ' +
        'pedido. En cuanto la veamos le damos acceso al curso.',
    },
  });
}

/* --------------------------------- Pedidos -------------------------------- */

/** Pedidos de ejemplo, para que la pantalla no aparezca vacía en la demostración. */
async function sembrarPedidos(env: EntornoDemo, iaCourse: CourseDocument): Promise<void> {
  const existentes = await env.orderModel.countDocuments({ tenant: env.tenantId }).exec();
  if (existentes > 0) return;

  const dias = (n: number): Date => new Date(Date.now() - n * 86_400_000);

  await env.orderModel.create([
    {
      tenant: env.tenantId,
      reference: 'MC-7K3F9A',
      course: env.angularCourseId,
      courseTitle: 'Desarrollo frontend con Angular 22',
      buyer: {
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'ana.ruiz@academiamaya.example',
        phone: null,
      },
      amountCents: 4900,
      currency: 'EUR',
      provider: PaymentProvider.MercadoPago,
      status: OrderStatus.Paid,
      providerReference: '1234567890',
      providerPaymentId: '9876543210',
      user: env.studentIds[0] ?? null,
      enrolled: true,
      paidAt: dias(9),
      createdAt: dias(9),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-2QX48B',
      course: env.nestCourseId,
      courseTitle: 'APIs profesionales con NestJS 11',
      buyer: {
        firstName: 'Carlos',
        lastName: 'Molina',
        email: 'carlos.molina@academiamaya.example',
        phone: null,
      },
      amountCents: 5900,
      currency: 'EUR',
      provider: PaymentProvider.PayPal,
      status: OrderStatus.Paid,
      providerReference: '8AB12345CD678901E',
      user: env.studentIds[1] ?? null,
      enrolled: true,
      paidAt: dias(4),
      createdAt: dias(4),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-5TN20C',
      course: env.angularCourseId,
      courseTitle: 'Desarrollo frontend con Angular 22',
      buyer: {
        firstName: 'Marta',
        lastName: 'Iglesias',
        email: 'marta.iglesias@ejemplo.com',
        phone: '+34 600 111 222',
      },
      amountCents: 4900,
      currency: 'EUR',
      // Pendiente y por transferencia: es el caso que la pantalla de pedidos
      // permite resolver a mano, y conviene que la demostración lo tenga.
      provider: PaymentProvider.Manual,
      status: OrderStatus.Pending,
      enrolled: false,
      createdAt: dias(1),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-9WD73E',
      course: iaCourse._id,
      courseTitle: iaCourse.fullName,
      buyer: {
        firstName: 'Elena',
        lastName: 'Vargas',
        email: 'elena.vargas@academiamaya.example',
        phone: null,
      },
      amountCents: 0,
      currency: 'EUR',
      provider: PaymentProvider.Free,
      status: OrderStatus.Paid,
      user: env.studentIds[2] ?? null,
      enrolled: true,
      paidAt: dias(2),
      createdAt: dias(2),
    },
  ]);

  logger.log('   · 4 pedidos de ejemplo');
}
