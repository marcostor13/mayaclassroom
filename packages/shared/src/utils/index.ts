import { AvailabilityOperator } from '../enums';

/** Construye el nombre completo de un usuario. */
export function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

/** Iniciales para avatares de respaldo. */
export function initials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** Normaliza un texto para usarlo como slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Formatea un tamaño en bytes de forma legible. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

/** Redondea a un número de decimales fijo. */
export function round(value: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}


/** Elimina etiquetas HTML dejando texto plano (para resúmenes y búsquedas). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Recorta un texto a una longitud máxima con puntos suspensivos. */
export function excerpt(text: string, length = 180): string {
  const plain = stripHtml(text);
  return plain.length <= length ? plain : `${plain.slice(0, length - 1)}\u2026`;
}

/**
 * Saneado básico del HTML introducido por los usuarios: elimina scripts,
 * estilos, atributos de evento y URLs `javascript:`.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

/** Genera un código alfanumérico legible (claves de matriculación, certificados). */
export function randomCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Árbol de restricción de acceso (formato compatible con Moodle). */
export interface AvailabilityTree {
  op: AvailabilityOperator;
  c: (AvailabilityTree | AvailabilityCondition)[];
  /** Mostrar u ocultar cada condición individualmente. */
  showc?: boolean[];
  show?: boolean;
}

export interface AvailabilityCondition {
  type: string;
  [key: string]: unknown;
}

export function isAvailabilityTree(
  node: AvailabilityTree | AvailabilityCondition,
): node is AvailabilityTree {
  return (node as AvailabilityTree).op !== undefined;
}
