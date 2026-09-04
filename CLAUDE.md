# Maya Classroom

LMS multiempresa inspirado en Moodle. Monorepo Bun con tres paquetes:

| Ruta | Qué es |
|---|---|
| `apps/api` | API NestJS 11 + Mongoose 8 sobre MongoDB Atlas |
| `apps/web` | Cliente Angular 22 sin zonas, basado en señales |
| `scripts/video-landing` | Produce el vídeo de la página de venta (capturas → diapositivas → locución → MP4) |
| `packages/shared` | Contratos TypeScript compartidos (`@maya/shared`) |

El idioma del proyecto es el **español**: comentarios, textos de interfaz,
mensajes de commit y documentación. El código (identificadores, rutas, claves
de API) va en inglés.

## Comandos

```bash
bun install
bun run dev            # API en :3000 y cliente en :4205
bun run seed           # datos de demostración (necesita MONGODB_URI;
                       #   con PEXELS_API_KEY además resuelve los vídeos)
bun run build:shared   # solo hace falta antes de un `tsc` lanzado a mano

bun run lint                          # ESLint de la API
bun run test                          # pruebas de la API (bun test)
bunx tsc -p apps/api/tsconfig.json --noEmit
bun run build                         # shared + api + web
```

## Trampas conocidas

Cada una de estas ha costado ya un ciclo de depuración; comprobarlas antes de
dar por rota una herramienta.

- **`@maya/shared` se consume desde `dist/`, no desde las fuentes.** Con el
  `dist` ausente o atrasado, la API falla con decenas de errores que no
  apuntan a la causa: «no se encuentra el módulo `@maya/shared`» si falta, o
  «la propiedad X no existe» si está viejo. Los guiones del espacio de trabajo
  (`build`, `seed`, `test`, `lint`, `dev`) ya lo recompilan antes, así que esto
  solo muerde al lanzar `bunx tsc` o `nest build` a mano: en ese caso,
  `bun run build:shared` primero.
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
- **La señalización de las aulas en vivo cuelga de `/api/live-socket`**, no del
  `/socket.io` por defecto de Socket.IO. El proxy de desarrollo y el nginx del
  despliegue solo reenvían `/api`: en la ruta por defecto el socket muere con un
  404 del servidor de estáticos y la sala se queda cargando sin ningún error en
  la consola. El proxy además necesita `ws: true` y nginx las cabeceras de
  ascenso a WebSocket.
- **Los medios de la demostración salen de Pexels.** Las fotos se componen de
  su identificador y no necesitan clave; los vídeos sí, porque el nombre del
  fichero depende de la resolución con la que se publicó cada uno. Sin
  `PEXELS_API_KEY` la siembra funciona igual y deja la demostración con
  imágenes y sin vídeos, avisando por el registro.

- **El sello de los certificados depende de `SIGNING_SECRET`.** Cambiarlo
  invalida la verificación de todo lo ya emitido: los certificados pasan a
  responder «el contenido no coincide con su sello». Por omisión cae a
  `JWT_ACCESS_SECRET`, así que rotar ese arrastra el mismo efecto; en
  producción conviene darle uno propio y no tocarlo.
- **Las respuestas de una encuesta no guardan autor, a propósito.** Quién ha
  respondido vive en `survey_participations`, sin ninguna referencia a la
  respuesta. No añadir un campo de usuario a `survey_responses` ni una marca de
  tiempo fina que permita emparejarlas por orden: rompería lo único que la
  encuesta promete.

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
- **Perú es el mercado por defecto.** Los precios van en soles y las fechas y
  los importes se escriben como allí. Nada de `Intl.NumberFormat` a mano ni de
  `'EUR'` suelto: `DEFAULT_CURRENCY`, `DEFAULT_LOCALE`, `DEFAULT_TIMEZONE`,
  `formatMoney()` y `currencySymbol()` viven en `@maya/shared`.
- Los documentos que acreditan algo —certificados, actas de firma— guardan una
  copia congelada de lo que acreditan y un sello HMAC sobre ella. No resolver
  esos datos al enseñarlos: renombrar un curso cambiaría lo que dice un
  documento ya entregado y rompería su sello.
- Antes de dar algo por terminado, ejecutar `/verificar`.
