import { Logger } from '@nestjs/common';
import { CourseVisibility, UserStatus } from '@maya/shared';
import type { Model, Types } from 'mongoose';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import type { UserDocument } from '../../modules/users/schemas/user.schema';

const logger = new Logger('Seed·Retirada');

/**
 * Nombres cortos de los cursos que vendía la demostración anterior, cuando era
 * una academia de programación. Están escritos a mano a propósito: la retirada
 * tiene que tocar exactamente esos tres y nada más.
 */
export const CURSOS_ANTERIORES = ['ANG-22', 'NEST-11', 'IA-101'] as const;

/** Dominio de correo con el que la siembra anterior creó sus cuentas. */
export const CORREO_ANTERIOR = '@academiamaya.example';

export interface Retirada {
  cursos: number;
  cuentas: number;
}

/**
 * Retira lo que dejó la demostración anterior en una base ya sembrada.
 *
 * La siembra es idempotente —se ejecuta muchas veces sobre la misma base— y
 * eso, al cambiar el contenido de la demostración, se vuelve en contra: crear
 * lo nuevo sin retirar lo viejo deja el escaparate con dos catálogos mezclados
 * y la entrada de estudiante cayendo en una cuenta sin datos.
 *
 * No borra nada. Los cursos salen del catálogo y se ocultan; las cuentas se
 * suspenden, que es justo lo que hace que `findDemoUser` deje de elegirlas.
 * Todo se deshace desde la interfaz, y el filtro nombra una por una las cosas
 * que sembró aquella versión: nada que haya creado la empresa se toca.
 */
export async function retirarDemoAnterior(params: {
  tenantId: Types.ObjectId;
  courseModel: Model<CourseDocument>;
  userModel: Model<UserDocument>;
}): Promise<Retirada> {
  const { tenantId, courseModel, userModel } = params;

  const cursos = await courseModel
    .updateMany(
      {
        tenant: tenantId,
        shortName: { $in: [...CURSOS_ANTERIORES] },
        deletedAt: null,
      },
      { $set: { 'catalog.listed': false, visibility: CourseVisibility.Hidden } },
    )
    .exec();

  const cuentas = await userModel
    .updateMany(
      {
        tenant: tenantId,
        // El punto se escapa: sin escapar valdría cualquier carácter y el
        // filtro alcanzaría dominios que no son este.
        email: { $regex: `${CORREO_ANTERIOR.replace('.', '\\.')}$` },
        status: { $ne: UserStatus.Suspended },
      },
      { $set: { status: UserStatus.Suspended } },
    )
    .exec();

  const resultado = { cursos: cursos.modifiedCount, cuentas: cuentas.modifiedCount };

  if (resultado.cursos || resultado.cuentas) {
    logger.log(
      `Demostración anterior retirada: ${resultado.cursos} curso(s) fuera del catálogo y ` +
        `${resultado.cuentas} cuenta(s) suspendida(s)`,
    );
  }

  return resultado;
}
