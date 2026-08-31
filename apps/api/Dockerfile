# ── Compilación ──────────────────────────────────────────────────────────────
# Se parte de Node porque el CLI de Nest se invoca mediante un shebang `node`;
# Bun se añade encima y es quien instala las dependencias y ejecuta los guiones.
FROM node:22-bookworm-slim AS build
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# Se copian todos los manifiestos del espacio de trabajo para que bun.lock
# concuerde; `--filter` limita la instalación a los paquetes que hacen falta.
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --filter '@maya/shared' --filter '@maya/api'

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN bun run --filter @maya/shared build && bun run --filter @maya/api build

# ── Ejecución ────────────────────────────────────────────────────────────────
FROM oven/bun:1-debian AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production \
      --filter '@maya/shared' --filter '@maya/api' \
  && rm -rf /root/.bun/install/cache

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist

RUN mkdir -p /data/storage && chown -R bun:bun /data/storage
USER bun
EXPOSE 3000
CMD ["bun", "apps/api/dist/main.js"]
