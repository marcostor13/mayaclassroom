import { SetMetadata } from '@nestjs/common';
import type { LogAction } from '@maya/shared';

export const AUDIT_KEY = 'maya:audit';

export interface AuditMetadata {
  action: LogAction;
  target: string;
  description?: string;
}

/** Registra automáticamente la acción en el log de eventos. */
export const Audit = (action: LogAction, target: string, description?: string) =>
  SetMetadata(AUDIT_KEY, { action, target, description } satisfies AuditMetadata);
