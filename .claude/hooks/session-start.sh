#!/bin/bash
# ---------------------------------------------------------------------------
# Preparación de la sesión de Claude Code en la web.
#
# Deja el contenedor en condiciones de compilar, analizar y probar el monorepo:
#   1. Node ≥ 22.22.3 en el PATH (los CLI de Angular y Nest lo exigen y el
#      preinstalado se queda corto).
#   2. Dependencias instaladas con Bun.
#   3. Contratos compartidos compilados: `@maya/shared` se consume desde
#      `dist/`, así que sin este paso fallan el typecheck de la API y la
#      compilación del cliente.
#
# Es idempotente: cada paso comprueba antes de actuar, de modo que volver a
# ejecutarlo sobre un contenedor ya preparado no cuesta nada.
# ---------------------------------------------------------------------------
set -euo pipefail

# En una máquina local el entorno ya es el del desarrollador; aquí solo
# interesa preparar el contenedor efímero de las sesiones remotas.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# --- 1 · Node ---------------------------------------------------------------
# Versión mínima que exige Angular 22 (ver `engines` en package.json).
NODE_MIN_MAJOR=22
NODE_MIN_MINOR=22
NODE_MIN_PATCH=3
# Versión que se instala cuando la del contenedor no llega; es la misma línea
# que usa el flujo de integración continua.
NODE_TARGET=24

node_is_recent_enough() {
  command -v node >/dev/null 2>&1 || return 1
  local version major minor patch
  version="$(node -v)"; version="${version#v}"
  IFS='.' read -r major minor patch <<<"$version"
  [ "$major" -gt "$NODE_MIN_MAJOR" ] && return 0
  [ "$major" -lt "$NODE_MIN_MAJOR" ] && return 1
  [ "$minor" -gt "$NODE_MIN_MINOR" ] && return 0
  [ "$minor" -lt "$NODE_MIN_MINOR" ] && return 1
  [ "$patch" -ge "$NODE_MIN_PATCH" ]
}

if node_is_recent_enough; then
  echo "Node $(node -v) ya cumple el mínimo requerido."
else
  echo "Node $(node -v 2>/dev/null || echo 'ausente') se queda por debajo de" \
       "v${NODE_MIN_MAJOR}.${NODE_MIN_MINOR}.${NODE_MIN_PATCH}; se prepara Node ${NODE_TARGET}."

  export NVM_DIR="${NVM_DIR:-/opt/nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "No se encontró nvm en $NVM_DIR; se continúa con el Node del sistema." >&2
  else
    # shellcheck disable=SC1091  # nvm.sh no existe en el momento del análisis.
    . "$NVM_DIR/nvm.sh"
    nvm install "$NODE_TARGET" >/dev/null
    nvm use "$NODE_TARGET" >/dev/null

    # `nvm use` solo afecta a este proceso. Persistir el directorio en el PATH
    # de la sesión es lo que hace que los comandos posteriores del agente
    # encuentren el Node correcto.
    NODE_BIN="$(dirname "$(nvm which "$NODE_TARGET")")"
    export PATH="$NODE_BIN:$PATH"
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
    fi
    echo "Node $(node -v) activo desde $NODE_BIN."
  fi
fi

# --- 2 · Dependencias -------------------------------------------------------
# `install` (y no `install --frozen-lockfile`) para que el contenedor cacheado
# se reutilice bien entre sesiones.
echo "Instalando dependencias con Bun…"
bun install

# --- 3 · Contratos compartidos ---------------------------------------------
echo "Compilando @maya/shared…"
bun run build:shared

echo "Entorno listo: bun run test · bun run lint · bun run build."
