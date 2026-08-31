/**
 * El cliente reutiliza los contratos publicados por la API a través del paquete
 * `@maya/shared`, de modo que cualquier cambio en el backend se detecta en
 * tiempo de compilación aquí.
 */
export * from '@maya/shared';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  requestId?: string;
  timestamp: string;
}

export interface ApiError {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  details?: unknown;
  path: string;
  timestamp: string;
}
