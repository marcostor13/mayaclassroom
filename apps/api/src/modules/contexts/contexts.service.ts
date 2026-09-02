import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CONTEXT_DEPTH, ContextLevel } from '@maya/shared';
import { Context, ContextDocument } from './schemas/context.schema';
import { toObjectId } from '../../common/utils';

/**
 * Gestiona el árbol de contextos. Toda entidad sobre la que se pueden asignar
 * roles obtiene aquí su contexto, y la resolución de permisos se apoya en la
 * ruta materializada que este servicio mantiene.
 */
@Injectable()
export class ContextsService {
  private readonly logger = new Logger(ContextsService.name);

  constructor(@InjectModel(Context.name) private readonly model: Model<ContextDocument>) {}

  /** Contexto raíz del sistema; se crea la primera vez que se solicita. */
  async getSystemContext(): Promise<ContextDocument> {
    const existing = await this.model.findOne({ level: ContextLevel.System }).exec();
    if (existing) return existing;

    const created = new this.model({
      level: ContextLevel.System,
      instanceId: null,
      parent: null,
      depth: 0,
      path: '/',
      tenant: null,
      label: 'Plataforma',
    });
    await created.save();
    created.path = `/${created._id.toString()}/`;
    await created.save();
    this.logger.log('Contexto de sistema creado');
    return created;
  }

  async findById(id: string | Types.ObjectId): Promise<ContextDocument> {
    const context = await this.model.findById(toObjectId(id)).exec();
    if (!context) throw new NotFoundException('Contexto no encontrado.');
    return context;
  }

  async findByInstance(
    level: ContextLevel,
    instanceId: string | Types.ObjectId,
  ): Promise<ContextDocument | null> {
    return this.model.findOne({ level, instanceId: toObjectId(instanceId) }).exec();
  }

  async requireByInstance(
    level: ContextLevel,
    instanceId: string | Types.ObjectId,
  ): Promise<ContextDocument> {
    const context = await this.findByInstance(level, instanceId);
    if (!context) {
      throw new NotFoundException(`No existe contexto ${level} para ${String(instanceId)}.`);
    }
    return context;
  }

  /**
   * Crea (o devuelve) el contexto de una instancia, enganchándolo al padre y
   * calculando la ruta materializada.
   */
  async ensureContext(params: {
    level: ContextLevel;
    instanceId: string | Types.ObjectId;
    parentId?: string | Types.ObjectId | null;
    tenantId?: string | Types.ObjectId | null;
    label?: string;
  }): Promise<ContextDocument> {
    const instanceId = toObjectId(params.instanceId);
    const existing = await this.model.findOne({ level: params.level, instanceId }).exec();

    // Un contexto que ya existe solo se reubica si se pide un padre concreto.
    //
    // Antes, omitir el padre significaba «cuélgalo del sistema», y bastaba con
    // llamar aquí para refrescar la etiqueta —algo que se hace al guardar
    // cualquier cambio— para sacar el subárbol entero del sitio donde estaba.
    // Un curso así queda fuera del alcance de los roles de su empresa y deja
    // de dejar entrar a nadie, incluida quien lo administra.
    if (existing && !params.parentId) {
      if (params.label && existing.label !== params.label) {
        existing.label = params.label;
        await existing.save();
      }
      return existing;
    }

    const parent = params.parentId
      ? await this.findById(params.parentId)
      : await this.getSystemContext();

    if (existing) {
      const nextPath = `${parent.path}${existing._id.toString()}/`;
      if (existing.path !== nextPath || String(existing.parent) !== String(parent._id)) {
        await this.moveSubtree(existing, parent);
      }
      if (params.label && existing.label !== params.label) {
        existing.label = params.label;
        await existing.save();
      }
      return existing;
    }

    const created = new this.model({
      level: params.level,
      instanceId,
      parent: parent._id,
      depth: parent.depth + 1,
      path: parent.path,
      tenant: params.tenantId ? toObjectId(params.tenantId) : parent.tenant,
      label: params.label ?? '',
    });
    await created.save();
    created.path = `${parent.path}${created._id.toString()}/`;
    await created.save();
    return created;
  }

  /** Reubica un contexto y todos sus descendientes bajo un nuevo padre. */
  async moveSubtree(context: ContextDocument, newParent: ContextDocument): Promise<void> {
    const oldPath = context.path;
    const newPath = `${newParent.path}${context._id.toString()}/`;
    const depthShift = newParent.depth + 1 - context.depth;

    context.parent = newParent._id;
    context.path = newPath;
    context.depth = newParent.depth + 1;
    context.tenant = newParent.tenant ?? context.tenant;
    await context.save();

    const descendants = await this.model
      .find({ path: { $regex: `^${this.escape(oldPath)}` }, _id: { $ne: context._id } })
      .exec();

    await Promise.all(
      descendants.map((child) => {
        child.path = child.path.replace(oldPath, newPath);
        child.depth += depthShift;
        child.tenant = newParent.tenant ?? child.tenant;
        return child.save();
      }),
    );
  }

  /** Todos los identificadores de contexto de la rama, de la raíz a la hoja. */
  parentIdsFromPath(path: string): Types.ObjectId[] {
    return path
      .split('/')
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));
  }

  /** Contextos ancestros (incluido él mismo) de un contexto dado. */
  async ancestors(context: ContextDocument): Promise<ContextDocument[]> {
    const ids = this.parentIdsFromPath(context.path);
    const docs = await this.model.find({ _id: { $in: ids } }).exec();
    const order = new Map(ids.map((id, index) => [id.toString(), index]));
    return docs.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  /** Contextos descendientes de un contexto dado. */
  async descendants(context: ContextDocument, level?: ContextLevel): Promise<ContextDocument[]> {
    const filter: Record<string, unknown> = {
      path: { $regex: `^${this.escape(context.path)}` },
      _id: { $ne: context._id },
    };
    if (level) filter.level = level;
    return this.model.find(filter).exec();
  }

  async deleteForInstance(level: ContextLevel, instanceId: string | Types.ObjectId): Promise<void> {
    const context = await this.findByInstance(level, instanceId);
    if (!context) return;
    await this.model.deleteMany({ path: { $regex: `^${this.escape(context.path)}` } }).exec();
  }

  /** Profundidad nominal del nivel, usada al ordenar resoluciones de permisos. */
  nominalDepth(level: ContextLevel): number {
    return CONTEXT_DEPTH[level];
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
