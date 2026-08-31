# ── Compilación ──────────────────────────────────────────────────────────────
# El CLI de Angular 22 exige Node ≥ 22.22.3.
FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @maya/shared --workspace @maya/web --include-workspace-root

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace @maya/shared && npm run build --workspace @maya/web

# ── Servidor estático ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 80
