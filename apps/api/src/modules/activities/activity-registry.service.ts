import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { ModuleType } from '@maya/shared';

export interface ActivityCreateInput {
  tenantId: Types.ObjectId;
  courseId: Types.ObjectId;
  name: string;
  description?: string | null;
  settings: Record<string, unknown>;
  userId: Types.ObjectId;
}

export interface ActivityInstanceResult {
  id: Types.ObjectId;
  /** Nota máxima si la actividad es calificable; `null` si no lo es. */
  gradeMax: number | null;
}

/**
 * Contrato que implementa cada tipo de actividad o recurso. Equivale a la API
 * de plugins `mod_*` de Moodle: permite añadir tipos nuevos sin tocar el núcleo
 * de cursos.
 */
export interface ActivityHandler {
  readonly type: ModuleType;
  /** Etiqueta legible mostrada en el selector de actividades. */
  readonly label: string;
  readonly icon: string;
  readonly gradable: boolean;
  create(input: ActivityCreateInput): Promise<ActivityInstanceResult>;
  update(
    instanceId: Types.ObjectId,
    input: Partial<ActivityCreateInput>,
  ): Promise<ActivityInstanceResult>;
  remove(instanceId: Types.ObjectId): Promise<void>;
  get(instanceId: Types.ObjectId): Promise<unknown>;
  duplicate?(instanceId: Types.ObjectId, targetCourseId: Types.ObjectId): Promise<Types.ObjectId>;
  /** Exporta la instancia para copias de seguridad. */
  exportInstance?(instanceId: Types.ObjectId): Promise<Record<string, unknown>>;
}

/** Registro central de tipos de actividad disponibles. */
@Injectable()
export class ActivityRegistry {
  private readonly logger = new Logger(ActivityRegistry.name);
  private readonly handlers = new Map<ModuleType, ActivityHandler>();

  register(handler: ActivityHandler): void {
    this.handlers.set(handler.type, handler);
    this.logger.log(`Actividad registrada: ${handler.type}`);
  }

  get(type: ModuleType): ActivityHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new BadRequestException(`El tipo de actividad «${type}» no está disponible.`);
    }
    return handler;
  }

  has(type: ModuleType): boolean {
    return this.handlers.has(type);
  }

  /** Catálogo para el selector «Añadir una actividad o recurso». */
  catalog(): { type: ModuleType; label: string; icon: string; gradable: boolean }[] {
    return Array.from(this.handlers.values())
      .map((h) => ({ type: h.type, label: h.label, icon: h.icon, gradable: h.gradable }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}
