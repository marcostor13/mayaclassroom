# ── Compilación ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --workspace @maya/shared --workspace @maya/api --include-workspace-root

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace @maya/shared && npm run build --workspace @maya/api

# ── Ejecución ────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace @maya/shared --workspace @maya/api --include-workspace-root \
  && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist

RUN mkdir -p /data/storage && chown -R node:node /data/storage
USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
