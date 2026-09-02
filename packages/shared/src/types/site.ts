/**
 * Página pública de la empresa: el escaparate donde ofrece sus cursos.
 *
 * El diseño se compone eligiendo una plantilla y ordenando secciones dentro de
 * ella. Es deliberadamente un punto intermedio entre elegir un tema cerrado y
 * un constructor libre: la empresa decide qué contar y en qué orden, pero no
 * puede dejar la página rota ni ilegible, porque la plantilla sigue mandando
 * sobre la tipografía, el ritmo vertical y el comportamiento en móvil.
 */

/** Aspecto general de la página. Cambia la maqueta, no el contenido. */
export enum SiteTemplate {
  /** Portada amplia con imagen y secciones a todo lo ancho. */
  Classic = 'classic',
  /** Sobria y compacta, pensada para catálogos grandes. */
  Focus = 'focus',
  /** Todo en tarjetas, con el catálogo como protagonista desde arriba. */
  Grid = 'grid',
}

export enum SiteSectionType {
  Hero = 'hero',
  Courses = 'courses',
  Categories = 'categories',
  About = 'about',
  Testimonials = 'testimonials',
  Faq = 'faq',
  Contact = 'contact',
  Cta = 'cta',
  /** Un vídeo de presentación, alojado fuera (YouTube o Vimeo). */
  Video = 'video',
  /** Rejilla de ventajas con icono, título y texto. */
  Features = 'features',
  /** Cifras que respaldan la oferta: alumnado, horas, valoración. */
  Stats = 'stats',
  /** Pasos numerados: cómo funciona la formación. */
  Steps = 'steps',
  /** Galería de imágenes. */
  Gallery = 'gallery',
  /** Ficha de quien imparte el curso. Solo en la página de venta de un curso. */
  Instructor = 'instructor',
  /** Temario resumido del curso. Solo en la página de venta de un curso. */
  Curriculum = 'curriculum',
  /** Bloque de compra con el precio y el botón de pago. */
  Pricing = 'pricing',
  /** Texto libre con formato. */
  RichText = 'richtext',
}

/**
 * Ajustes de aspecto de una sección.
 *
 * Son cuatro decisiones cerradas y no CSS libre: quien diseña su página elige
 * entre opciones que la plantilla sabe pintar bien en cualquier anchura, de
 * modo que no hay forma de dejar la página rota desde el editor.
 */
export interface SiteSectionStyle {
  /** Fondo del bloque. `image` usa `imageUrl` como fondo a pantalla completa. */
  background: 'plain' | 'soft' | 'brand' | 'dark' | 'image';
  align: 'start' | 'center';
  /** Aire vertical. */
  spacing: 'compact' | 'normal' | 'roomy';
  /** Columnas de las rejillas (ventajas, cifras, galería, testimonios). */
  columns: 2 | 3 | 4;
}

export const DEFAULT_SECTION_STYLE: SiteSectionStyle = {
  background: 'plain',
  align: 'start',
  spacing: 'normal',
  columns: 3,
};

/** Elemento repetible dentro de una sección: un testimonio, una pregunta… */
export interface SiteSectionItem {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  /** Autor del testimonio, o su cargo. Solo lo usan los testimonios. */
  author?: string | null;
  /** Nombre de icono del catálogo de la aplicación. Ventajas y pasos. */
  icon?: string | null;
  /** Cifra destacada («+1.200», «4,8/5»). Solo las estadísticas. */
  value?: string | null;
  /** Enlace propio del elemento, cuando la tarjeta lleva a algún sitio. */
  url?: string | null;
}

/**
 * Una sección de la página.
 *
 * Todos los tipos comparten esta forma y cada uno usa los campos que le
 * sirven: el editor solo muestra los que aplican. Un tipo por sección con sus
 * propios campos sería más estricto, pero obligaría a tocar el contrato, la
 * base de datos y el editor cada vez que se añada una sección nueva.
 */
export interface SiteSection {
  id: string;
  type: SiteSectionType;
  enabled: boolean;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  items?: SiteSectionItem[];
  /** Cuántos cursos mostrar. Solo en las secciones de catálogo. */
  limit?: number | null;
  /** Segundo botón, secundario, junto al principal. */
  ctaSecondaryLabel?: string | null;
  ctaSecondaryUrl?: string | null;
  /** Dirección del vídeo (YouTube o Vimeo) de la portada o del bloque de vídeo. */
  videoUrl?: string | null;
  /** Aspecto del bloque. Ausente equivale a `DEFAULT_SECTION_STYLE`. */
  style?: SiteSectionStyle | null;
}

export interface SiteSeo {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

export interface SiteContact {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
}

export interface TenantSiteDto {
  id: string;
  published: boolean;
  template: SiteTemplate;
  sections: SiteSection[];
  seo: SiteSeo;
  contact: SiteContact;
  updatedAt: string;
}

/** Datos de venta de un curso. Viven aparte del curso lectivo a propósito. */
export interface CourseCatalog {
  /** Si no está marcado, el curso no aparece en la página pública. */
  listed: boolean;
  /** En céntimos, para no arrastrar decimales. 0 es gratuito. */
  priceCents: number;
  currency: string;
  /** Frase gancho, distinta del resumen académico. */
  headline?: string | null;
  /** «Lo que aprenderás»: viñetas cortas. */
  highlights?: string[];
  level?: string | null;
  durationHours?: number | null;
  /** Precio tachado: si es mayor que `priceCents`, se muestra la rebaja. */
  compareAtPriceCents?: number | null;
  /** Vídeo de presentación que se ve sin haber comprado. */
  promoVideoUrl?: string | null;
  /** Qué hace falta saber antes de empezar. */
  requirements?: string[];
  /** A quién va dirigido. */
  audience?: string[];
  instructorName?: string | null;
  instructorRole?: string | null;
  instructorBio?: string | null;
  instructorAvatarUrl?: string | null;
  /** Valoración media sobre 5 y número de opiniones, para la ficha de venta. */
  ratingAverage?: number | null;
  ratingCount?: number | null;
  /** Si la formación entrega certificado al terminar. */
  certificate?: boolean;
  /** Página de venta propia del curso. Vacía usa la maqueta por defecto. */
  landing?: SiteSection[];
}

/** Curso tal como se ve desde fuera, sin nada de la parte lectiva. */
export interface PublicCourseDto {
  id: string;
  /** Referencia legible para la dirección pública; es el nombre corto. */
  slug: string;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  tags: string[];
  catalog: CourseCatalog;
  enrolledCount: number;
}

/** Todo lo que necesita la página pública, en una sola petición. */
export interface PublicSiteDto {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    accentColor?: string | null;
  };
  site: TenantSiteDto;
  courses: PublicCourseDto[];
  categories: { id: string; name: string; courseCount: number }[];
}

/* ------------------------ Contenido de una lección ------------------------ */

export enum LessonBlockType {
  /** Texto con formato: títulos, listas, enlaces, negritas. */
  Text = 'text',
  Image = 'image',
  /** Vídeo o audio subido a la plataforma. */
  Media = 'media',
  /** Vídeo alojado fuera (YouTube, Vimeo). */
  Embed = 'embed',
  /** Un aviso destacado: recordatorio, advertencia, consejo. */
  Callout = 'callout',
  Quote = 'quote',
  /** Código con tipografía monoespaciada. */
  Code = 'code',
  /** Descarga de un fichero adjunto. */
  File = 'file',
  Divider = 'divider',
}

/**
 * Un bloque de la lección.
 *
 * La lección se guarda como una lista de bloques en lugar de un único HTML
 * porque lo que se quiere es poder **mover** un vídeo o un párrafo a otro
 * sitio. Con un solo HTML eso obliga a cortar y pegar marcas a mano; con
 * bloques, es subir y bajar.
 *
 * Cada tipo usa los campos que le sirven y deja el resto vacíos: un tipo por
 * bloque sería más estricto pero obligaría a tocar contrato, base de datos y
 * editor cada vez que se añada uno nuevo.
 */
export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  /** Texto con formato (Text), pie de imagen, cuerpo del aviso o código. */
  content?: string | null;
  /** Dirección del medio, la imagen, el vídeo externo o el fichero. */
  url?: string | null;
  /** Título del aviso, alternativa de la imagen o autor de la cita. */
  title?: string | null;
  /** Matiz del aviso: información, acierto, advertencia. */
  variant?: 'info' | 'success' | 'warning' | null;
  /** Tipo del medio, para decidir entre vídeo y audio. */
  mimeType?: string | null;
  /** Nombre del fichero descargable. */
  filename?: string | null;
}

export enum EnrolmentRequestStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export interface EnrolmentRequestDto {
  id: string;
  course: { id: string; title: string };
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  status: EnrolmentRequestStatus;
  /** Anotación de quien la resolvió, visible solo en administración. */
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta al enviar una solicitud desde la página pública. */
export interface EnrolmentRequestResult {
  /** `true` cuando el curso era gratuito y la matrícula se hizo al momento. */
  enrolled: boolean;
  status: EnrolmentRequestStatus;
  message: string;
}

/* --------------------- Página de venta de un curso ------------------------ */

/** Una unidad del temario, tal como se enseña antes de comprar. */
export interface PublicCurriculumItem {
  title: string;
  /** Tipo de módulo, para el icono: `page`, `quiz`, `assign`… */
  type: string;
  /** `true` si el material se puede ver sin haber comprado. */
  preview: boolean;
}

export interface PublicCurriculumSection {
  title: string;
  items: PublicCurriculumItem[];
}

/**
 * Ficha de venta de un curso concreto.
 *
 * Va aparte de `PublicSiteDto` porque es otra página con otro público: quien
 * llega aquí ya ha elegido curso y lo que necesita es el temario, el precio y
 * el botón de compra, no el catálogo entero de la empresa.
 */
export interface PublicCourseDetailDto {
  tenant: PublicSiteDto['tenant'];
  /** Plantilla y datos de contacto, para que cabecera y pie sean los mismos. */
  site: { template: SiteTemplate; contact: SiteContact; seo: SiteSeo };
  course: PublicCourseDto;
  /** Secciones de la página de venta, ya resueltas (propias o por defecto). */
  landing: SiteSection[];
  curriculum: PublicCurriculumSection[];
  /** Otros cursos de la misma empresa, para no dejar la página sin salida. */
  related: PublicCourseDto[];
}
