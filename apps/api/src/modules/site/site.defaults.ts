import { SiteSectionType, SiteTemplate } from '@maya/shared';
import type { SiteSection } from '@maya/shared';

/**
 * Página de partida.
 *
 * Se crea con contenido de ejemplo y no vacía a propósito: una página en blanco
 * no enseña qué se puede hacer con ella, y obliga a imaginar el resultado antes
 * de ver nada. Con secciones ya puestas, editar es cambiar textos, que es una
 * tarea mucho más fácil que construir desde cero.
 */
export function defaultSections(tenantName: string): SiteSection[] {
  return [
    {
      id: 'hero',
      type: SiteSectionType.Hero,
      enabled: true,
      title: `Formación en ${tenantName}`,
      subtitle: 'Aprenda a su ritmo, con acompañamiento de nuestro equipo docente.',
      body: null,
      imageUrl: null,
      ctaLabel: 'Ver los cursos',
      ctaUrl: '#cursos',
      items: [],
      limit: null,
    },
    {
      id: 'cursos',
      type: SiteSectionType.Courses,
      enabled: true,
      title: 'Nuestros cursos',
      subtitle: 'Elija el que mejor encaje con lo que necesita.',
      body: null,
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [],
      limit: null,
    },
    {
      id: 'categorias',
      type: SiteSectionType.Categories,
      enabled: false,
      title: 'Áreas de formación',
      subtitle: null,
      body: null,
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [],
      limit: null,
    },
    {
      id: 'sobre-nosotros',
      type: SiteSectionType.About,
      enabled: true,
      title: `Sobre ${tenantName}`,
      subtitle: null,
      body:
        'Cuente aquí quiénes son, a qué se dedican y por qué alguien debería formarse ' +
        'con ustedes. Dos o tres párrafos bastan.',
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [],
      limit: null,
    },
    {
      id: 'testimonios',
      type: SiteSectionType.Testimonials,
      enabled: false,
      title: 'Lo que dicen quienes ya han estudiado con nosotros',
      subtitle: null,
      body: null,
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [
        {
          title: 'Un antes y un después en mi trabajo',
          body: 'Sustituya este texto por un testimonio real de su alumnado.',
          author: 'Nombre y cargo',
          imageUrl: null,
        },
      ],
      limit: null,
    },
    {
      id: 'preguntas',
      type: SiteSectionType.Faq,
      enabled: false,
      title: 'Preguntas frecuentes',
      subtitle: null,
      body: null,
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [
        {
          title: '¿Cómo me matriculo?',
          body: 'Elija el curso y pulse «Solicitar plaza». Nos pondremos en contacto.',
          author: null,
          imageUrl: null,
        },
      ],
      limit: null,
    },
    {
      id: 'contacto',
      type: SiteSectionType.Contact,
      enabled: true,
      title: '¿Hablamos?',
      subtitle: 'Escríbanos y le resolvemos cualquier duda.',
      body: null,
      imageUrl: null,
      ctaLabel: null,
      ctaUrl: null,
      items: [],
      limit: null,
    },
  ];
}

export const DEFAULT_TEMPLATE = SiteTemplate.Classic;
