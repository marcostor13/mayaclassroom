#!/bin/bash
# ---------------------------------------------------------------------------
# Compila la hoja global y, opcionalmente, el SCSS de un componente a CSS
# suelto, para montar un banco de pruebas estático que no necesita ni la API ni
# la base de datos.
#
#   banco-estilos.sh <directorio-salida> [ruta/al/componente.scss …]
#
# Los estilos de componente de Angular se empaquetan dentro del JS con
# atributos de encapsulación, así que no se pueden reutilizar desde un HTML
# suelto: hay que compilarlos aparte, como hace este guion.
# ---------------------------------------------------------------------------
set -euo pipefail

RAIZ="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
WEB="$RAIZ/apps/web/src"
SASS="$RAIZ/node_modules/.bin/sass"
SALIDA="${1:?Uso: banco-estilos.sh <directorio-salida> [componente.scss …]}"
shift || true

mkdir -p "$SALIDA"

# La hoja global usa `@use 'tokens'`, así que su ruta de búsqueda es styles/.
"$SASS" --no-source-map --load-path="$WEB/styles" "$WEB/styles.scss" "$SALIDA/global.css"
echo "global.css"

# Los SCSS de componente hacen `@use '../../styles/tokens'`: su ruta de
# búsqueda es la raíz de src/.
for componente in "$@"; do
  nombre="$(basename "$componente" .scss)"
  "$SASS" --no-source-map --load-path="$WEB" "$componente" "$SALIDA/$nombre.css"
  echo "$nombre.css"
done
