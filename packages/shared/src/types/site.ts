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
}

/** Elemento repetible dentro de una sección: un testimonio, una pregunta… */
export interface SiteSectionItem {
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  /** Autor del testimonio, o su cargo. Solo lo usan los testimonios. */
  author?: string | null;
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
}

/** Curso tal como se ve desde fuera, sin nada de la parte lectiva. */
export interface PublicCourseDto {
  id: string;
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
