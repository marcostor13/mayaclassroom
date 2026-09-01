import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/** Grosor de trazo por defecto de los iconos de contorno. */
const STROKE = 1.8;

/**
 * Conjunto de iconos SVG en línea (rejilla de 24 px, trazo redondeado) para no
 * depender de fuentes externas ni peticiones adicionales.
 *
 * Cada icono existe en contorno y, para los que participan en la navegación,
 * también en versión rellena: alternar entre ambas al marcar el elemento
 * activo es lo que da a la barra inferior su aspecto de app nativa.
 */
@Component({
  selector: 'maya-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      [attr.fill]="isFilled() ? 'currentColor' : 'none'"
      [attr.stroke]="isFilled() ? 'none' : 'currentColor'"
      [attr.stroke-width]="isFilled() ? null : strokeWidth()"
      [attr.fill-rule]="isFilled() ? 'evenodd' : null"
      stroke-linecap="round"
      stroke-linejoin="round"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label()"
      [innerHTML]="path()"
    ></svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input<number>(20);
  readonly label = input<string | null>(null);
  /** `solid` usa la versión rellena cuando el icono la tiene. */
  readonly variant = input<'outline' | 'solid'>('outline');
  /** Permite engrosar el trazo en iconos grandes (héroes, estados vacíos). */
  readonly strokeWidth = input<number>(STROKE);

  /** Verdadero solo si se pidió relleno *y* el icono ofrece esa versión. */
  readonly isFilled = computed(
    () => this.variant() === 'solid' && this.name() in SOLID_ICONS,
  );

  private readonly sanitizer = inject(DomSanitizer);

  /**
   * El sanitizador de Angular no admite elementos SVG en `[innerHTML]`: borra
   * `<path>`, `<circle>` y compañía, y el icono queda vacío. Aquí el marcado
   * son literales constantes de este mismo fichero —`name` sólo elige una
   * clave de un mapa cerrado, nunca se interpola nada de fuera— así que
   * marcarlo como confiable es seguro y es la única forma de pintarlo.
   */
  readonly path = computed<SafeHtml>(() => trusted(this.sanitizer, this.name(), this.variant()));
}

/** ¿Existe versión rellena para este icono? */
export function hasSolidIcon(name: string): boolean {
  return name in SOLID_ICONS;
}

/**
 * Marcado confiable de cada icono, memorizado: en una pantalla se repite el
 * mismo icono decenas de veces y el objeto debe ser estable, o `[innerHTML]`
 * vuelve a escribir en el DOM en cada detección de cambios.
 */
const TRUSTED = new Map<string, SafeHtml>();

function trusted(
  sanitizer: DomSanitizer,
  name: string,
  variant: 'outline' | 'solid',
): SafeHtml {
  const solid = variant === 'solid' && name in SOLID_ICONS;
  const key = `${solid ? 'solid' : 'outline'}:${name}`;

  let markup = TRUSTED.get(key);
  if (!markup) {
    markup = sanitizer.bypassSecurityTrustHtml(
      solid ? SOLID_ICONS[name] : (ICONS[name] ?? ICONS['circle']),
    );
    TRUSTED.set(key, markup);
  }
  return markup;
}

/* Cada entrada contiene solo el contenido interno del `<svg>`. */
const ICONS: Record<string, string> = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  home: '<path d="m3 10.2 8.4-6.6a1 1 0 0 1 1.2 0L21 10.2"/><path d="M5 9.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5"/><path d="M9.5 21v-5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V21"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2.4"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.4"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.4"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  'book-open': '<path d="M12 7.5v13"/><path d="M3 18.5a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1h5a4 4 0 0 1 4 3.7 4 4 0 0 1 4-3.7h5a1 1 0 0 1 1 1v12.7a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 2.5 3 3 0 0 0-3-2.5z"/>',
  'book-a': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H18a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="m9.4 13.5 2-5.2 2 5.2"/><path d="M10 11.9h2.8"/>',
  users: '<path d="M16 21v-1.8a4 4 0 0 0-4-4H6.5a4 4 0 0 0-4 4V21"/><circle cx="9.25" cy="7.5" r="3.75"/><path d="M21.5 21v-1.8a4 4 0 0 0-3-3.85"/><path d="M15.5 3.9a3.75 3.75 0 0 1 0 7.2"/>',
  'users-round': '<path d="M17.5 21a7 7 0 0 0-13 0"/><circle cx="11" cy="8" r="4.5"/><path d="M21.5 20.2c-.3-2.9-1.9-5.4-3.6-6.7a4.5 4.5 0 0 0-.5-7.4"/>',
  'user-check': '<path d="M15 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21"/><circle cx="8.5" cy="7.5" r="3.75"/><path d="m16 12.6 2 2 4-4"/>',
  user: '<path d="M19 21v-2a4.5 4.5 0 0 0-4.5-4.5h-5A4.5 4.5 0 0 0 5 19v2"/><circle cx="12" cy="7.25" r="4.25"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="17" rx="4"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/><path d="M8.5 14h.01M12 14h.01M15.5 14h.01M8.5 17.5h.01M12 17.5h.01"/>',
  bell: '<path d="M10.3 20.5a2 2 0 0 0 3.4 0"/><path d="M4.2 14.9A1 1 0 0 0 5 16.5h14a1 1 0 0 0 .8-1.6C18.7 13.5 18 12.2 18 9a6 6 0 0 0-12 0c0 3.2-.7 4.5-1.8 5.9z"/>',
  'message-square': '<path d="M20.5 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-3.6 3.2a.6.6 0 0 1-1-.45V6.5A2.5 2.5 0 0 1 5.9 4h12.1a2.5 2.5 0 0 1 2.5 2.5z"/>',
  'messages-square': '<path d="M14 9a2 2 0 0 1-2 2H6l-3.4 3.1a.5.5 0 0 1-.85-.37V4a2 2 0 0 1 2-2h8.2a2 2 0 0 1 2 2z"/><path d="M18 9h1.9a2 2 0 0 1 2 2v10.7a.5.5 0 0 1-.85.37L18 19h-6a2 2 0 0 1-2-2v-1"/>',
  'clipboard-check': '<rect x="8.5" y="2" width="7" height="4" rx="1.8"/><path d="M15.5 4h2A2.5 2.5 0 0 1 20 6.5v13A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-13A2.5 2.5 0 0 1 6.5 4h2"/><path d="m9 13.8 2.1 2.1 4-4"/>',
  'clipboard-list': '<rect x="8.5" y="2" width="7" height="4" rx="1.8"/><path d="M15.5 4h2A2.5 2.5 0 0 1 20 6.5v13A2.5 2.5 0 0 1 17.5 22h-11A2.5 2.5 0 0 1 4 19.5v-13A2.5 2.5 0 0 1 6.5 4h2"/><path d="M11.5 11.5h4M11.5 16h4M8 11.5h.01M8 16h.01"/>',
  'list-checks': '<path d="m3 16.8 1.8 1.8 3.6-3.6"/><path d="m3 7 1.8 1.8L8.4 5.2"/><path d="M12.5 6.8h8.5M12.5 12h8.5M12.5 17.2h8.5"/>',
  'help-circle': '<circle cx="12" cy="12" r="9.25"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6.9c0 1.9-2.8 2.5-2.8 3.8"/><path d="M12 17.2h.01"/>',
  award: '<circle cx="12" cy="8.5" r="5.75"/><path d="m15.4 13.2 1.4 8-4.8-2.7-4.8 2.7 1.4-8"/>',
  'graduation-cap': '<path d="M21.5 10.4v5.6"/><path d="M6.2 12.6v3.6c0 1.1 2.6 2.7 5.8 2.7s5.8-1.6 5.8-2.7v-3.6"/><path d="m2.5 10.4 9.5-4.6 9.5 4.6-9.5 4.6z"/>',
  chart: '<path d="M3.5 3.5v14.2a2.8 2.8 0 0 0 2.8 2.8H20.5"/><path d="m7.5 15 3.2-4.2 3.1 2.9 4.2-6"/>',
  'bar-chart-3': '<path d="M3.5 3.5v14.2a2.8 2.8 0 0 0 2.8 2.8H20.5"/><rect x="7.5" y="12" width="3" height="5" rx="1.2"/><rect x="12.5" y="8.5" width="3" height="8.5" rx="1.2"/><rect x="17.5" y="5.5" width="3" height="11.5" rx="1.2"/>',
  'trending-up': '<path d="M21 6.5 13.6 14a1 1 0 0 1-1.4 0l-2.4-2.4a1 1 0 0 0-1.4 0L3 16.5"/><path d="M15.5 6.5H21v5.5"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  'sliders': '<path d="M4 6.5h9M17.5 6.5H20M4 17.5h3.5M12 17.5H20M4 12h13M21.5 12H20"/><circle cx="15" cy="6.5" r="2.3"/><circle cx="9.5" cy="17.5" r="2.3"/><circle cx="19" cy="12" r="2.3"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.1-4.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6.5 9.5 17 4 11.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'chevron-down': '<path d="m6 9.5 6 6 6-6"/>',
  'chevron-up': '<path d="m6 14.5 6-6 6 6"/>',
  'chevron-right': '<path d="m9.5 18 6-6-6-6"/>',
  'chevron-left': '<path d="m14.5 18-6-6 6-6"/>',
  'arrow-left': '<path d="m11.5 19-7-7 7-7"/><path d="M19.5 12h-15"/>',
  'arrow-right': '<path d="M4.5 12h15"/><path d="m12.5 5 7 7-7 7"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
  'log-out': '<path d="M9.5 21H6a2.5 2.5 0 0 1-2.5-2.5v-13A2.5 2.5 0 0 1 6 3h3.5"/><path d="m16.5 16.5 4.5-4.5-4.5-4.5"/><path d="M21 12H9.5"/>',
  moon: '<path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.75 8.75 0 1 0 10.8 10.8z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.2v2.1M12 19.7v2.1M4.1 4.1l1.5 1.5M18.4 18.4l1.5 1.5M2.2 12h2.1M19.7 12h2.1M5.6 18.4l-1.5 1.5M19.9 4.1l-1.5 1.5"/>',
  file: '<path d="M14.5 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V7.5z"/><path d="M14.5 2.5v4a1 1 0 0 0 1 1h4"/>',
  'file-text': '<path d="M14.5 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V7.5z"/><path d="M14.5 2.5v4a1 1 0 0 0 1 1h4"/><path d="M8.5 13h7M8.5 16.8h4.5"/>',
  folder: '<path d="M20 20.5a2.5 2.5 0 0 0 2.5-2.5V8.5A2.5 2.5 0 0 0 20 6h-7.2a1.5 1.5 0 0 1-1.25-.67l-.9-1.36a1.5 1.5 0 0 0-1.25-.67H4A2.5 2.5 0 0 0 1.5 5.8V18a2.5 2.5 0 0 0 2.5 2.5z"/>',
  link: '<path d="M10.2 13.3a4.6 4.6 0 0 0 6.95.5l2.6-2.6a4.6 4.6 0 0 0-6.5-6.5l-1.5 1.5"/><path d="M13.8 10.7a4.6 4.6 0 0 0-6.95-.5l-2.6 2.6a4.6 4.6 0 0 0 6.5 6.5l1.5-1.5"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4.5A2.5 2.5 0 0 0 2 4.5v6.7a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  upload: '<path d="M20.5 15.5V18a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-2.5"/><path d="m16.5 7.5-4.5-4.5-4.5 4.5"/><path d="M12 3v12.5"/>',
  download: '<path d="M20.5 15.5V18a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-2.5"/><path d="m7.5 11 4.5 4.5 4.5-4.5"/><path d="M12 15.5V3"/>',
  edit: '<path d="M11 4.5H6A2.5 2.5 0 0 0 3.5 7v11A2.5 2.5 0 0 0 6 20.5h11a2.5 2.5 0 0 0 2.5-2.5v-5"/><path d="M18.4 2.9a2.05 2.05 0 0 1 2.9 2.9L12.4 14.7l-3.8.9.9-3.8z"/>',
  trash: '<path d="M3.5 6h17"/><path d="M18.5 6v13a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 19V6m3.5 0V4.5A2 2 0 0 1 11 2.5h2a2 2 0 0 1 2 2V6"/><path d="M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="12.5" height="12.5" rx="3"/><path d="M5.5 15h-.5A2.5 2.5 0 0 1 2.5 12.5V5A2.5 2.5 0 0 1 5 2.5h7.5A2.5 2.5 0 0 1 15 5v.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.1"/>',
  'eye-off': '<path d="M10.7 5.6A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a13.4 13.4 0 0 1-1.9 2.7"/><path d="M6.4 6.9A13.3 13.3 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.5 9.5 0 0 0 5.1-1.5"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="m3 3 18 18"/>',
  lock: '<rect x="3.5" y="10.5" width="17" height="11" rx="3.2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/><path d="M12 15v2.5"/>',
  clock: '<circle cx="12" cy="12" r="9.25"/><path d="M12 6.8V12l3.4 1.9"/>',
  info: '<circle cx="12" cy="12" r="9.25"/><path d="M12 16.5v-4.8M12 8h.01"/>',
  alert: '<path d="m21.4 17.9-7.6-13.3a2.1 2.1 0 0 0-3.6 0L2.6 17.9A2 2 0 0 0 4.4 21h15.2a2 2 0 0 0 1.8-3.1z"/><path d="M12 9.5v4M12 17h.01"/>',
  star: '<path d="m12 3.2 2.75 5.6 6.15.9-4.45 4.35 1.05 6.15L12 17.3l-5.5 2.9 1.05-6.15L3.1 9.7l6.15-.9z"/>',
  heart: '<path d="M20.1 5.3a5.1 5.1 0 0 0-7.25 0L12 6.15l-.85-.85a5.13 5.13 0 0 0-7.25 7.25l.85.85L12 21l7.25-7.6.85-.85a5.1 5.1 0 0 0 0-7.25z"/>',
  building: '<rect x="4" y="2.5" width="16" height="19" rx="3"/><path d="M9.5 21.5v-3.75a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3.75"/><path d="M8.5 6.5h.01M15.5 6.5h.01M8.5 10.5h.01M15.5 10.5h.01M12 6.5h.01M12 10.5h.01"/>',
  shield: '<path d="M20 12.6c0 5-3.5 7.6-7.66 9a1 1 0 0 1-.67 0C7.5 20.2 4 17.6 4 12.6V6.15a1.1 1.1 0 0 1 1-1.1c2-.1 4.5-1.25 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 4.95 19 5.05a1.1 1.1 0 0 1 1 1.1z"/>',
  'shield-check': '<path d="M20 12.6c0 5-3.5 7.6-7.66 9a1 1 0 0 1-.67 0C7.5 20.2 4 17.6 4 12.6V6.15a1.1 1.1 0 0 1 1-1.1c2-.1 4.5-1.25 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 4.95 19 5.05a1.1 1.1 0 0 1 1 1.1z"/><path d="m9.3 11.9 2 2 3.4-3.4"/>',
  route: '<circle cx="6" cy="19" r="2.75"/><path d="M8.75 19h8.75a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15.25"/><circle cx="18" cy="5" r="2.75"/>',
  network: '<rect x="9" y="2" width="6" height="6" rx="2"/><rect x="2" y="16" width="6" height="6" rx="2"/><rect x="16" y="16" width="6" height="6" rx="2"/><path d="M12 8v3.5M5 16v-2.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1V16"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3.2"/><path d="M4 5.5v13c0 1.75 3.6 3.2 8 3.2s8-1.45 8-3.2v-13"/><path d="M4 12c0 1.75 3.6 3.2 8 3.2s8-1.45 8-3.2"/>',
  package: '<path d="m7.5 4.3 9 5.15"/><path d="M21 8.15a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8.15v7.7a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"/><path d="m3.3 7.2 8.7 5 8.7-5M12 22V12.2"/>',
  plug: '<path d="M12 22v-4.5M9 8V2.5M15 8V2.5M18 8v4a6 6 0 0 1-12 0V8z"/>',
  puzzle: '<path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z"/>',
  send: '<path d="M14.54 21.69a.5.5 0 0 0 .93-.03l6.5-19a.5.5 0 0 0-.63-.63l-19 6.5a.5.5 0 0 0-.03.93l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/>',
  filter: '<path d="M20.5 4.5H3.5l6.6 7.8a1 1 0 0 1 .24.65v5.6a1 1 0 0 0 .55.9l2.3 1.15a.6.6 0 0 0 .86-.54v-7.11a1 1 0 0 1 .24-.65z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'more-vertical': '<circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  'more-horizontal': '<circle cx="12" cy="12" r="1.4"/><circle cx="5" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  inbox: '<path d="M22 12.5h-4.6a1 1 0 0 0-.83.44l-1.24 1.86a1 1 0 0 1-.83.45h-3a1 1 0 0 1-.83-.45l-1.24-1.86a1 1 0 0 0-.83-.44H2"/><path d="M5.45 5.11 2 12.5V18a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 22 18v-5.5l-3.45-7.39A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  target: '<circle cx="12" cy="12" r="9.25"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.8"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  sparkles: '<path d="M9.94 15.5a2 2 0 0 0-1.44-1.44L2.37 12.48a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v3M21.5 4.5h-3"/>',
  zap: '<path d="M12.9 2.3a.5.5 0 0 1 .87.45L12.5 9.5h5.9a.6.6 0 0 1 .45 1L11.1 21.7a.5.5 0 0 1-.87-.45L11.5 14.5H5.6a.6.6 0 0 1-.45-1z"/>',
  flame: '<path d="M12 2.7s5.6 3.8 5.6 9.35a5.6 5.6 0 0 1-11.2 0C6.4 8.9 8 6.4 8 6.4s.6 2.5 2.1 2.5c1.4 0 1.4-3.6 1.9-6.2z"/><path d="M12 20.5a2.6 2.6 0 0 1-2.6-2.6c0-1.9 2.6-3.7 2.6-3.7s2.6 1.8 2.6 3.7A2.6 2.6 0 0 1 12 20.5z"/>',
  'map-pin': '<path d="M19 10.5c0 5.25-7 11-7 11s-7-5.75-7-11a7 7 0 0 1 14 0z"/><circle cx="12" cy="10.3" r="2.8"/>',
  'credit-card': '<rect x="2.5" y="5" width="19" height="14" rx="3.4"/><path d="M2.5 10h19"/><path d="M6.5 14.8h3"/>',
  'shopping-bag': '<path d="M5.4 7h13.2a1 1 0 0 1 1 1.1l-1 11.05A2 2 0 0 1 16.6 21H7.4a2 2 0 0 1-2-1.85L4.4 8.1A1 1 0 0 1 5.4 7z"/><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/>',
  play: '<path d="M8 5.6a1 1 0 0 1 1.52-.85l9.3 5.55a1 1 0 0 1 0 1.72l-9.3 5.55A1 1 0 0 1 8 16.72z"/>',
  'play-circle': '<circle cx="12" cy="12" r="9.25"/><path d="M10.2 9.1a.7.7 0 0 1 1.06-.6l4.4 2.5a.7.7 0 0 1 0 1.2l-4.4 2.5a.7.7 0 0 1-1.06-.6z"/>',
  'circle-check': '<circle cx="12" cy="12" r="9.25"/><path d="m8.4 12.2 2.5 2.5 4.7-4.7"/>',
  'circle-dashed': '<path d="M10.1 2.9a9.3 9.3 0 0 1 3.8 0M17.4 5a9.3 9.3 0 0 1 1.9 2.7M21.1 12a9.3 9.3 0 0 1-.5 3.1M18.5 18.4a9.3 9.3 0 0 1-2.7 2.1M12 21.3a9.3 9.3 0 0 1-3.1-.5M5.6 18.5a9.3 9.3 0 0 1-2.1-2.7M2.7 12a9.3 9.3 0 0 1 .5-3.1M5.5 5.6a9.3 9.3 0 0 1 2.7-2.1"/>',
  bookmark: '<path d="M18.5 21 12 16.9 5.5 21V5.4A2.4 2.4 0 0 1 7.9 3h8.2a2.4 2.4 0 0 1 2.4 2.4z"/>',
  globe: '<circle cx="12" cy="12" r="9.25"/><path d="M2.9 9.2h18.2M2.9 14.8h18.2"/><path d="M12 2.75c-4.6 5.2-4.6 13.3 0 18.5 4.6-5.2 4.6-13.3 0-18.5z"/>',
  'life-buoy': '<circle cx="12" cy="12" r="9.25"/><circle cx="12" cy="12" r="4"/><path d="m5.5 5.5 3.7 3.7M14.8 14.8l3.7 3.7M18.5 5.5l-3.7 3.7M9.2 14.8l-3.7 3.7"/>',
  key: '<circle cx="7.5" cy="15.5" r="4"/><path d="m10.4 12.7 8.4-8.4M17 6.1l2.4 2.4M14.8 8.3l2.4 2.4"/>',
  'log-in': '<path d="M14.5 3H18a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 18 21h-3.5"/><path d="m8.5 16.5 4.5-4.5-4.5-4.5"/><path d="M13 12H2.5"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="3.4"/><path d="m3.5 7.5 7.4 5.1a2 2 0 0 0 2.2 0l7.4-5.1"/>',
  phone: '<path d="M15.4 21.5A15.6 15.6 0 0 1 2.5 8.6 3 3 0 0 1 5.5 5.3h2a1.4 1.4 0 0 1 1.4 1.2c.1.9.35 1.8.7 2.65a1.4 1.4 0 0 1-.4 1.55l-.9.9a13 13 0 0 0 5.1 5.1l.9-.9a1.4 1.4 0 0 1 1.55-.4c.85.35 1.75.6 2.65.7a1.4 1.4 0 0 1 1.2 1.4v2a3 3 0 0 1-3.3 3z"/>',
  smile: '<circle cx="12" cy="12" r="9.25"/><path d="M8.5 14.2a4.4 4.4 0 0 0 7 0"/><path d="M9.2 9.4h.01M14.8 9.4h.01"/>',
};

/**
 * Versiones rellenas de los iconos de navegación. Sin trazo: el `fill` a
 * `currentColor` hereda el color del elemento activo.
 */
const SOLID_ICONS: Record<string, string> = {
  home: '<path d="M2.6 10.6a1.4 1.4 0 0 1 .5-1.1l8-6.3a1.4 1.4 0 0 1 1.8 0l8 6.3a1.4 1.4 0 0 1 .5 1.1V19a2.6 2.6 0 0 1-2.6 2.6h-3.3v-5.4a1.2 1.2 0 0 0-1.2-1.2h-2.6a1.2 1.2 0 0 0-1.2 1.2v5.4H5.2A2.6 2.6 0 0 1 2.6 19z"/>',
  book: '<path d="M7.2 2h9.5A3.3 3.3 0 0 1 20 5.3v13.4A3.3 3.3 0 0 1 16.7 22H7.2A3.7 3.7 0 0 1 3.5 18.3V5.7A3.7 3.7 0 0 1 7.2 2zm-.8 15.6a1.1 1.1 0 0 0 0 2.2h11a1.1 1.1 0 0 0 0-2.2z"/>',
  calendar: '<path d="M8 1.6a.9.9 0 0 1 .9.9v1.1h6.2V2.5a.9.9 0 0 1 1.8 0v1.1h.6A3.5 3.5 0 0 1 21 7.1v.4H3v-.4a3.5 3.5 0 0 1 3.5-3.5h.6V2.5a.9.9 0 0 1 .9-.9z"/><path d="M3 9.3h18V18a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 18zm4.6 3.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-8.8 4.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4.4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
  'message-square': '<path d="M5.9 3.4h12.2a3.1 3.1 0 0 1 3.1 3.1v8a3.1 3.1 0 0 1-3.1 3.1H8.3l-3.9 3.45a.85.85 0 0 1-1.4-.64V6.5a3.1 3.1 0 0 1 2.9-3.1z"/>',
  bell: '<path d="M12 2.2A6.6 6.6 0 0 0 5.4 8.8c0 3.05-.62 4.13-1.62 5.32a1.6 1.6 0 0 0 1.22 2.63h14a1.6 1.6 0 0 0 1.22-2.63c-1-1.19-1.62-2.27-1.62-5.32A6.6 6.6 0 0 0 12 2.2z"/><path d="M9.7 18.4h4.6a2.55 2.55 0 0 1-4.6 0z"/>',
  user: '<circle cx="12" cy="7.2" r="4.7"/><path d="M4.2 20.4a5.4 5.4 0 0 1 5.4-5.4h4.8a5.4 5.4 0 0 1 5.4 5.4 1.2 1.2 0 0 1-1.2 1.2H5.4a1.2 1.2 0 0 1-1.2-1.2z"/>',
  grid: '<rect x="2.6" y="2.6" width="8.4" height="8.4" rx="2.7"/><rect x="13" y="2.6" width="8.4" height="8.4" rx="2.7"/><rect x="2.6" y="13" width="8.4" height="8.4" rx="2.7"/><rect x="13" y="13" width="8.4" height="8.4" rx="2.7"/>',
  award: '<circle cx="12" cy="8.3" r="6"/><path d="M8.05 14.75 6.6 22.1a.5.5 0 0 0 .74.53L12 19.95l4.66 2.68a.5.5 0 0 0 .74-.53l-1.45-7.35a7.9 7.9 0 0 1-7.9 0z"/>',
  search: '<path d="M11 3a8 8 0 1 0 4.9 14.32l3.9 3.9a1.05 1.05 0 0 0 1.49-1.49l-3.9-3.9A8 8 0 0 0 11 3zm0 2.1a5.9 5.9 0 1 1 0 11.8 5.9 5.9 0 0 1 0-11.8z"/>',
  target: '<path d="M12 2.75A9.25 9.25 0 1 0 21.25 12 9.26 9.26 0 0 0 12 2.75zm0 3.75A5.5 5.5 0 1 1 6.5 12 5.5 5.5 0 0 1 12 6.5zm0 3.7A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2z"/>',
  shield: '<path d="M11.24 2.33a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 4.95 19 5.05a1.1 1.1 0 0 1 1 1.1v6.45c0 5-3.5 7.6-7.66 9a1 1 0 0 1-.67 0C7.5 20.2 4 17.6 4 12.6V6.15a1.1 1.1 0 0 1 1-1.1c2-.1 4.5-1.25 6.24-2.72z"/>',
  building: '<path d="M7 2.5h10A3 3 0 0 1 20 5.5v13a3 3 0 0 1-3 3h-2.2v-3.75a1 1 0 0 0-1-1h-3.6a1 1 0 0 0-1 1V21.5H7a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3zm1.5 3.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-7 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm7 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>',
  'help-circle': '<path d="M12 2.75A9.25 9.25 0 1 0 21.25 12 9.26 9.26 0 0 0 12 2.75zm.05 3.5a3.9 3.9 0 0 1 3.75 4.05c0 1.55-1 2.4-1.75 3-.65.5-.95.75-.95 1.2a1.1 1.1 0 0 1-2.2 0c0-1.6 1-2.4 1.75-3 .65-.5.95-.7.95-1.2a1.7 1.7 0 0 0-3.35-.35 1.1 1.1 0 1 1-2.15-.45 3.9 3.9 0 0 1 3.95-3.25zM12 16.1a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z"/>',
  chart: '<path d="M3.5 2.4a1.1 1.1 0 0 1 1.1 1.1v14.2a1.7 1.7 0 0 0 1.7 1.7h14.2a1.1 1.1 0 0 1 0 2.2H6.3a3.9 3.9 0 0 1-3.9-3.9V3.5a1.1 1.1 0 0 1 1.1-1.1z"/><path d="M18.9 6.15a1.1 1.1 0 0 1 .3 1.53l-4.2 6a1.1 1.1 0 0 1-1.65.18l-2.42-2.26-2.55 3.35a1.1 1.1 0 1 1-1.75-1.33l3.2-4.2a1.1 1.1 0 0 1 1.63-.13l2.4 2.24 3.5-5a1.1 1.1 0 0 1 1.54-.28z"/>',
};
