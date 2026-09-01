export * from './capabilities';
export * from './roles';
export * from './branding';

/** Prefijo global y versión de la API REST. */
export const API_PREFIX = 'api';
export const API_VERSION = 'v1';

/** Cabecera usada para resolver la empresa (tenant) activa. */
export const TENANT_HEADER = 'x-maya-tenant';

/**
 * Código de error con el que la API rechaza cualquier petición de un usuario
 * que arrastra una contraseña temporal. El cliente lo reconoce para llevarlo a
 * la pantalla de cambio de contraseña en lugar de mostrar un error genérico.
 */
export const PASSWORD_CHANGE_REQUIRED = 'PasswordChangeRequired';

/** Identificador del tenant reservado para la administración de plataforma. */
export const SYSTEM_TENANT_SLUG = 'system';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Límites de subida por defecto (bytes). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
