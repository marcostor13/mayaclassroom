import { Logger } from '@nestjs/common';
import type { Model, Types } from 'mongoose';
import { DEFAULT_CURRENCY, OrderStatus, PaymentProvider } from '@maya/shared';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import type { SiteService } from '../../modules/site/site.service';
import type { PaymentsService } from '../../modules/commerce/payments.service';
import type { OrderDocument } from '../../modules/commerce/schemas/order.schema';
import { paginaDemo } from './demo-content';
import { avatar, portada } from './demo-courses';
import type { CursoDemo } from './demo-courses';
import type { Videos } from './demo-media';

const logger = new Logger('Seed·Escaparate');

export interface EntornoDemo {
  tenantId: Types.ObjectId;
  tenantName: string;
  studentIds: Types.ObjectId[];
  site: SiteService;
  payments: PaymentsService;
  orderModel: Model<OrderDocument>;
  courseModel: Model<CourseDocument>;
  /** Los cursos ya creados, por nombre corto. */
  cursos: Map<string, CourseDocument>;
  /** La definición de cada curso, con sus datos de venta. */
  definiciones: CursoDemo[];
  videos: Videos;
}

/**
 * Convierte la escuela de demostración en una que vende de verdad: catálogo
 * con precios en soles, fichas de venta diseñadas, escaparate publicado,
 * cobros configurados y pedidos ya recibidos.
 *
 * Todo es idempotente: la siembra se ejecuta muchas veces sobre la misma base
 * y no debe duplicar pedidos ni secciones.
 */
export async function seedStorefront(env: EntornoDemo): Promise<void> {
  logger.log('Catálogo de venta');
  await ponerALaVenta(env);

  logger.log('Escaparate publicado');
  await publicarEscaparate(env);

  logger.log('Cobros y pedidos');
  await configurarCobros(env);
  await sembrarPedidos(env);
}

/* ----------------------------- Puesta a la venta -------------------------- */

async function ponerALaVenta(env: EntornoDemo): Promise<void> {
  for (const definicion of env.definiciones) {
    const curso = env.cursos.get(definicion.shortName);
    if (!curso) continue;

    const c = definicion.catalogo;
    await actualizarCatalogo(env, curso._id, portada(definicion.imagenId), {
      listed: true,
      priceCents: c.priceCents,
      compareAtPriceCents: c.compareAtPriceCents ?? null,
      currency: DEFAULT_CURRENCY,
      headline: c.headline,
      highlights: c.highlights,
      requirements: c.requirements,
      audience: c.audience,
      level: c.level,
      durationHours: c.durationHours,
      certificate: true,
      promoVideoUrl: videoDelCurso(definicion),
      instructorName: c.instructorName,
      instructorRole: c.instructorRole,
      instructorBio: c.instructorBio,
      instructorAvatarUrl: avatar(c.instructorAvatarId),
      ratingAverage: c.ratingAverage,
      ratingCount: c.ratingCount,
      landing: definicion.landing,
    });
  }
}

/**
 * El vídeo de presentación del curso.
 *
 * Sale de la portada de su propia página de venta, que ya lo lleva resuelto;
 * así el vídeo de la ficha y el de la página son el mismo y no hay dos sitios
 * donde equivocarse.
 */
function videoDelCurso(definicion: CursoDemo): string | null {
  return definicion.landing?.find((s) => s.id === 'portada')?.videoUrl ?? null;
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
  imageUrl: string,
  catalog: Record<string, unknown>,
): Promise<void> {
  await env.courseModel
    .updateOne({ _id: courseId, tenant: env.tenantId }, { $set: { catalog, imageUrl } })
    .exec();
}

/* ------------------------------- Escaparate ------------------------------- */

async function publicarEscaparate(env: EntornoDemo): Promise<void> {
  const pagina = paginaDemo(env.tenantName, env.videos.decorando);
  await env.site.update(env.tenantId, {
    published: true,
    template: pagina.template,
    sections: pagina.sections,
    seo: {
      title: `${env.tenantName} · Escuela de pastelería en línea`,
      description:
        'Cursos de pastelería peruana, chocolatería con cacao de origen y panadería de masa ' +
        'madre. Recetas al gramo, acceso de por vida y certificado. Desde Lima para todo Perú.',
    },
    contact: {
      email: 'hola@dulcelima.pe',
      phone: '+51 987 654 321',
      address: 'Jr. Domeyer 220, Barranco, Lima',
      website: 'https://dulcelima.pe',
    },
  } as never);
}

/* --------------------------------- Cobros --------------------------------- */

/**
 * Se activan la transferencia y la pasarela de prueba.
 *
 * Mercado Pago y PayPal necesitan credenciales de una cuenta real, que no se
 * pueden inventar en una siembra. Con estas dos la demostración queda completa
 * por los dos caminos: la de prueba recorre el circuito entero de una compra
 * de pago —salir a la pasarela, decidir y volver matriculado— y la
 * transferencia enseña el pedido que la empresa confirma a mano.
 */
async function configurarCobros(env: EntornoDemo): Promise<void> {
  await env.payments.update(env.tenantId, {
    currency: DEFAULT_CURRENCY,
    manual: {
      enabled: true,
      instructions:
        'Transferencia o depósito al BCP, cuenta corriente soles 194-1234567-0-89 ' +
        '(CCI 002-194-001234567089-51), a nombre de Dulce Lima Escuela de Pastelería S.A.C. ' +
        'También aceptamos Yape al 987 654 321. Ponga la referencia de su pedido en el ' +
        'mensaje y envíenos la constancia por WhatsApp: en cuanto la veamos le damos acceso.',
    },
    simulated: { enabled: true },
  });
}

/* --------------------------------- Pedidos -------------------------------- */

/** Pedidos de ejemplo, para que la pantalla no aparezca vacía en la demostración. */
async function sembrarPedidos(env: EntornoDemo): Promise<void> {
  const existentes = await env.orderModel.countDocuments({ tenant: env.tenantId }).exec();
  if (existentes > 0) return;

  const dias = (n: number): Date => new Date(Date.now() - n * 86_400_000);
  const idDe = (shortName: string): Types.ObjectId | null =>
    env.cursos.get(shortName)?._id ?? null;
  const tituloDe = (shortName: string): string =>
    env.cursos.get(shortName)?.fullName ?? shortName;

  const pasteleria = idDe('PAST-101');
  const chocolate = idDe('CHOC-201');
  const panaderia = idDe('PAN-150');
  const intro = idDe('INTRO-10');
  if (!pasteleria || !chocolate || !panaderia || !intro) return;

  await env.orderModel.create([
    {
      tenant: env.tenantId,
      reference: 'MC-7K3F9A',
      course: pasteleria,
      courseTitle: tituloDe('PAST-101'),
      buyer: {
        firstName: 'Ana',
        lastName: 'Quispe',
        email: 'ana.quispe@dulcelima.pe',
        phone: null,
      },
      amountCents: 14900,
      currency: DEFAULT_CURRENCY,
      provider: PaymentProvider.MercadoPago,
      status: OrderStatus.Paid,
      providerReference: '1234567890',
      providerPaymentId: '9876543210',
      user: env.studentIds[0] ?? null,
      enrolled: true,
      paidAt: dias(12),
      createdAt: dias(12),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-2QX48B',
      course: chocolate,
      courseTitle: tituloDe('CHOC-201'),
      buyer: {
        firstName: 'Carlos',
        lastName: 'Mendoza',
        email: 'carlos.mendoza@dulcelima.pe',
        phone: null,
      },
      amountCents: 24900,
      currency: DEFAULT_CURRENCY,
      provider: PaymentProvider.PayPal,
      status: OrderStatus.Paid,
      providerReference: '8AB12345CD678901E',
      user: env.studentIds[1] ?? null,
      enrolled: true,
      paidAt: dias(6),
      createdAt: dias(6),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-5TN20C',
      course: pasteleria,
      courseTitle: tituloDe('PAST-101'),
      buyer: {
        firstName: 'Rocío',
        lastName: 'Ttito',
        email: 'rocio.ttito@ejemplo.pe',
        phone: '+51 951 222 333',
      },
      amountCents: 14900,
      currency: DEFAULT_CURRENCY,
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
      course: intro,
      courseTitle: tituloDe('INTRO-10'),
      buyer: {
        firstName: 'Lucía',
        lastName: 'Huamán',
        email: 'lucia.huaman@dulcelima.pe',
        phone: null,
      },
      amountCents: 0,
      currency: DEFAULT_CURRENCY,
      provider: PaymentProvider.Free,
      status: OrderStatus.Paid,
      user: env.studentIds[2] ?? null,
      enrolled: true,
      paidAt: dias(3),
      createdAt: dias(3),
    },
    {
      tenant: env.tenantId,
      reference: 'MC-4HB61F',
      course: panaderia,
      courseTitle: tituloDe('PAN-150'),
      buyer: {
        firstName: 'Diego',
        lastName: 'Palomino',
        email: 'diego.palomino@dulcelima.pe',
        phone: '+51 998 111 444',
      },
      amountCents: 18900,
      currency: DEFAULT_CURRENCY,
      provider: PaymentProvider.Simulated,
      status: OrderStatus.Paid,
      user: env.studentIds[3] ?? null,
      enrolled: true,
      paidAt: dias(2),
      createdAt: dias(2),
    },
  ]);

  logger.log('   · 5 pedidos de ejemplo');
}
