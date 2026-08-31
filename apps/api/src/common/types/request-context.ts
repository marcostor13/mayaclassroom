import type { Request } from 'express';
import type { Types } from 'mongoose';
import type { AuthenticatedUser } from '@maya/shared';

export interface RequestUser extends AuthenticatedUser {
  /** Identificadores en formato ObjectId para consultas directas. */
  _id: Types.ObjectId;
  _tenantId: Types.ObjectId;
}

export interface MayaRequest extends Request {
  user?: RequestUser;
  tenantId?: string;
  tenantSlug?: string;
  requestId?: string;
  /** Caché de resolución de capacidades por petición. */
  capabilityCache?: Map<string, boolean>;
}
