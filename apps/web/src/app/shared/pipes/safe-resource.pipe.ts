import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Reproductores admitidos. Nada fuera de esta lista llega a un marco. */
const PERMITIDOS = [
  'https://www.youtube.com/embed/',
  'https://www.youtube-nocookie.com/embed/',
  'https://player.vimeo.com/video/',
];

/**
 * Marca una dirección como apta para el `src` de un `<iframe>`.
 *
 * Angular bloquea las direcciones dinámicas en un marco, y con razón: ahí cabe
 * `javascript:` y cualquier página ajena. Por eso no basta con marcarla como
 * confiable, hay que comprobar antes que apunta a un reproductor conocido; una
 * dirección que no lo sea devuelve vacío y el marco se queda en blanco en vez
 * de cargar lo que sea.
 */
@Pipe({ name: 'safeResource' })
export class SafeResourcePipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(url: string | null | undefined): SafeResourceUrl | null {
    if (!url) return null;
    if (!PERMITIDOS.some((permitido) => url.startsWith(permitido))) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
