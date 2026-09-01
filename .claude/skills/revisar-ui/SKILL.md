---
name: revisar-ui
description: Captura la interfaz de Maya Classroom a varias anchuras (móvil, tableta, escritorio) para comprobar de verdad un cambio visual, incluso sin base de datos, montando un banco de pruebas estático a partir del SCSS del proyecto. Úsalo siempre que toques estilos, el menú, el armazón, iconos, el logo o cualquier pantalla, y cuando el usuario pida "cómo se ve", "hazme una captura", "revisa el diseño", "compruébalo en móvil", "¿se ve bien?" o diga que algo se ve mal, está cortado o descuadrado. Compilar sin errores no demuestra que se vea bien, así que úsalo antes de dar por terminado cualquier trabajo de interfaz.
argument-hint: "[ruta o componente]"
allowed-tools: Bash Read Glob Grep
---

# Revisar la interfaz

Un cambio visual no está terminado porque compile. La regresión típica —un
distintivo que tapa un icono, un menú que desaparece en tableta, un texto que
desborda a 360 px— pasa el `build` sin una sola advertencia y solo se ve
mirando.

Hay dos caminos. Elegir según lo que haga falta ver.

## Camino A · La aplicación de verdad

Preferible siempre que la pantalla sea accesible. Requiere el servidor de
desarrollo; para todo lo que está tras el acceso hace falta además la API con
`MONGODB_URI` configurada.

```bash
cd apps/web && bunx ng serve --host 127.0.0.1 --port 4200
```

Esperar a que el registro diga `Watch mode enabled` y capturar:

```bash
node .claude/skills/revisar-ui/scripts/capturar.mjs \
  http://127.0.0.1:4200/auth/login ./capturas movil,tableta,escritorio
```

El guion escribe un PNG por anchura y **enumera los errores de consola**, que
suelen explicar una pantalla en blanco mejor que la propia captura. Sin base de
datos aparecerán errores 502 de la API: son esperables y no invalidan la
revisión del diseño.

Después, mirar los PNG con la herramienta de lectura. Ese es el paso que
importa: la captura solo sirve si se examina.

## Camino B · Banco de pruebas estático

Para revisar el armazón o pantallas que exigen sesión iniciada cuando no hay
base de datos. Los estilos de componente de Angular se empaquetan dentro del JS
con atributos de encapsulación, así que no se pueden reutilizar desde un HTML
suelto: hay que compilarlos aparte.

```bash
.claude/skills/revisar-ui/scripts/banco-estilos.sh ./banco \
  apps/web/src/app/layout/shell.component.scss
```

Produce `banco/global.css` y `banco/shell.component.css`. Escribir junto a
ellos un HTML que reproduzca el marcado de la plantilla —las mismas clases,
los mismos SVG de `icon.component.ts`— y capturarlo con `file://`:

```bash
node .claude/skills/revisar-ui/scripts/capturar.mjs \
  "file://$PWD/banco/prueba.html" ./capturas movil,escritorio
```

El banco reproduce el CSS con fidelidad, no el comportamiento: los estados que
dependen de señales (cajón abierto, hoja «Más», pestaña activa) se representan
escribiendo a mano la clase correspondiente (`sidebar--open`, `is-active`).

Tampoco pasa por Angular, así que **no detecta lo que rompe el propio marco**:
un `[innerHTML]` saneado, una tubería que devuelve vacío o un enlace que no
resuelve se ven perfectos en el banco y en blanco en la aplicación. Para eso
hace falta el camino A, aunque sea sirviendo `dist/web/browser` con
`python3 -m http.server` y mirando la pantalla de acceso, que no necesita
base de datos.

## Qué mirar

Las anchuras no son decorativas; cada una responde a una pregunta distinta:

- **390 px** — ¿desborda algún texto o titular? ¿La barra inferior tapa
  contenido? ¿Los objetivos táctiles llegan a 44 px?
- **820 px (tableta)** — la zona donde más regresiones aparecen, porque cae
  entre los puntos `md` y `lg`. La frontera de la aplicación es
  `$maya-bp-app` (1024 px): por debajo debe verse la barra inferior y el
  botón de menú; por encima, la barra lateral fija. Nunca ninguna de las dos,
  ni las dos a la vez.
- **1440 px** — jerarquía, alineación de la rejilla, espacio en blanco.

Y en cualquiera de ellas: contraste del texto rojo (usar `--maya-primary-ink`,
no `--maya-primary`, para texto sobre blanco) y distintivos que no se coman el
icono que anotan.

## Un aviso sobre las capturas

El ratón virtual del navegador arranca en (0,0) y activa `:hover` sobre lo que
haya en esa esquina. El guion lo aparta antes de capturar; si escribes tu
propia captura, hacer lo mismo o interpretarás un estado de hover como el
aspecto normal.

Chromium ya está instalado en la imagen (`PLAYWRIGHT_BROWSERS_PATH`). No
ejecutar `playwright install`: el guion resuelve el paquete solo, y si falta lo
instala en una caché fuera del repositorio.
