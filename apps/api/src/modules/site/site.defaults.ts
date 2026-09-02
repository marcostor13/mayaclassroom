import { DEFAULT_SECTION_STYLE, SiteSectionType, SiteTemplate } from '@maya/shared';
import type { SiteSection, SiteSectionStyle } from '@maya/shared';

export const DEFAULT_TEMPLATE = SiteTemplate.Classic;

/**
 * Constructor de secciones con todos los campos puestos.
 *
 * Existe porque una sección a medio rellenar es una sección que el editor no
 * sabe pintar: `undefined` y `null` se comportan distinto en Mongoose y en las
 * plantillas de Angular, y un campo ausente reaparece con el valor anterior al
 * guardar. Aquí siempre salen completas.
 */
export function makeSection(
  id: string,
  type: SiteSectionType,
  extra: Partial<SiteSection> = {},
): SiteSection {
  return {
    id,
    type,
    enabled: true,
    title: null,
    subtitle: null,
    body: null,
    imageUrl: null,
    ctaLabel: null,
    ctaUrl: null,
    ctaSecondaryLabel: null,
    ctaSecondaryUrl: null,
    videoUrl: null,
    items: [],
    limit: null,
    style: { ...DEFAULT_SECTION_STYLE },
    ...extra,
  };
}

const style = (extra: Partial<SiteSectionStyle>): SiteSectionStyle => ({
  ...DEFAULT_SECTION_STYLE,
  ...extra,
});

/**
 * Página de partida de una empresa.
 *
 * Se crea con contenido de ejemplo y no vacía a propósito: una página en blanco
 * no enseña qué se puede hacer con ella, y obliga a imaginar el resultado antes
 * de ver nada. Con secciones ya puestas, editar es cambiar textos, que es una
 * tarea mucho más fácil que construir desde cero.
 */
export function defaultSections(tenantName: string): SiteSection[] {
  return [
    makeSection('portada', SiteSectionType.Hero, {
      title: `Formación en ${tenantName}`,
      subtitle: 'Aprenda a su ritmo, con acompañamiento de nuestro equipo docente.',
      ctaLabel: 'Ver los cursos',
      ctaUrl: '#cursos',
      ctaSecondaryLabel: 'Hablar con nosotros',
      ctaSecondaryUrl: '#contacto',
      style: style({ background: 'soft', spacing: 'roomy' }),
    }),
    makeSection('ventajas', SiteSectionType.Features, {
      title: 'Por qué formarse con nosotros',
      items: [
        {
          title: 'A tu ritmo',
          body: 'Acceso ilimitado al material desde el primer día.',
          icon: 'clock',
          author: null,
          imageUrl: null,
          value: null,
          url: null,
        },
        {
          title: 'Con acompañamiento',
          body: 'Resolvemos dudas por el foro del curso y por mensajería.',
          icon: 'message-square',
          author: null,
          imageUrl: null,
          value: null,
          url: null,
        },
        {
          title: 'Con certificado',
          body: 'Al terminar recibes un certificado verificable.',
          icon: 'award',
          author: null,
          imageUrl: null,
          value: null,
          url: null,
        },
      ],
    }),
    makeSection('cursos', SiteSectionType.Courses, {
      title: 'Nuestros cursos',
      subtitle: 'Elija el que mejor encaje con lo que necesita.',
    }),
    makeSection('categorias', SiteSectionType.Categories, {
      enabled: false,
      title: 'Áreas de formación',
    }),
    makeSection('cifras', SiteSectionType.Stats, {
      enabled: false,
      title: null,
      items: [
        { title: 'Alumnado formado', value: '+500', body: null, author: null, imageUrl: null, icon: null, url: null },
        { title: 'Horas de contenido', value: '120', body: null, author: null, imageUrl: null, icon: null, url: null },
        { title: 'Valoración media', value: '4,8/5', body: null, author: null, imageUrl: null, icon: null, url: null },
      ],
      style: style({ background: 'brand', align: 'center' }),
    }),
    makeSection('sobre-nosotros', SiteSectionType.About, {
      title: `Sobre ${tenantName}`,
      body:
        'Cuente aquí quiénes son, a qué se dedican y por qué alguien debería formarse ' +
        'con ustedes. Dos o tres párrafos bastan.',
    }),
    makeSection('testimonios', SiteSectionType.Testimonials, {
      enabled: false,
      title: 'Lo que dicen quienes ya han estudiado con nosotros',
      items: [
        {
          title: 'Un antes y un después en mi trabajo',
          body: 'Sustituya este texto por un testimonio real de su alumnado.',
          author: 'Nombre y cargo',
          imageUrl: null,
          icon: null,
          value: null,
          url: null,
        },
      ],
    }),
    makeSection('preguntas', SiteSectionType.Faq, {
      enabled: false,
      title: 'Preguntas frecuentes',
      items: [
        {
          title: '¿Cómo me matriculo?',
          body: 'Elija el curso, pulse en él y complete la compra. El acceso es inmediato.',
          author: null,
          imageUrl: null,
          icon: null,
          value: null,
          url: null,
        },
      ],
    }),
    makeSection('contacto', SiteSectionType.Contact, {
      title: '¿Hablamos?',
      subtitle: 'Escríbanos y le resolvemos cualquier duda.',
    }),
  ];
}

/**
 * Página de venta por defecto de un curso.
 *
 * Se compone con los datos que ya tiene el curso —gancho, viñetas, vídeo,
 * temario— en lugar de dejarla vacía: un curso recién publicado ya vende, y
 * quien quiera afinarla la edita sección a sección desde el mismo editor que
 * la página de la empresa.
 *
 * No se guarda: se calcula al vuelo cuando el curso no tiene página propia.
 * Guardarla obligaría a migrar todos los cursos cada vez que mejore la maqueta.
 */
export function defaultLandingSections(course: {
  title: string;
  headline?: string | null;
  promoVideoUrl?: string | null;
}): SiteSection[] {
  return [
    makeSection('portada', SiteSectionType.Hero, {
      title: course.title,
      subtitle: course.headline ?? null,
      ctaLabel: 'Comprar el curso',
      ctaUrl: '#comprar',
      style: style({ background: 'soft', spacing: 'roomy' }),
    }),
    makeSection('aprenderas', SiteSectionType.Features, {
      title: 'Lo que vas a aprender',
      style: style({ columns: 2 }),
    }),
    ...(course.promoVideoUrl
      ? [
          makeSection('presentacion', SiteSectionType.Video, {
            title: 'Presentación del curso',
            videoUrl: course.promoVideoUrl,
            style: style({ align: 'center' }),
          }),
        ]
      : []),
    makeSection('temario', SiteSectionType.Curriculum, {
      title: 'Temario',
      subtitle: 'Todo lo que incluye la formación.',
    }),
    makeSection('profesorado', SiteSectionType.Instructor, { title: 'Quién imparte el curso' }),
    makeSection('comprar', SiteSectionType.Pricing, {
      title: 'Empieza hoy',
      subtitle: 'Acceso inmediato en cuanto se confirme el pago.',
      style: style({ background: 'soft', align: 'center' }),
    }),
  ];
}
