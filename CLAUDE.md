# Maya Classroom

LMS multiempresa inspirado en Moodle. Monorepo Bun con tres paquetes:

| Ruta | Qué es |
|---|---|
| `apps/api` | API NestJS 11 + Mongoose 8 sobre MongoDB Atlas |
| `apps/web` | Cliente Angular 22 sin zonas, basado en señales |
| `packages/shared` | Contratos TypeScript compartidos (`@maya/shared`) |

El idioma del proyecto es el **español**: comentarios, textos de interfaz,
mensajes de commit y documentación. El código (identificadores, rutas, claves
de API) va en inglés.

## Comandos

```bash
bun install
bun run build:shared   # obligatorio antes de cualquier typecheck o compilación
bun run dev            # API en :3000 y cliente en :4205
bun run seed           # datos de demostración (necesita MONGODB_URI)

bun run lint                          # ESLint de la API
bun run test                          # pruebas de la API (bun test)
bunx tsc -p apps/api/tsconfig.json --noEmit
bun run build                         # shared + api + web
```

## Trampas conocidas

Cada una de estas ha costado ya un ciclo de depuración; comprobarlas antes de
dar por rota una herramienta.

- **`bun run build:shared` primero.** `@maya/shared` se consume desde `dist/`,
  no desde las fuentes. Sin compilarlo, el typecheck de la API y la
  compilación del cliente fallan con errores de módulo no encontrado que no
  apuntan a la causa real.
- **Node ≥ 22.22.3.** Los CLI de Nest y Angular se invocan con shebang `node` y
  Angular 22 exige esa versión. El contenedor de las sesiones remotas trae una
  anterior; `.claude/hooks/session-start.sh` la corrige y persiste el PATH.
- **Las pruebas de un fichero suelto se lanzan desde `apps/api`.** `bun test
  src/modules/.../x.spec.ts` funciona ahí; desde la raíz del repositorio falla
  con `undefined is not an object (evaluating 'target.constructor')` porque no
  se precarga `reflect-metadata`.
- **`import type` es obligatorio para las importaciones de solo tipo.** El
  transpilador de Bun procesa cada fichero por separado y no puede deducirlo:
  una importación de tipo emitida como importación real revienta en ejecución.
  La regla `@typescript-eslint/consistent-type-imports` lo vigila.
- **`@typescript-eslint/no-explicit-any` está en `error`.** No hay escapatoria
  con `any`; usar `unknown` y estrechar.

## Convenciones

Las reglas detalladas viven en `.claude/rules/` y se cargan solas al tocar los
ficheros que les corresponden. Los procedimientos de varios pasos son skills:

| Skill | Para qué |
|---|---|
| `/verificar` | Cadena completa de comprobación antes de entregar |
| `/endpoint` | Añadir un endpoint de la API de punta a punta |
| `/pantalla` | Añadir una pantalla al cliente Angular |
| `/revisar-ui` | Ver un cambio visual sin levantar la base de datos |

## Reglas de trabajo

- Aislamiento multiempresa: **toda** consulta a una colección con `tenant` debe
  filtrar por él. Un `find` sin `tenant` es una fuga de datos entre empresas.
- Autorización: los endpoints se protegen con `@RequireCapability(...)`, nunca
  comprobando el rol a mano.
- No introducir colores en crudo en el cliente: el sistema de diseño vive en
  variables CSS (`--maya-*`) para que la personalización de marca por empresa
  siga funcionando.
- Antes de dar algo por terminado, ejecutar `/verificar`.
