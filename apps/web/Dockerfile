# ── Compilación ──────────────────────────────────────────────────────────────
# El CLI de Angular 22 exige Node ≥ 22.22.3 y se invoca con shebang `node`;
# Bun se añade encima y es quien instala las dependencias y ejecuta los guiones.
FROM node:24-bookworm-slim AS build
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# URL pública de la API. En Coolify el cliente y la API viven en dominios
# distintos, así que el navegador llama directamente al dominio de la API. El
# valor se incrusta en el paquete al compilar, de ahí que sea un ARG.
ARG API_URL=/api/v1

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --filter '@maya/shared' --filter '@maya/web'

COPY packages/shared packages/shared
COPY apps/web apps/web

RUN printf '%s\n' \
  "export const environment = {" \
  "  production: true," \
  "  apiUrl: '${API_URL}'," \
  "  appName: 'Maya Classroom'," \
  "  defaultTenant: ''," \
  "};" > apps/web/src/environments/environment.prod.ts \
  && echo "API_URL incrustada: ${API_URL}"

RUN bun run --filter @maya/shared build && bun run --filter @maya/web build

# ── Servidor estático ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
