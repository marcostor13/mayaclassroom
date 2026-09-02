import { DEFAULT_SECTION_STYLE, SiteSectionType } from '@maya/shared';
import type { SiteSection, SiteSectionItem } from '@maya/shared';

/** Campos que un bloque usa de verdad. El inspector solo enseña estos. */
export type CampoBloque =
  | 'title'
  | 'subtitle'
  | 'body'
  | 'image'
  | 'video'
  | 'cta'
  | 'ctaSecondary'
  | 'limit'
  | 'items';

/** Campos de cada elemento repetible, según el bloque que lo contiene. */
export type CampoElemento = 'title' | 'body' | 'author' | 'icon' | 'value' | 'image' | 'url';

export interface DefinicionBloque {
  type: SiteSectionType;
  label: string;
  hint: string;
  icon: string;
  campos: CampoBloque[];
  /** Solo para los elementos repetibles. */
  elemento?: {
    singular: string;
    campos: CampoElemento[];
  };
  /** `true` cuando el bloque solo tiene sentido en la ficha de un curso. */
  soloCurso?: boolean;
  /** `true` cuando solo tiene sentido en la página de la empresa. */
  soloEmpresa?: boolean;
}

/**
 * Catálogo de bloques.
 *
 * Es una tabla y no una serie de componentes por tipo a propósito: el inspector
 * se genera a partir de ella, de modo que añadir un bloque nuevo es añadir una
 * fila aquí y un `@case` en el renderizador, sin tocar el editor.
 */
export const BLOQUES: readonly DefinicionBloque[] = [
  {
    type: SiteSectionType.Hero,
    label: 'Portada',
    hint: 'El primer bloque: titular, frase, botón y una imagen o vídeo.',
    icon: 'sparkles',
    campos: ['title', 'subtitle', 'image', 'video', 'cta', 'ctaSecondary'],
  },
  {
    type: SiteSectionType.Courses,
    label: 'Catálogo de cursos',
    hint: 'Los cursos a la venta, con su precio y su ficha.',
    icon: 'layers',
    campos: ['title', 'subtitle', 'limit'],
    soloEmpresa: true,
  },
  {
    type: SiteSectionType.Features,
    label: 'Ventajas',
    hint: 'Rejilla con icono, título y texto. En un curso se rellena sola.',
    icon: 'check',
    campos: ['title', 'subtitle', 'items'],
    elemento: { singular: 'Ventaja', campos: ['icon', 'title', 'body'] },
  },
  {
    type: SiteSectionType.Video,
    label: 'Vídeo',
    hint: 'Un vídeo de YouTube o Vimeo a todo lo ancho.',
    icon: 'play-circle',
    campos: ['title', 'subtitle', 'video'],
  },
  {
    type: SiteSectionType.Stats,
    label: 'Cifras',
    hint: 'Alumnado formado, horas, valoración… Lo que dé confianza.',
    icon: 'trending-up',
    campos: ['title', 'items'],
    elemento: { singular: 'Cifra', campos: ['value', 'title'] },
  },
  {
    type: SiteSectionType.Steps,
    label: 'Cómo funciona',
    hint: 'Pasos numerados: qué ocurre después de matricularse.',
    icon: 'route',
    campos: ['title', 'subtitle', 'items'],
    elemento: { singular: 'Paso', campos: ['title', 'body'] },
  },
  {
    type: SiteSectionType.Curriculum,
    label: 'Temario',
    hint: 'Los temas del curso, con su material. Se rellena solo.',
    icon: 'list-checks',
    campos: ['title', 'subtitle'],
    soloCurso: true,
  },
  {
    type: SiteSectionType.Instructor,
    label: 'Profesorado',
    hint: 'Quién imparte el curso. Toma los datos de la ficha del curso.',
    icon: 'user-check',
    campos: ['title', 'subtitle', 'body'],
    soloCurso: true,
  },
  {
    type: SiteSectionType.Pricing,
    label: 'Compra',
    hint: 'El precio y el botón de pago.',
    icon: 'credit-card',
    campos: ['title', 'subtitle', 'cta'],
    soloCurso: true,
  },
  {
    type: SiteSectionType.Testimonials,
    label: 'Testimonios',
    hint: 'Opiniones de quien ya se ha formado con usted.',
    icon: 'message-square',
    campos: ['title', 'subtitle', 'items'],
    elemento: { singular: 'Testimonio', campos: ['title', 'body', 'author'] },
  },
  {
    type: SiteSectionType.Categories,
    label: 'Áreas de formación',
    hint: 'Las categorías que tienen cursos publicados.',
    icon: 'grid',
    campos: ['title', 'subtitle'],
    soloEmpresa: true,
  },
  {
    type: SiteSectionType.Gallery,
    label: 'Galería',
    hint: 'Imágenes del aula, del equipo o del material.',
    icon: 'img',
    campos: ['title', 'items'],
    elemento: { singular: 'Imagen', campos: ['image', 'title'] },
  },
  {
    type: SiteSectionType.About,
    label: 'Sobre nosotros',
    hint: 'Un texto libre contando quién está detrás.',
    icon: 'building',
    campos: ['title', 'subtitle', 'body'],
  },
  {
    type: SiteSectionType.RichText,
    label: 'Texto con formato',
    hint: 'Párrafos, listas y enlaces con el editor de siempre.',
    icon: 'file-text',
    campos: ['title', 'body'],
  },
  {
    type: SiteSectionType.Faq,
    label: 'Preguntas frecuentes',
    hint: 'Las dudas que frenan la compra, resueltas antes de que las pregunten.',
    icon: 'help-circle',
    campos: ['title', 'subtitle', 'items'],
    elemento: { singular: 'Pregunta', campos: ['title', 'body'] },
  },
  {
    type: SiteSectionType.Cta,
    label: 'Llamada a la acción',
    hint: 'Un bloque destacado con un botón grande.',
    icon: 'zap',
    campos: ['title', 'subtitle', 'cta', 'ctaSecondary'],
  },
  {
    type: SiteSectionType.Contact,
    label: 'Contacto',
    hint: 'Correo, teléfono y dirección de la empresa.',
    icon: 'mail',
    campos: ['title', 'subtitle'],
    soloEmpresa: true,
  },
];

export function definicion(type: SiteSectionType): DefinicionBloque {
  return (
    BLOQUES.find((bloque) => bloque.type === type) ?? {
      type,
      label: type,
      hint: '',
      icon: 'layers',
      campos: ['title', 'subtitle', 'body'],
    }
  );
}

/** Iconos que se ofrecen para las ventajas y los pasos. */
export const ICONOS_BLOQUE = [
  'check',
  'star',
  'award',
  'clock',
  'target',
  'zap',
  'heart',
  'shield-check',
  'users',
  'message-square',
  'book-open',
  'play-circle',
  'graduation-cap',
  'trending-up',
  'globe',
  'sparkles',
] as const;

let contador = 0;

/**
 * Identificador de sección nuevo.
 *
 * Se deriva del tipo —`ventajas`, `ventajas-2`— y no de un aleatorio porque es
 * también el ancla del enlace: `#ventajas` se puede escribir en un botón, y un
 * identificador ilegible no serviría para eso.
 */
export function nuevoId(type: SiteSectionType, existentes: string[]): string {
  const base = definicion(type)
    .label.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!existentes.includes(base)) return base;
  contador += 1;
  let candidato = `${base}-${contador}`;
  while (existentes.includes(candidato)) {
    contador += 1;
    candidato = `${base}-${contador}`;
  }
  return candidato;
}

/** Elemento repetible recién creado, con todos los campos puestos. */
export function nuevoElemento(definition: DefinicionBloque): SiteSectionItem {
  return {
    title: definition.elemento?.singular ?? 'Nuevo',
    body: null,
    imageUrl: null,
    author: null,
    icon: definition.elemento?.campos.includes('icon') ? 'check' : null,
    value: definition.elemento?.campos.includes('value') ? '100' : null,
    url: null,
  };
}

/**
 * Bloque nuevo, con contenido de ejemplo.
 *
 * Se crea relleno y no vacío por la misma razón que la página de partida: un
 * bloque en blanco no enseña para qué sirve, y sustituir un texto es mucho más
 * fácil que inventarlo delante de un hueco.
 */
export function nuevaSeccion(type: SiteSectionType, existentes: string[]): SiteSection {
  const def = definicion(type);
  const base: SiteSection = {
    id: nuevoId(type, existentes),
    type,
    enabled: true,
    title: def.label,
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
  };

  if (def.campos.includes('items') && def.elemento) {
    base.items = [nuevoElemento(def), nuevoElemento(def), nuevoElemento(def)];
  }
  if (def.campos.includes('cta')) {
    base.ctaLabel = 'Ver los cursos';
    base.ctaUrl = '#cursos';
  }
  if (def.campos.includes('body')) {
    base.body = 'Escriba aquí su texto.';
  }
  if (type === SiteSectionType.Hero) {
    base.title = 'Un titular que diga qué se aprende';
    base.subtitle = 'Y una frase corta que explique a quién va dirigido.';
  }

  return base;
}
