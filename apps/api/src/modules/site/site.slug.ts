/**
 * Referencia legible de un curso en la dirección pública.
 *
 * Se deriva del nombre corto en vez de guardarse: el nombre corto ya es único
 * por empresa y obligatorio, así que un campo aparte sería una segunda fuente
 * de verdad que se desincroniza en cuanto alguien renombra el curso.
 */
export function courseSlug(shortName: string): string {
  return shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
