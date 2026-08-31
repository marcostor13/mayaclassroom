---
paths:
  - "apps/web/src/**/*.scss"
  - "apps/web/src/styles/**"
  - "apps/web/src/app/shared/components/*.ts"
---

# Sistema de diseño

Identidad: **blanco con rojo**, esquinas muy redondeadas, sombras neutras y
lenguaje de app. Todo vive en variables CSS `--maya-*` declaradas en
`styles/_tokens.scss`.

## Color

Nunca escribir un color en crudo. Cada valor fijo rompe el tema oscuro y la
personalización de marca por empresa, que reasigna `--maya-primary` en
tiempo de ejecución desde `ThemeService.applyBranding()`.

El rojo tiene tres papeles y no son intercambiables:

| Token | Contraste sobre blanco | Uso |
|---|---|---|
| `--maya-primary` | 3.4:1 | Rellenos: botones, chips, marca, iconos grandes |
| `--maya-primary-ink` | 6.1:1 | **Texto** rojo: enlaces, etiquetas activas |
| `--maya-primary-deep` | 7.6:1 | Texto sobre fondos claros ya teñidos de rojo |

Usar `--maya-primary` como color de texto sobre blanco incumple el mínimo AA.

## Estructura

`$maya-bp-app` (1024 px) es la frontera entre la experiencia de app (cajón +
barra inferior) y la de escritorio (barra lateral fija). Para el cromo de
navegación usar los mixins `app-only`/`desktop-only` y las clases
`.maya-app-only`/`.maya-desktop-only`, no los puntos `md`: si ambas fronteras
divergen, quedan resoluciones sin barra inferior *ni* barra lateral.

`LayoutService.isDesktop` usa esa misma consulta de medios, de modo que
plantilla y CSS conmutan a la vez.

## Móvil

- Objetivos táctiles de 44 px como mínimo (`.maya-btn` ya lo garantiza).
- Los campos de formulario van a 16 px en móvil: por debajo, Safari de iOS hace
  zoom al enfocarlos.
- Respetar las zonas seguras con `--maya-safe-top` / `--maya-safe-bottom` en
  todo lo fijado a un borde de la pantalla.
- Sin `:hover` como único estado: en táctil no existe. Dar respuesta con
  `:active`.

## Iconos

`<maya-icon [name]="…" [size]="…" />` con el conjunto de
`shared/components/icon.component.ts`. Los de navegación tienen versión
rellena: `[variant]="activo ? 'solid' : 'outline'"`, y si el icono no la tiene
cae al contorno solo.

Al añadir un icono relleno, comprobar que sus trazos **no se solapan entre
sí**: el `<svg>` se dibuja con `fill-rule="evenodd"`, así que un solape se cala
como hueco. Los subtrazos que sí deben ser huecos (el aro de la lupa, los
puntos del calendario) se apoyan justamente en eso.

## Marca

`<maya-logo [size]="…" [showText]="…" textLayout="stacked|inline" />`. El
símbolo se tiñe con `var(--maya-primary)`; para colocarlo sobre un fondo rojo,
reasignar esa variable en el contenedor en lugar de tocar el SVG.
