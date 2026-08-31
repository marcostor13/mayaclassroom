/**
 * Validación de variables de entorno sin dependencias externas.
 * Permisiva en desarrollo, estricta en producción (secretos obligatorios).
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const env = String(config.NODE_ENV ?? 'development');
  const errors: string[] = [];

  const require = (key: string, min = 1) => {
    const value = config[key];
    if (typeof value !== 'string' || value.length < min) {
      errors.push(`${key} es obligatoria (mínimo ${min} caracteres) en producción.`);
    }
  };

  if (!config.MONGODB_URI) {
    errors.push('MONGODB_URI es obligatoria: cadena de conexión de MongoDB Atlas.');
  }

  if (env === 'production') {
    require('JWT_ACCESS_SECRET', 32);
    require('JWT_REFRESH_SECRET', 32);
    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      errors.push('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser distintos.');
    }
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push('PORT debe ser un entero válido entre 1 y 65535.');
  }

  if (errors.length) {
    throw new Error(`Configuración inválida:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}
