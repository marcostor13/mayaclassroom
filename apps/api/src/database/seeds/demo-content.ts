import { LessonBlockType, SiteSectionType, SiteTemplate } from '@maya/shared';
import type { LessonBlock, SiteSection } from '@maya/shared';
import { makeSection } from '../../modules/site/site.defaults';

/* -------------------------------------------------------------------------- */
/*  Contenido de la demostración                                              */
/*                                                                            */
/*  Vive aparte del guion de siembra porque es contenido, no procedimiento:    */
/*  textos, temarios y vídeos que se retocan a menudo y que no deberían        */
/*  obligar a releer la lógica de creación cada vez.                          */
/*                                                                            */
/*  Los vídeos son cortometrajes de la Blender Foundation, publicados con      */
/*  licencia Creative Commons. Se usan como material de muestra: son libres,   */
/*  están alojados de forma estable y evitan tener que subir archivos para     */
/*  que la demostración se vea completa.                                      */
/* -------------------------------------------------------------------------- */

export const VIDEOS = {
  bigBuckBunny: 'YE7VzlLtp-4',
  sintel: 'eRsGyueVLvQ',
  tearsOfSteel: 'R6MlUcmOul8',
  elephantsDream: 'TLkA0RELQ1g',
  cosmosLaundromat: 'Y-rmzh0PI3c',
  spring: 'WhWc3b3KhnY',
} as const;

export const youtube = (id: string): string => `https://www.youtube.com/embed/${id}`;

/** Portada del vídeo. Sirve de imagen de curso sin subir ningún archivo. */
export const miniatura = (id: string): string => `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

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

/** Bloque de vídeo externo. */
const video = (id: string, youtubeId: string): LessonBlock => ({
  id,
  type: LessonBlockType.Embed,
  content: null,
  url: youtube(youtubeId),
  title: null,
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

/** Lección con vídeo, explicación y un aviso. Es la forma de todas las de la demo. */
export function leccion(params: {
  prefijo: string;
  intro: string;
  youtubeId: string;
  desarrollo: string;
  avisoTitulo: string;
  avisoTexto: string;
}): LessonBlock[] {
  return [
    texto(`${params.prefijo}-1`, params.intro),
    video(`${params.prefijo}-2`, params.youtubeId),
    texto(`${params.prefijo}-3`, params.desarrollo),
    aviso(`${params.prefijo}-4`, params.avisoTitulo, params.avisoTexto),
  ];
}

/* --------------------------- Página de la empresa ------------------------- */

/**
 * Escaparate de la academia de demostración, ya diseñado y publicado.
 *
 * Se siembra completo a propósito: una demostración con la página por defecto
 * enseña la plantilla, no lo que la plataforma permite hacer con ella.
 */
export function paginaDemo(nombre: string): { template: SiteTemplate; sections: SiteSection[] } {
  return {
    template: SiteTemplate.Classic,
    sections: [
      makeSection('portada', SiteSectionType.Hero, {
        title: 'Formación práctica que se nota el lunes',
        subtitle:
          'Cursos en línea de desarrollo e inteligencia artificial, con acompañamiento real ' +
          'y acceso de por vida. Empiece cuando quiera, avance a su ritmo.',
        ctaLabel: 'Ver los cursos',
        ctaUrl: '#cursos',
        ctaSecondaryLabel: 'Hablar con nosotros',
        ctaSecondaryUrl: '#contacto',
        videoUrl: youtube(VIDEOS.spring),
        style: { background: 'soft', align: 'start', spacing: 'roomy', columns: 3 },
      }),

      makeSection('ventajas', SiteSectionType.Features, {
        title: 'Por qué formarse con nosotros',
        subtitle: 'Sin relleno, sin sesiones interminables y sin caducidad.',
        items: [
          {
            title: 'A su ritmo, de por vida',
            body: 'El acceso no caduca. Vuelva al material cuando lo necesite.',
            icon: 'clock',
            author: null,
            imageUrl: null,
            value: null,
            url: null,
          },
          {
            title: 'Proyectos reales',
            body: 'Cada módulo cierra con algo que puede enseñar o usar en su trabajo.',
            icon: 'zap',
            author: null,
            imageUrl: null,
            value: null,
            url: null,
          },
          {
            title: 'Dudas resueltas',
            body: 'Foro por curso y mensajería directa con el profesorado.',
            icon: 'message-square',
            author: null,
            imageUrl: null,
            value: null,
            url: null,
          },
          {
            title: 'Certificado verificable',
            body: 'Al completar el curso recibe un certificado con código de verificación.',
            icon: 'award',
            author: null,
            imageUrl: null,
            value: null,
            url: null,
          },
        ],
        style: { background: 'plain', align: 'center', spacing: 'normal', columns: 4 },
      }),

      makeSection('cursos', SiteSectionType.Courses, {
        title: 'Nuestros cursos',
        subtitle: 'Tres formaciones, tres niveles. Elija por donde le encaje empezar.',
      }),

      makeSection('cifras', SiteSectionType.Stats, {
        title: null,
        items: [
          { title: 'Alumnado formado', value: '1.240', body: null, author: null, imageUrl: null, icon: null, url: null },
          { title: 'Horas de contenido', value: '38', body: null, author: null, imageUrl: null, icon: null, url: null },
          { title: 'Valoración media', value: '4,8/5', body: null, author: null, imageUrl: null, icon: null, url: null },
          { title: 'Terminan el curso', value: '87 %', body: null, author: null, imageUrl: null, icon: null, url: null },
        ],
        style: { background: 'brand', align: 'center', spacing: 'normal', columns: 4 },
      }),

      makeSection('como-funciona', SiteSectionType.Steps, {
        title: 'Cómo funciona',
        subtitle: 'De la compra al aula, en menos de un minuto.',
        items: [
          {
            title: 'Elija su curso',
            body: 'Cada ficha trae el temario completo y una muestra gratuita.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: 'Pague como prefiera',
            body: 'Mercado Pago, PayPal o transferencia. El cobro es de la pasarela, no nuestro.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: 'Reciba su acceso',
            body: 'Le llega un correo con su cuenta creada y el curso ya matriculado.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: 'Empiece a aprender',
            body: 'Vídeos, ejercicios y foro. Su avance se guarda solo.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
        ],
        style: { background: 'soft', align: 'start', spacing: 'normal', columns: 4 },
      }),

      makeSection('testimonios', SiteSectionType.Testimonials, {
        title: 'Lo que dice quien ya ha pasado por aquí',
        items: [
          {
            title: 'Dejé de copiar plantillas y entendí el porqué',
            body:
              'Venía de hacer cursos que se quedan en la superficie. Aquí el módulo de señales ' +
              'me cambió la forma de estructurar la aplicación en el trabajo.',
            author: 'Ana Ruiz · Desarrolladora frontend',
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: 'En dos semanas teníamos la API en producción',
            body:
              'El curso de NestJS está montado como se monta de verdad un proyecto: validación, ' +
              'permisos y despliegue. Nos ahorró meses de prueba y error.',
            author: 'Carlos Molina · Responsable técnico',
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: 'Por fin una formación de IA sin humo',
            body:
              'Salí con un flujo de mi trabajo automatizado de verdad, no con una lista de ' +
              'herramientas que nunca vuelvo a abrir.',
            author: 'Elena Vargas · Responsable de operaciones',
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
        ],
        style: { background: 'plain', align: 'start', spacing: 'normal', columns: 3 },
      }),

      makeSection('preguntas', SiteSectionType.Faq, {
        title: 'Preguntas frecuentes',
        items: [
          {
            title: '¿Cuánto dura el acceso?',
            body: 'Para siempre. Se compra una vez y el material queda disponible, actualizaciones incluidas.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: '¿Necesito conocimientos previos?',
            body:
              'El curso de IA no pide ninguno. Los de desarrollo asumen que ha programado antes, ' +
              'aunque no en estas tecnologías.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: '¿Cómo se paga?',
            body:
              'Con Mercado Pago, con PayPal o por transferencia. El pago se hace en la pasarela; ' +
              'nosotros no vemos ni guardamos los datos de su tarjeta.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
          {
            title: '¿Recibo factura?',
            body: 'Sí. Escríbanos con sus datos fiscales y se la emitimos el mismo día.',
            author: null,
            imageUrl: null,
            icon: null,
            value: null,
            url: null,
          },
        ],
        style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
      }),

      makeSection('sobre-nosotros', SiteSectionType.About, {
        title: `Sobre ${nombre}`,
        body:
          'Somos un equipo pequeño de personas que se dedican a esto todos los días: ' +
          'desarrollamos software a medida y damos formación con lo que aprendemos haciéndolo.\n\n' +
          'Por eso nuestros cursos no explican la teoría de un manual, sino las decisiones que ' +
          'se toman en un proyecto real y por qué. Si algo no le encaja, escríbanos: preferimos ' +
          'que se matricule en el curso adecuado antes que en el más caro.',
      }),

      makeSection('llamada', SiteSectionType.Cta, {
        title: '¿Formación para todo su equipo?',
        subtitle: 'Preparamos programas a medida y licencias por volumen.',
        ctaLabel: 'Pedir presupuesto',
        ctaUrl: '#contacto',
        style: { background: 'plain', align: 'center', spacing: 'normal', columns: 3 },
      }),

      makeSection('contacto', SiteSectionType.Contact, {
        title: '¿Hablamos?',
        subtitle: 'Le respondemos el mismo día laborable.',
        style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
      }),
    ],
  };
}

/* ------------------------ Página de venta de un curso --------------------- */

/**
 * Página de venta propia de un curso de la demostración.
 *
 * Se siembra ya diseñada para enseñar la diferencia entre la maqueta por
 * defecto —que la plataforma compone sola— y una página trabajada, que es lo
 * que se puede hacer con el editor.
 */
export function paginaCurso(params: {
  titulo: string;
  gancho: string;
  youtubeId: string;
  ventajas: { title: string; body: string; icon: string }[];
  preguntas: { title: string; body: string }[];
}): SiteSection[] {
  return [
    makeSection('portada', SiteSectionType.Hero, {
      title: params.titulo,
      subtitle: params.gancho,
      ctaLabel: 'Comprar el curso',
      ctaUrl: '#comprar',
      videoUrl: youtube(params.youtubeId),
      style: { background: 'soft', align: 'start', spacing: 'roomy', columns: 3 },
    }),
    makeSection('aprenderas', SiteSectionType.Features, {
      title: 'Lo que va a saber hacer al terminar',
      items: params.ventajas.map((item) => ({
        title: item.title,
        body: item.body,
        icon: item.icon,
        author: null,
        imageUrl: null,
        value: null,
        url: null,
      })),
      style: { background: 'plain', align: 'start', spacing: 'normal', columns: 2 },
    }),
    makeSection('temario', SiteSectionType.Curriculum, {
      title: 'Temario completo',
      subtitle: 'El primer tema se puede ver gratis antes de comprar.',
      style: { background: 'soft', align: 'start', spacing: 'normal', columns: 3 },
    }),
    makeSection('profesorado', SiteSectionType.Instructor, {
      title: 'Quién imparte el curso',
    }),
    makeSection('preguntas', SiteSectionType.Faq, {
      title: 'Dudas antes de decidirse',
      items: params.preguntas.map((item) => ({
        title: item.title,
        body: item.body,
        author: null,
        imageUrl: null,
        icon: null,
        value: null,
        url: null,
      })),
      style: { background: 'plain', align: 'start', spacing: 'normal', columns: 3 },
    }),
    makeSection('comprar', SiteSectionType.Pricing, {
      title: 'Empiece hoy mismo',
      subtitle: 'Acceso inmediato en cuanto se confirme el pago.',
      ctaLabel: 'Comprar ahora',
      style: { background: 'brand', align: 'center', spacing: 'roomy', columns: 3 },
    }),
  ];
}
