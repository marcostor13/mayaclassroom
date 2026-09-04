import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Desde `apps/api`, que es desde donde se lanzan las pruebas (ver CLAUDE.md).
const MODULOS = join(process.cwd(), 'src', 'modules');

/** Los métodos de un controlador que llevan `@AllowInDemo()`, por su ruta. */
function marcados(fichero: string): { clase: boolean; metodos: string[] } {
  const texto = readFileSync(fichero, 'utf8');
  const lineas = texto.split('\n');
  const metodos: string[] = [];
  let clase = false;

  for (let i = 0; i < lineas.length; i++) {
    if (!lineas[i].trim().startsWith('@AllowInDemo()')) continue;
    // Lo que decora es lo primero que viene detrás: o el controlador entero o
    // el verbo y la ruta de un método.
    const siguiente = lineas.slice(i + 1, i + 4).find((l) => l.trim().startsWith('@')) ?? '';
    if (siguiente.includes('@Controller(')) clase = true;
    else metodos.push(siguiente.trim());
  }
  return { clase, metodos };
}

function controladores(): string[] {
  return readdirSync(MODULOS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(MODULOS, e.name, `${e.name}.controller.ts`))
    .filter((ruta) => {
      try {
        readFileSync(ruta);
        return true;
      } catch {
        return false;
      }
    });
}

/**
 * La superficie que una sesión de demostración puede escribir.
 *
 * Esto no comprueba código: comprueba una **decisión**. `DemoGuard` deniega
 * por omisión, así que la única forma de abrirle algo a la demostración es
 * marcarlo, y la única forma de abrirle algo por descuido es marcarlo sin
 * pensarlo. Esta lista obliga a que cambiar la superficie sea un cambio
 * visible en la revisión, no un decorador que se coló en un fichero de 400
 * líneas.
 */
describe('Demostración · qué queda abierto a escritura', () => {
  it('los controladores de administración no abren nada', () => {
    // De lo que pasa aquí no se vuelve con `bun run seed`: cuentas, roles,
    // el dominio propio y las sesiones de otras visitas.
    for (const nombre of ['tenants', 'rbac', 'auth']) {
      const texto = readFileSync(join(MODULOS, nombre, `${nombre}.controller.ts`), 'utf8');
      expect({ nombre, abre: texto.includes('@AllowInDemo()') }).toEqual({ nombre, abre: false });
    }
  });

  it('los controladores mixtos abren exactamente lo previsto', () => {
    const esperado: Record<string, string[]> = {
      // Del propio visitante y de nadie más.
      users: ["@Patch('me/preferences')", "@Post('me/accept-policy')"],
      // Comentar en un curso es contenido; los tokens, los webhooks, las
      // copias y las peticiones de datos personales, no.
      platform: ["@Post('comments/:component/:itemId')", "@Delete('comments/:id')"],
      // Resolver un pedido es enseñar la tienda; las credenciales de cobro no.
      commerce: ["@Patch('orders/:id')"],
      // Subir hace falta para montar un temario; borrar lo de cualquiera, no.
      files: ["@Post('upload')", "@Post('upload/image')", "@Post('upload-many')"],
    };

    for (const [nombre, rutas] of Object.entries(esperado)) {
      const { clase, metodos } = marcados(join(MODULOS, nombre, `${nombre}.controller.ts`));
      expect({ nombre, clase }).toEqual({ nombre, clase: false });
      expect({ nombre, metodos }).toEqual({ nombre, metodos: rutas });
    }
  });

  it('los controladores abiertos enteros son solo los de contenido docente', () => {
    const docentes = new Set([
      'courses', 'categories', 'enrolments', 'grades', 'groups', 'questions',
      'completion', 'calendar', 'live', 'messaging', 'site', 'badges',
      'certificates', 'cohorts', 'competencies', 'notifications', 'guides',
    ]);

    const abiertos = controladores()
      .filter((ruta) => marcados(ruta).clase)
      .map((ruta) => ruta.split('/').slice(-2)[0])
      .sort();

    expect(abiertos).toEqual([...docentes].sort());
  });
});
