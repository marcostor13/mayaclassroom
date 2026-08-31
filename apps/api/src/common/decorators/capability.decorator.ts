import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { ContextLevel } from '@maya/shared';

export const CAPABILITY_KEY = 'maya:capabilities';

export interface CapabilityRequirement {
  /** Capacidades requeridas. */
  capabilities: string[];
  /** `any`: basta con una. `all`: se requieren todas. */
  mode: 'any' | 'all';
  /** Nivel de contexto donde evaluarlas. */
  contextLevel: ContextLevel;
  /**
   * Nombre del parámetro de ruta que identifica la instancia del contexto
   * (por ejemplo `courseId`). Si se omite se evalúa en el contexto del tenant.
   */
  param?: string;
}

/**
 * Exige una o varias capacidades sobre el contexto indicado.
 *
 * @example
 * ```ts
 * @RequireCapability(CAP.COURSE_UPDATE, { contextLevel: ContextLevel.Course, param: 'courseId' })
 * ```
 */
export function RequireCapability(
  capabilities: string | string[],
  options: Partial<Omit<CapabilityRequirement, 'capabilities'>> = {},
) {
  const requirement: CapabilityRequirement = {
    capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
    mode: options.mode ?? 'any',
    contextLevel: options.contextLevel ?? ContextLevel.Tenant,
    param: options.param,
  };
  return applyDecorators(
    SetMetadata(CAPABILITY_KEY, requirement),
    ApiForbiddenResponse({ description: 'No tiene permisos suficientes.' }),
  );
}
