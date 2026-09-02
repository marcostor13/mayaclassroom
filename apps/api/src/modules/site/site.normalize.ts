import { DEFAULT_SECTION_STYLE } from '@maya/shared';
import type { SiteSectionSchema } from './schemas/tenant-site.schema';
import type { SiteSectionDto } from './dto/site.dto';

/**
 * Pasa una sección del editor a la forma que se guarda.
 *
 * Un campo que el editor no envía es un campo que se vacía, no uno que se
 * conserva: `undefined` en Mongoose deja el valor anterior, y al desactivar un
 * subtítulo volvería a aparecer el de antes.
 *
 * Vive fuera del servicio porque lo usan dos: la página de la empresa y la
 * página de venta de cada curso, que guardan la misma clase de secciones.
 */
export function normalizeSection(section: SiteSectionDto): SiteSectionSchema {
  return {
    id: section.id,
    type: section.type,
    enabled: section.enabled,
    title: section.title ?? null,
    subtitle: section.subtitle ?? null,
    body: section.body ?? null,
    imageUrl: section.imageUrl ?? null,
    ctaLabel: section.ctaLabel ?? null,
    ctaUrl: section.ctaUrl ?? null,
    ctaSecondaryLabel: section.ctaSecondaryLabel ?? null,
    ctaSecondaryUrl: section.ctaSecondaryUrl ?? null,
    videoUrl: section.videoUrl ?? null,
    items: (section.items ?? []).map((item) => ({
      title: item.title,
      body: item.body ?? null,
      imageUrl: item.imageUrl ?? null,
      author: item.author ?? null,
      icon: item.icon ?? null,
      value: item.value ?? null,
      url: item.url ?? null,
    })),
    limit: section.limit ?? null,
    style: { ...DEFAULT_SECTION_STYLE, ...(section.style ?? {}) },
  };
}

/**
 * El identificador de sección es el ancla del enlace («#cursos») y la clave de
 * `track` al reordenar en el editor. Repetido, el navegador salta a la primera
 * y el editor mezcla dos secciones al arrastrar.
 */
export function assertUniqueSectionIds(ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Hay dos secciones con el identificador «${id}».`);
    }
    seen.add(id);
  }
}
