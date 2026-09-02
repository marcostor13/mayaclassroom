import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

/**
 * Convierte a identificador de Mongo, rechazando lo que no lo sea.
 *
 * Sin esta guarda, una ruta con un identificador mal formado —el clásico
 * «/courses/undefined» que genera un enlace con un campo vacío— reventaba
 * dentro del driver y salía como 500. Un identificador inválido es una
 * petición mal hecha, no un fallo del servidor: devolver 400 lo deja claro en
 * el registro y evita perseguir errores internos que no lo son.
 */
export const toObjectId = (value: string | Types.ObjectId): Types.ObjectId => {
  if (value instanceof Types.ObjectId) return value;
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException(`El identificador «${String(value)}» no es válido.`);
  }
  return new Types.ObjectId(value);
};

export const toObjectIds = (values: (string | Types.ObjectId)[]): Types.ObjectId[] =>
  values.map(toObjectId);

export const idString = (value: unknown): string => String(value);

export const isSameId = (a: unknown, b: unknown): boolean => String(a) === String(b);

/** Construye una expresión regular segura para búsquedas «contiene». */
export const searchRegex = (term: string): RegExp =>
  new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

/** Filtro base que excluye documentos borrados lógicamente. */
export const notDeleted = { deletedAt: null } as const;
