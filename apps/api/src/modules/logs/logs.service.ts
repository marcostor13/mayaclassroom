import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';
import { LogAction } from '@maya/shared';
import { PaginatedResult } from '../../common/dto';
import { addDays, startOfDay, toObjectId } from '../../common/utils';
import { LogQueryDto } from './dto';
import { Log, LogDocument } from './schemas/log.schema';

/** Datos de un evento a registrar. */
export interface RecordLogInput {
  tenantId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  component: string;
  target: string;
  action: LogAction;
  relatedUserId?: string | Types.ObjectId | null;
  courseId?: string | Types.ObjectId | null;
  contextId?: string | Types.ObjectId | null;
  objectId?: string | Types.ObjectId | null;
  description?: string;
  ip?: string;
  userAgent?: string;
}

/** Actividad diaria agregada de un curso. */
export interface ActivityByDay {
  date: string;
  views: number;
  posts: number;
  submissions: number;
}

/** Participación acumulada de un usuario en un curso. */
export interface ParticipationEntry {
  _id: Types.ObjectId;
  total: number;
  lastAccess: Date;
}

/**
 * Registro de eventos: escritura de la traza de auditoría y lecturas agregadas
 * sobre ella (participación, actividad diaria y usuarios activos).
 */
@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(@InjectModel(Log.name) private readonly model: Model<LogDocument>) {}

  /**
   * Registra un evento. Nunca propaga errores: la traza es un efecto lateral y
   * su fallo no debe tumbar la petición que la origina.
   */
  async record(entry: RecordLogInput): Promise<LogDocument | null> {
    try {
      return await this.model.create({
        tenant: toObjectId(entry.tenantId),
        user: toObjectId(entry.userId),
        relatedUser: entry.relatedUserId ? toObjectId(entry.relatedUserId) : null,
        course: entry.courseId ? toObjectId(entry.courseId) : null,
        context: entry.contextId ? toObjectId(entry.contextId) : null,
        component: entry.component,
        target: entry.target,
        action: entry.action,
        objectId: entry.objectId ? String(entry.objectId) : null,
        description: entry.description ?? '',
        ip: entry.ip ?? '',
        userAgent: entry.userAgent ?? '',
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar el evento «${entry.action} ${entry.target}»: ${String(error)}`);
      return null;
    }
  }

  /** Listado paginado y filtrable del registro de una empresa. */
  async paginate(
    tenantId: string | Types.ObjectId,
    query: LogQueryDto,
  ): Promise<PaginatedResult<LogDocument>> {
    const filter: Record<string, unknown> = { tenant: toObjectId(tenantId) };
    if (query.userId) filter.user = toObjectId(query.userId);
    if (query.courseId) filter.course = toObjectId(query.courseId);
    if (query.action) filter.action = query.action;
    if (query.component) filter.component = query.component;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) range.$gte = new Date(query.from);
      if (query.to) range.$lte = new Date(query.to);
      filter.createdAt = range;
    }

    // Algunas llamadas internas pasan un objeto plano en lugar de una instancia
    // del DTO, así que no se puede depender de los captadores `skip`/`sortObject`.
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sort: Record<string, 1 | -1> = { createdAt: query.order === 'asc' ? 1 : -1 };

    const [items, total] = await Promise.all([
      this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return PaginatedResult.of(items, total, page, limit);
  }

  /** Usuarios distintos con actividad en el curso durante los últimos `days` días. */
  async countActiveUsers(courseId: string | Types.ObjectId, days: number): Promise<number> {
    const users = await this.model
      .distinct('user', {
        course: toObjectId(courseId),
        createdAt: { $gte: addDays(new Date(), -days) },
      })
      .exec();
    return users.length;
  }

  /**
   * Serie diaria de actividad del curso. Devuelve un punto por día del periodo,
   * incluidos los días sin eventos, para que las gráficas no tengan huecos.
   */
  async activityByDay(courseId: string | Types.ObjectId, days: number): Promise<ActivityByDay[]> {
    const since = startOfDay(addDays(new Date(), -(days - 1)));
    const pipeline: PipelineStage[] = [
      { $match: { course: toObjectId(courseId), createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          views: { $sum: { $cond: [{ $eq: ['$action', LogAction.Viewed] }, 1, 0] } },
          submissions: { $sum: { $cond: [{ $eq: ['$action', LogAction.Submitted] }, 1, 0] } },
          posts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$action', LogAction.Created] },
                    { $in: ['$target', ['post', 'discussion', 'message', 'comment']] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const rows = await this.model.aggregate<{
      _id: string;
      views: number;
      posts: number;
      submissions: number;
    }>(pipeline);
    const byDate = new Map(rows.map((row) => [row._id, row]));

    return Array.from({ length: days }, (_, offset) => {
      const date = startOfDay(addDays(since, offset)).toISOString().slice(0, 10);
      const row = byDate.get(date);
      return {
        date,
        views: row?.views ?? 0,
        posts: row?.posts ?? 0,
        submissions: row?.submissions ?? 0,
      };
    });
  }

  /** Total de eventos y último acceso de cada usuario del curso. */
  async participation(courseId: string | Types.ObjectId): Promise<ParticipationEntry[]> {
    return this.model.aggregate<ParticipationEntry>([
      { $match: { course: toObjectId(courseId) } },
      { $group: { _id: '$user', total: { $sum: 1 }, lastAccess: { $max: '$createdAt' } } },
      { $sort: { total: -1 } },
    ]);
  }
}
