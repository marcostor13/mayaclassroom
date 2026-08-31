/**
 * Configuración de producción. `apiUrl` se reescribe al construir la imagen
 * (ARG `API_URL` en apps/web/Dockerfile) porque en Coolify el cliente y la API
 * viven en dominios distintos y la llamada va directa del navegador a la API,
 * amparada por `CORS_ORIGINS`.
 *
 * El valor por omisión es la ruta relativa, válida cuando algo sirve ambos bajo
 * el mismo origen (el docker-compose local, donde nginx hace de proxy).
 */
export const environment = {
  production: true,
  apiUrl: '/api/v1',
  appName: 'Maya Classroom',
  defaultTenant: '',
};
