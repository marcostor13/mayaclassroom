import { Types } from 'mongoose';

export const toObjectId = (value: string | Types.ObjectId): Types.ObjectId =>
  value instanceof Types.ObjectId ? value : new Types.ObjectId(value);

export const toObjectIds = (values: (string | Types.ObjectId)[]): Types.ObjectId[] =>
  values.map(toObjectId);

export const idString = (value: unknown): string => String(value);

export const isSameId = (a: unknown, b: unknown): boolean => String(a) === String(b);

/** Construye una expresión regular segura para búsquedas «contiene». */
export const searchRegex = (term: string): RegExp =>
  new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** Filtro base que excluye documentos borrados lógicamente. */
export const notDeleted = { deletedAt: null } as const;
