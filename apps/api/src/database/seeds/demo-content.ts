import { LessonBlockType, SiteSectionType, SiteTemplate } from '@maya/shared';
import type { LessonBlock, SiteSection, SiteSectionItem } from '@maya/shared';
import { makeSection } from '../../modules/site/site.defaults';
import { FOTOS, foto } from './demo-media';

/* -------------------------------------------------------------------------- */
/*  Contenido de la demostración · Dulce Lima, escuela de pastelería           */
/*                                                                            */
/*  Vive aparte del guion de siembra porque es contenido, no procedimiento:    */
/*  textos, temarios e imágenes que se retocan a menudo y que no deberían      */
/*  obligar a releer la lógica de creación cada vez.                          */
/*                                                                            */
/*  Todo está escrito para Perú: precios en soles, direcciones de Lima,        */
/*  comprobante de pago y recetas de la casa. Una demostración con nombres y   */
/*  costumbres de otro sitio se nota y resta credibilidad a la plataforma.     */
/* -------------------------------------------------------------------------- */

/** Elemento de sección con todos los campos puestos. */
export function elemento(datos: Partial<SiteSectionItem> & { title: string }): SiteSectionItem {
  return {
    title: datos.title,
    body: datos.body ?? null,
    imageUrl: datos.imageUrl ?? null,
    author: datos.author ?? null,
    icon: datos.icon ?? null,
    value: datos.value ?? null,
    url: datos.url ?? null,
  };
}

/* ------------------------------- Lecciones -------------------------------- */

/** Bloque de texto de una lección. */
const texto = (id: string, html: string): LessonBlock => ({
  id,
  type: LessonBlockType.Text,
  content: html,
  url: null,
  title: null,
  variant: null,
  mimeType: null,
  filename: null,
});

/** Bloque de vídeo. Admite tanto una incrustación como un fichero suelto. */
const video = (id: string, url: string): LessonBlock => ({
  id,
  type: LessonBlockType.Embed,
  content: null,
  url,
  title: null,
  variant: null,
  mimeType: null,
  filename: null,
});

/** Imagen con pie. */
const imagen = (id: string, url: string, pie: string): LessonBlock => ({
  id,
  type: LessonBlockType.Image,
  content: null,
  url,
  title: pie,
  variant: null,
  mimeType: null,
  filename: null,
});

/** Aviso destacado dentro de la lección. */
const aviso = (
  id: string,
  title: string,
  html: string,
  variant: 'info' | 'success' | 'warning' = 'info',
): LessonBlock => ({
  id,
  type: LessonBlockType.Callout,
  content: html,
  url: null,
  title,
  variant,
  mimeType: null,
  filename: null,
});

export interface LeccionDemo {
  prefijo: string;
  intro: string;
  /** Dirección del vídeo ya resuelta. Sin vídeo, la lección va con la imagen. */
  videoUrl?: string | null;
  imagenId?: number;
  imagenPie?: string;
  desarrollo: string;
  avisoTitulo: string;
  avisoTexto: string;
}

/**
 * Lección de la demostración: explicación, medio, desarrollo y un aviso.
 *
 * El medio es el vídeo si se pudo resolver y, si no, la fotografía: una
 * lección sin nada visual se lee como un apunte, no como un curso, y la
 * demostración tiene que enseñar cómo queda de verdad.
 */
export function leccion(params: LeccionDemo): LessonBlock[] {
  const medio = params.videoUrl
    ? video(`${params.prefijo}-2`, params.videoUrl)
    : params.imagenId
      ? imagen(`${params.prefijo}-2`, foto(params.imagenId, 1200, 800), params.imagenPie ?? '')
      : null;

  return [
    texto(`${params.prefijo}-1`, params.intro),
    ...(medio ? [medio] : []),
    texto(`${params.prefijo}-3`, params.desarrollo),
    aviso(`${params.prefijo}-4`, params.avisoTitulo, params.avisoTexto),
  ];
}

/* --------------------------- Página de la empresa ------------------------- */

/**
 * Escaparate de la escuela, ya diseñado y publicado.
 *
 * Se siembra completo a propósito: una demostración con la página por defecto
 * enseña la plantilla, no lo que la plataforma permite hacer con ella.
 */
export function paginaDemo(
  nombre: string,
  videoPortada: string | null,
): { template: SiteTemplate; sections: SiteSection[] } {
  return {
    template: SiteTemplate.Classic,
    sections: [
      makeSection('portada', SiteSectionType.Hero, {
        title: 'Aprenda pastelería con las manos en la masa',
        subtitle:
          'Cursos en línea de pastelería peruana, chocolatería y panadería, grabados en obrador ' +
          'y pensados para vender: recetas escaladas, costos por porción y acompañamiento del ' +
          'equipo docente. Empiece cuando quiera, a su ritmo y de por vida.',
        ctaLabel: 'Ver los cursos',
        ctaUrl: '#cursos',
        ctaSecondaryLabel: 'Escríbanos',
        ctaSecondaryUrl: '#contacto',
        imageUrl: foto(FOTOS.amasando, 1200, 900),
        videoUrl: videoPortada,
        style: { background: 'soft', align: 'start', spacing: 'roomy', columns: 3 },
      }),

      makeSection('ventajas', SiteSectionType.Features, {
        title: 'Por qué estudiar en Dulce Lima',
        subtitle: 'Sin relleno, con recetas probadas en producción y sin fecha de caducidad.',
        items: [
          elemento({
            title: 'Recetas al gramo',
            body: 'Cada preparación viene escalada, con porcentaje de panadero y costo por porción.',
            icon: 'clipboard-check',
          }),
          elemento({
            title: 'Ajustado al clima de Lima',
            body: 'Humedad, fermentaciones y templado de chocolate resueltos para la costa peruana.',
            icon: 'target',
          }),
          elemento({
            title: 'Acceso de por vida',
            body: 'El curso no caduca y las actualizaciones de recetas entran sin pagar de nuevo.',
            icon: 'clock',
          }),
          elemento({
            title: 'Certificado verificable',
            body: 'Al terminar recibe un certificado con código de verificación en línea.',
            icon: 'award',
          }),
        ],
        style: { background: 'plain', align: 'center', spacing: 'normal', columns: 4 },
      }),

      makeSection('cursos', SiteSectionType.Courses, {
        title: 'Nuestros cursos',
        subtitle: 'De las cinco recetas base a la bombonería fina. Elija por dónde empezar.',
      }),

      makeSection('cifras', SiteSectionType.Stats, {
        title: null,
        items: [
          elemento({ title: 'Alumnado formado', value: '1.860' }),
          elemento({ title: 'Horas de obrador grabadas', value: '46' }),
          elemento({ title: 'Valoración media', value: '4,8/5' }),
          elemento({ title: 'Terminan el curso', value: '89 %' }),
        ],
        style: { background: 'brand', align: 'center', spacing: 'normal', columns: 4 },
      }),

      makeSection('galeria', SiteSectionType.Gallery, {
        title: 'El obrador por dentro',
        subtitle: 'Lo que se hace en clase, tal cual sale de la vitrina.',
        items: [
          elemento({ title: 'Vitrina de la escuela', imageUrl: foto(FOTOS.vitrina, 800, 600) }),
          elemento({ title: 'Mostrador de la mañana', imageUrl: foto(FOTOS.mostrador, 800, 600) }),
          elemento({ title: 'Surtido de tartaletas', imageUrl: foto(FOTOS.surtido, 800, 600) }),
          elemento({ title: 'Panes de masa madre', imageUrl: foto(FOTOS.panes, 800, 600) }),
          elemento({ title: 'Torta de capas', imageUrl: foto(FOTOS.tortaCapas, 800, 600) }),
          elemento({ title: 'Macarons del taller', imageUrl: foto(FOTOS.macarons, 800, 600) }),
        ],
        style: { background: 'soft', align: 'center', spacing: 'normal', columns: 3 },
      }),

      makeSection('como-funciona', SiteSectionType.Steps, {
        title: 'Cómo funciona',
        subtitle: 'De la compra al obrador, en menos de un minuto.',
        items: [
          elemento({
            title: 'Elija su curso',
            body: 'Cada ficha trae el temario completo y una clase de muestra gratuita.',
          }),
          elemento({
            title: 'Pague en soles',
            body: 'Mercado Pago, PayPal o transferencia y Yape. El cobro lo hace la pasarela.',
          }),
          elemento({
            title: 'Reciba su acceso',
            body: 'Le llega un correo con la cuenta creada y el curso ya matriculado.',
          }),
          elemento({
            title: 'A la cocina',
            body: 'Vídeos, recetario descargable y foro con el equipo docente. El avance se guarda solo.',
          }),
        ],
        style: { background: 'plain', align: 'start', spacing: 'normal', columns: 4 },
      }),

      makeSection('testimonios', SiteSectionType.Testimonials, {
        title: 'Lo que dice quien ya pasó por el obrador',
        items: [
          elemento({
            title: 'Dejé de regalar el trabajo',
            body:
              'Vendía alfajores por encargo sin saber cuánto ganaba. Con la plantilla de costos ' +
              'del curso subí el precio 40 % y sigo vendiendo igual.',
            author: 'Rocío Ttito · Emprendedora, Cusco',
          }),
          elemento({
            title: 'El merengue por fin me aguanta',
            body:
              'Con la humedad de Lima se me bajaba siempre. La clase del merengue italiano y el ' +
              'truco del almíbar a 118 °C me resolvieron el suspiro de una vez.',
            author: 'Diego Palomino · Pastelero, Miraflores',
          }),
          elemento({
            title: 'Abrimos la carta de bombones',
            body:
              'Sumamos bombonería a la cafetería con lo que aprendimos en chocolatería. Es lo ' +
              'que más margen deja de toda la vitrina.',
            author: 'Sofía Ccahuana · Cafetería Aroma, Barranco',
          }),
        ],
        style: { background: 'plain', align: 'start', spacing: 'normal', columns: 3 },
      }),

      makeSection('preguntas', SiteSectionType.Faq, {
        title: 'Preguntas frecuentes',
        items: [
          elemento({
            title: '¿Cuánto dura el acceso?',
            body:
              'Para siempre. Se paga una vez y el material queda disponible, con las ' +
              'actualizaciones de recetas incluidas.',
          }),
          elemento({
            title: '¿Necesito equipo profesional?',
            body:
              'No. Todo está probado con horno doméstico y batidora de mano. Cuando una receta ' +
              'exija algo más, se dice antes y se da la alternativa.',
          }),
          elemento({
            title: '¿Cómo pago?',
            body:
              'En soles, con Mercado Pago, PayPal, transferencia o Yape. El pago se hace en la ' +
              'pasarela: nosotros no vemos ni guardamos los datos de su tarjeta.',
          }),
          elemento({
            title: '¿Emiten boleta o factura?',
            body:
              'Sí. Escríbanos con su DNI o su RUC y le emitimos el comprobante electrónico el ' +
              'mismo día.',
          }),
          elemento({
            title: '¿Los ingredientes se consiguen en Perú?',
            body:
              'Todos. Cada receta lleva las marcas y los mercados donde encontrarlos, y una ' +
              'alternativa por si falta alguno.',
          }),
          elemento({
            title: '¿Hay clases en vivo?',
            body:
              'Una al mes, para resolver dudas del temario. Se graba y queda en el curso por si ' +
              'no puede asistir.',
          }),
        ],
        style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
      }),

      makeSection('sobre-nosotros', SiteSectionType.About, {
        title: `Sobre ${nombre}`,
        body:
          'Somos un obrador de Barranco que empezó vendiendo alfajores en ferias y acabó ' +
          'enseñando a hacerlos. Seguimos produciendo todas las semanas: lo que se cuenta en ' +
          'los cursos es lo que hacemos, no lo que dice un manual.\n\n' +
          'Por eso cada receta viene con su costo, su rendimiento y los fallos típicos. Si algo ' +
          'no le encaja, escríbanos: preferimos que se matricule en el curso adecuado antes que ' +
          'en el más caro.',
        imageUrl: foto(FOTOS.obrador, 1200, 800),
        style: { background: 'plain', align: 'start', spacing: 'normal', columns: 3 },
      }),

      makeSection('llamada', SiteSectionType.Cta, {
        title: '¿Formación para todo su equipo?',
        subtitle: 'Preparamos programas a medida para restaurantes, hoteles y cafeterías.',
        ctaLabel: 'Pedir una propuesta',
        ctaUrl: '#contacto',
        style: { background: 'plain', align: 'center', spacing: 'normal', columns: 3 },
      }),

      makeSection('contacto', SiteSectionType.Contact, {
        title: '¿Conversamos?',
        subtitle: 'Respondemos el mismo día útil, de lunes a sábado.',
        style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
      }),
    ],
  };
}

/* ------------------------ Página de venta de un curso --------------------- */

/**
 * Página de venta propia de un curso.
 *
 * Se siembra ya diseñada para enseñar la diferencia entre la maqueta por
 * defecto —que la plataforma compone sola— y una página trabajada, que es lo
 * que se puede hacer con el editor.
 */
export function paginaCurso(params: {
  titulo: string;
  gancho: string;
  videoUrl: string | null;
  imagenId: number;
  ventajas: { title: string; body: string; icon: string }[];
  preguntas: { title: string; body: string }[];
  galeria?: { title: string; imagenId: number }[];
}): SiteSection[] {
  return [
    makeSection('portada', SiteSectionType.Hero, {
      title: params.titulo,
      subtitle: params.gancho,
      ctaLabel: 'Llevar el curso',
      ctaUrl: '#comprar',
      imageUrl: foto(params.imagenId, 1200, 900),
      videoUrl: params.videoUrl,
      style: { background: 'soft', align: 'start', spacing: 'roomy', columns: 3 },
    }),
    makeSection('aprenderas', SiteSectionType.Features, {
      title: 'Lo que va a saber hacer al terminar',
      items: params.ventajas.map((item) =>
        elemento({ title: item.title, body: item.body, icon: item.icon }),
      ),
      style: { background: 'plain', align: 'start', spacing: 'normal', columns: 2 },
    }),
    ...(params.galeria?.length
      ? [
          makeSection('muestras', SiteSectionType.Gallery, {
            title: 'Lo que va a sacar del horno',
            items: params.galeria.map((item) =>
              elemento({ title: item.title, imageUrl: foto(item.imagenId, 800, 600) }),
            ),
            style: { background: 'soft', align: 'center', spacing: 'normal', columns: 3 },
          }),
        ]
      : []),
    makeSection('temario', SiteSectionType.Curriculum, {
      title: 'Temario completo',
      subtitle: 'La primera clase se puede ver gratis antes de comprar.',
      style: { background: 'plain', align: 'start', spacing: 'normal', columns: 3 },
    }),
    makeSection('profesorado', SiteSectionType.Instructor, {
      title: 'Quién dicta el curso',
    }),
    makeSection('preguntas', SiteSectionType.Faq, {
      title: 'Dudas antes de decidirse',
      items: params.preguntas.map((item) => elemento({ title: item.title, body: item.body })),
      style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
    }),
    makeSection('comprar', SiteSectionType.Pricing, {
      title: 'Empiece hoy mismo',
      subtitle: 'Acceso inmediato en cuanto se confirme el pago.',
      ctaLabel: 'Comprar ahora',
      style: { background: 'brand', align: 'center', spacing: 'roomy', columns: 3 },
    }),
  ];
}
