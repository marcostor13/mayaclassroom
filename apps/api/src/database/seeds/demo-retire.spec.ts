import { Types } from 'mongoose';
import { CourseVisibility, UserStatus } from '@maya/shared';
import type { Model } from 'mongoose';
import type { CourseDocument } from '../../modules/courses/schemas/course.schema';
import type { UserDocument } from '../../modules/users/schemas/user.schema';
import { CORREO_ANTERIOR, CURSOS_ANTERIORES, retirarDemoAnterior } from './demo-retire';

const TENANT = new Types.ObjectId();

interface Llamada {
  filtro: Record<string, unknown>;
  cambio: Record<string, unknown>;
}

/**
 * Doble del modelo que apunta con qué filtro se le llamó.
 *
 * Lo que hay que probar aquí no es Mongoose: es que el filtro alcance
 * exactamente lo que sembró la demostración anterior. Esta función suspende
 * cuentas y oculta cursos sobre datos de producción, así que un filtro de más
 * se lleva por delante trabajo de la empresa.
 */
function modeloDoble(modificados: number) {
  const llamadas: Llamada[] = [];
  const modelo = {
    updateMany: (filtro: Record<string, unknown>, cambio: Record<string, unknown>) => {
      llamadas.push({ filtro, cambio });
      return { exec: async () => ({ modifiedCount: modificados }) };
    },
  };
  return { modelo, llamadas };
}

describe('retirada de la demostración anterior', () => {
  it('quita del catálogo y oculta solo los tres cursos de entonces', async () => {
    const cursos = modeloDoble(3);
    const usuarios = modeloDoble(0);

    await retirarDemoAnterior({
      tenantId: TENANT,
      courseModel: cursos.modelo as unknown as Model<CourseDocument>,
      userModel: usuarios.modelo as unknown as Model<UserDocument>,
    });

    const { filtro, cambio } = cursos.llamadas[0];
    expect(filtro['tenant']).toBe(TENANT);
    expect(filtro['shortName']).toEqual({ $in: [...CURSOS_ANTERIORES] });
    // Un curso ya borrado no se vuelve a tocar.
    expect(filtro['deletedAt']).toBeNull();
    expect(cambio['$set']).toEqual({
      'catalog.listed': false,
      visibility: CourseVisibility.Hidden,
    });
  });

  it('suspende únicamente las cuentas del dominio de la demostración anterior', async () => {
    const cursos = modeloDoble(0);
    const usuarios = modeloDoble(9);

    await retirarDemoAnterior({
      tenantId: TENANT,
      courseModel: cursos.modelo as unknown as Model<CourseDocument>,
      userModel: usuarios.modelo as unknown as Model<UserDocument>,
    });

    const { filtro, cambio } = usuarios.llamadas[0];
    expect(filtro['tenant']).toBe(TENANT);
    expect(cambio['$set']).toEqual({ status: UserStatus.Suspended });
    // No se vuelve a escribir sobre las que ya están suspendidas.
    expect(filtro['status']).toEqual({ $ne: UserStatus.Suspended });
  });

  it('escapa el punto del dominio, para no alcanzar otros parecidos', async () => {
    const cursos = modeloDoble(0);
    const usuarios = modeloDoble(0);

    await retirarDemoAnterior({
      tenantId: TENANT,
      courseModel: cursos.modelo as unknown as Model<CourseDocument>,
      userModel: usuarios.modelo as unknown as Model<UserDocument>,
    });

    const email = usuarios.llamadas[0].filtro['email'] as { $regex: string };
    const patron = new RegExp(email.$regex);

    expect(patron.test(`ana.ruiz${CORREO_ANTERIOR}`)).toBe(true);
    expect(patron.test('ana.quispe@dulcelima.pe')).toBe(false);
    expect(patron.test('admin@mayaclassroom.app')).toBe(false);
    // Sin escapar el punto, esta pasaría: es el fallo que la prueba vigila.
    expect(patron.test('alguien@academiamayaXexample')).toBe(false);
    // Y tiene que anclar al final: un subdominio parecido no cuenta.
    expect(patron.test(`alguien${CORREO_ANTERIOR}.otra-cosa`)).toBe(false);
  });

  it('devuelve la cuenta de lo retirado', async () => {
    const cursos = modeloDoble(3);
    const usuarios = modeloDoble(9);

    const resultado = await retirarDemoAnterior({
      tenantId: TENANT,
      courseModel: cursos.modelo as unknown as Model<CourseDocument>,
      userModel: usuarios.modelo as unknown as Model<UserDocument>,
    });

    expect(resultado).toEqual({ cursos: 3, cuentas: 9 });
  });
});
