import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { AuthenticatedUser } from '@maya/shared';

export interface RequestUser extends AuthenticatedUser {
  /** Identificadores en formato ObjectId para consultas directas. */
  _id: Types.ObjectId;
  _tenantId: Types.ObjectId;
  /**
   * La sesión entró por el acceso de demostración. Es propiedad de la sesión,
   * no de la cuenta: `DemoGuard` la usa para negar toda escritura que no sea
   * contenido docente.
   */
  isDemo?: boolean;
}

export interface MayaRequest extends Request {
  user?: RequestUser;
  tenantId?: string;
  tenantSlug?: string;
  requestId?: string;
  /** Caché de resolución de capacidades por petición. */
  capabilityCache?: Map<string, boolean>;
}
