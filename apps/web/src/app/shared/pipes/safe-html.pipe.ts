import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sanitizeHtml } from '@maya/shared';

/**
 * Renderiza contenido enriquecido creado por el profesorado. Aplica el mismo
 * saneado que la API antes de entregarlo al sanitizador de Angular.
 */
@Pipe({ name: 'safeHtml' })
export class SafeHtmlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeHtml(value));
  }
}
