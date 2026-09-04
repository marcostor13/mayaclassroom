import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CourseMediaProgressDto,
  LessonBlockType,
  MediaHeartbeatInput,
  MediaProgressDto,
  MediaProgressReport,
  MediaProgressReportRow,
  MediaSourceKind,
  ModuleType,
  round,
} from '@maya/shared';
import { MediaProgress, MediaProgressDocument } from './schemas/media-progress.schema';
import { CourseModule, CourseModuleDocument } from '../courses/schemas/course-module.schema';
import {
  CourseResource,
  CourseResourceDocument,
} from '../activities/resources/schemas/resource.schema';
import { CompletionService } from '../completion/completion.service';
import { toObjectId } from '../../common/utils';

/**
 * Porcentaje a partir del cual un vídeo se da por visto.
 *
 * No es el 100 % a propósito: los créditos finales, la despedida y el margen
 * que el navegador se deja al final harían que casi nadie completara nunca un
 * vídeo, y el informe dejaría de servir.
 */
const COMPLETION_PERCENT = 90;

/** Un vídeo del curso, tal como sale del contenido de las lecciones. */
interface CourseVideo {
  moduleId: string;
  courseId: string;
  mediaId: string;
  kind: MediaSourceKind;
  title: string | null;
}

/**
 * Registro de cumplimiento de visualización.
 *
 * Mide sobre los vídeos servidos por la plataforma —los bloques de medios de
 * una lección— porque son los únicos cuyo reproductor informa de la posición.
 * De un vídeo incrustado de YouTube solo puede saberse que se abrió, así que
 * cuenta para la lista pero no para el porcentaje.
 */
@Injectable()
export class MediaProgressService {
  constructor(
    @InjectModel(MediaProgress.name)
    private readonly model: Model<MediaProgressDocument>,
    @InjectModel(CourseModule.name)
    private readonly moduleModel: Model<CourseModuleDocument>,
    @InjectModel(CourseResource.name)
    private readonly resourceModel: Model<CourseResourceDocument>,
    private readonly completion: CompletionService,
  ) {}

  /* ------------------------------ Catálogo ------------------------------- */

  /**
   * Vídeos medibles de un curso.
   *
   * Se recorre el contenido de las lecciones en lugar de guardar una lista
   * aparte: la lista se desincronizaría en cuanto alguien moviera o borrara un
   * bloque, y el informe empezaría a exigir vídeos que ya no existen.
   */
  async courseVideos(courseId: string | Types.ObjectId): Promise<CourseVideo[]> {
    const modules = await this.moduleModel
      .find({
        course: toObjectId(courseId),
        moduleType: { $in: [ModuleType.Page, ModuleType.Book, ModuleType.Resource] },
        visible: true,
      })
      .lean()
      .exec();
    if (!modules.length) return [];

    const resources = await this.resourceModel
      .find({ _id: { $in: modules.map((m) => m.instance) } })
      .lean()
      .exec();
    const byInstance = new Map(resources.map((r) => [String(r._id), r]));

    const videos: CourseVideo[] = [];
    for (const module of modules) {
      const resource = byInstance.get(String(module.instance));
      if (!resource) continue;

      for (const block of resource.blocks ?? []) {
        if (block.type !== LessonBlockType.Media && block.type !== LessonBlockType.Embed) continue;
        // Un bloque de medios puede traer audio: solo se sigue el vídeo.
        if (block.type === LessonBlockType.Media && (block.mimeType ?? '').startsWith('audio/')) {
          continue;
        }
        videos.push({
          moduleId: String(module._id),
          courseId: String(module.course),
          mediaId: block.id,
          kind:
            block.type === LessonBlockType.Embed ? MediaSourceKind.Embed : MediaSourceKind.Media,
          title: block.title ?? module.name,
        });
      }
    }
    return videos;
  }

  /* ------------------------------- Latidos ------------------------------- */

  /**
   * Anota lo reproducido desde el latido anterior.
   *
   * El tramo se fusiona con lo ya visto, de modo que volver a ver el principio
   * no suma dos veces y saltar al final no rellena el hueco.
   */
  async heartbeat(
    tenantId: string | Types.ObjectId,
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: MediaHeartbeatInput,
  ): Promise<MediaProgressDto> {
    const module = await this.moduleModel.findById(toObjectId(moduleId)).exec();
    if (!module) throw new NotFoundException('Actividad no encontrada.');

    const record =
      (await this.model
        .findOne({
          courseModule: module._id,
          user: toObjectId(userId),
          mediaId: input.mediaId,
        })
        .exec()) ??
      new this.model({
        tenant: toObjectId(tenantId),
        course: module.course,
        courseModule: module._id,
        user: toObjectId(userId),
        mediaId: input.mediaId,
        kind: input.kind,
        firstPlayedAt: new Date(),
        playCount: 0,
      });

    if (input.durationSeconds > 0) record.durationSeconds = input.durationSeconds;
    if (input.title) record.title = input.title;
    record.kind = input.kind;
    record.lastPositionSeconds = input.positionSeconds;
    record.lastPlayedAt = new Date();
    if (record.playCount === 0) record.playCount = 1;

    if (input.deltaSeconds > 0) {
      const to = input.positionSeconds;
      const from = Math.max(0, to - input.deltaSeconds);
      record.segments = mergeSegments([...record.segments, { from, to }]);
    }

    record.watchedSeconds = round(
      record.segments.reduce((total, s) => total + (s.to - s.from), 0),
      2,
    );
    record.percent = record.durationSeconds
      ? Math.min(100, round((record.watchedSeconds / record.durationSeconds) * 100, 1))
      : 0;

    const wasCompleted = record.completed;
    // Un vídeo incrustado no se puede medir: se da por visto en cuanto se abre,
    // porque lo contrario dejaría el curso imposible de completar.
    record.completed =
      record.kind === MediaSourceKind.Embed || record.percent >= COMPLETION_PERCENT;
    if (record.completed && !wasCompleted) record.completedAt = new Date();

    await record.save();

    // Al terminar un vídeo puede quedar completo el módulo que lo contiene.
    if (record.completed && !wasCompleted) {
      await this.evaluateModuleCompletion(module, userId);
    }

    return this.toDto(record);
  }

  /** Registra que se volvió a abrir el vídeo, sin sumar tiempo. */
  async registerPlay(
    tenantId: string | Types.ObjectId,
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    input: Pick<MediaHeartbeatInput, 'mediaId' | 'kind' | 'title' | 'durationSeconds'>,
  ): Promise<MediaProgressDto> {
    const module = await this.moduleModel.findById(toObjectId(moduleId)).exec();
    if (!module) throw new NotFoundException('Actividad no encontrada.');

    const record = await this.model
      .findOneAndUpdate(
        { courseModule: module._id, user: toObjectId(userId), mediaId: input.mediaId },
        {
          $setOnInsert: {
            tenant: toObjectId(tenantId),
            course: module.course,
            kind: input.kind,
            firstPlayedAt: new Date(),
          },
          $set: {
            lastPlayedAt: new Date(),
            title: input.title ?? module.name,
            ...(input.durationSeconds > 0 ? { durationSeconds: input.durationSeconds } : {}),
          },
          $inc: { playCount: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();

    if (input.kind === MediaSourceKind.Embed && !record.completed) {
      record.completed = true;
      record.completedAt = new Date();
      record.percent = 100;
      await record.save();
      await this.evaluateModuleCompletion(module, userId);
    }

    return this.toDto(record);
  }

  /**
   * Si el módulo exige ver sus vídeos, comprueba si ya están todos vistos.
   *
   * La condición vive en `completionRules.video` del propio módulo, junto a las
   * demás: así el profesorado la configura donde configura el resto y el
   * servicio de finalización sigue siendo el único que decide estados.
   */
  private async evaluateModuleCompletion(
    module: CourseModuleDocument,
    userId: string | Types.ObjectId,
  ): Promise<void> {
    const rules = (module.completionRules ?? {}) as { video?: boolean };
    if (!rules.video) return;

    const videos = (await this.courseVideos(module.course)).filter(
      (v) => v.moduleId === String(module._id),
    );
    if (!videos.length) return;

    const seen = await this.model
      .countDocuments({
        courseModule: module._id,
        user: toObjectId(userId),
        mediaId: { $in: videos.map((v) => v.mediaId) },
        completed: true,
      })
      .exec();

    await this.completion.evaluate(module._id, userId, { videoWatched: seen >= videos.length });
  }

  /* ------------------------------ Consultas ------------------------------ */

  /** Avance de una persona en todos los vídeos de un curso. */
  async forUser(
    courseId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<CourseMediaProgressDto> {
    const [videos, records] = await Promise.all([
      this.courseVideos(courseId),
      this.model.find({ course: toObjectId(courseId), user: toObjectId(userId) }).exec(),
    ]);

    const byKey = new Map(records.map((r) => [`${String(r.courseModule)}:${r.mediaId}`, r]));
    const items: MediaProgressDto[] = [];
    let watched = 0;
    let total = 0;
    let completed = 0;

    for (const video of videos) {
      const record = byKey.get(`${video.moduleId}:${video.mediaId}`);
      if (record) {
        items.push(this.toDto(record));
        watched += record.watchedSeconds;
        total += record.durationSeconds;
        if (record.completed) completed += 1;
      } else {
        items.push(emptyDto(video));
      }
    }

    return {
      courseId: String(courseId),
      totalVideos: videos.length,
      completedVideos: completed,
      // Se cuenta por vídeos y no por segundos: un vídeo largo a medias no debe
      // pesar más que tres cortos terminados, que es lo que de verdad indica
      // que alguien va siguiendo el curso.
      percent: videos.length ? round((completed / videos.length) * 100, 1) : 0,
      watchedSeconds: round(watched, 0),
      totalSeconds: round(total, 0),
      items,
    };
  }

  /** Avance de una persona dentro de una sola actividad. */
  async forModule(
    moduleId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<MediaProgressDto[]> {
    const records = await this.model
      .find({ courseModule: toObjectId(moduleId), user: toObjectId(userId) })
      .exec();
    return records.map((r) => this.toDto(r));
  }

  /** Informe de visualización de todo el alumnado de un curso. */
  async courseReport(
    courseId: string | Types.ObjectId,
    users: { id: string; fullName: string; email: string; avatarUrl: string | null }[],
  ): Promise<MediaProgressReport> {
    const videos = await this.courseVideos(courseId);
    const records = await this.model
      .find({
        course: toObjectId(courseId),
        user: { $in: users.map((u) => toObjectId(u.id)) },
      })
      .lean()
      .exec();

    const valid = new Set(videos.map((v) => `${v.moduleId}:${v.mediaId}`));
    const byUser = new Map<string, typeof records>();
    for (const record of records) {
      // Un vídeo borrado de la lección deja filas huérfanas: se ignoran para no
      // dar por vistos vídeos que ya no existen.
      if (!valid.has(`${String(record.courseModule)}:${record.mediaId}`)) continue;
      const key = String(record.user);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key)!.push(record);
    }

    const rows: MediaProgressReportRow[] = users.map((user) => {
      const mine = byUser.get(user.id) ?? [];
      const completed = mine.filter((r) => r.completed).length;
      const last = mine.reduce<Date | null>(
        (latest, r) => (!latest || r.lastPlayedAt > latest ? r.lastPlayedAt : latest),
        null,
      );
      return {
        user,
        completedVideos: completed,
        totalVideos: videos.length,
        percent: videos.length ? round((completed / videos.length) * 100, 1) : 0,
        watchedSeconds: round(
          mine.reduce((total, r) => total + r.watchedSeconds, 0),
          0,
        ),
        lastPlayedAt: last ? last.toISOString() : null,
      };
    });

    const totalSeconds = await this.totalDuration(courseId, videos);
    return {
      courseId: String(courseId),
      totalVideos: videos.length,
      totalSeconds,
      rows,
      averagePercent: rows.length
        ? round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length, 1)
        : 0,
    };
  }

  /**
   * Duración total del curso en vídeo.
   *
   * La duración de un vídeo no está en el contenido de la lección —solo la
   * conoce el navegador al cargarlo—, así que se toma la mayor de las
   * registradas por quienes ya lo han abierto. Mientras nadie lo abra, cuenta
   * como cero, que es exactamente lo que se sabe de él.
   */
  private async totalDuration(
    courseId: string | Types.ObjectId,
    videos: CourseVideo[],
  ): Promise<number> {
    if (!videos.length) return 0;
    const durations = await this.model.aggregate<{ _id: string; duration: number }>([
      { $match: { course: toObjectId(courseId) } },
      {
        $group: {
          _id: { $concat: [{ $toString: '$courseModule' }, ':', '$mediaId'] },
          duration: { $max: '$durationSeconds' },
        },
      },
    ]);
    const byKey = new Map(durations.map((d) => [d._id, d.duration]));
    return round(
      videos.reduce((total, v) => total + (byKey.get(`${v.moduleId}:${v.mediaId}`) ?? 0), 0),
      0,
    );
  }

  /** Segundos de vídeo reproducidos por una persona en toda la plataforma. */
  async watchedSecondsOfUser(userId: string | Types.ObjectId): Promise<number> {
    const [result] = await this.model.aggregate<{ total: number }>([
      { $match: { user: toObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$watchedSeconds' } } },
    ]);
    return round(result?.total ?? 0, 0);
  }

  private toDto(record: MediaProgressDocument): MediaProgressDto {
    return {
      id: record.id,
      courseId: String(record.course),
      moduleId: String(record.courseModule),
      mediaId: record.mediaId,
      kind: record.kind,
      title: record.title,
      durationSeconds: record.durationSeconds,
      watchedSeconds: record.watchedSeconds,
      lastPositionSeconds: record.lastPositionSeconds,
      percent: record.percent,
      completed: record.completed,
      completedAt: record.completedAt?.toISOString() ?? null,
      firstPlayedAt: record.firstPlayedAt.toISOString(),
      lastPlayedAt: record.lastPlayedAt.toISOString(),
      playCount: record.playCount,
    };
  }
}

/** Vídeo que todavía nadie ha abierto. */
function emptyDto(video: CourseVideo): MediaProgressDto {
  return {
    id: `${video.moduleId}:${video.mediaId}`,
    courseId: video.courseId,
    moduleId: video.moduleId,
    mediaId: video.mediaId,
    kind: video.kind,
    title: video.title,
    durationSeconds: 0,
    watchedSeconds: 0,
    lastPositionSeconds: 0,
    percent: 0,
    completed: false,
    completedAt: null,
    firstPlayedAt: '',
    lastPlayedAt: '',
    playCount: 0,
  };
}

/**
 * Fusiona los tramos vistos en una lista ordenada y sin solapes.
 *
 * Es lo que convierte una ristra de latidos en «tiempo distinto reproducido».
 * Los tramos separados por menos de un segundo se unen: si no, cada pausa
 * dejaría un hueco de décimas y la lista crecería sin fin.
 */
export function mergeSegments(
  segments: { from: number; to: number }[],
): { from: number; to: number }[] {
  const clean = segments
    .map((s) => ({ from: Math.max(0, Math.min(s.from, s.to)), to: Math.max(s.from, s.to) }))
    .filter((s) => s.to - s.from > 0.05)
    .sort((a, b) => a.from - b.from);
  if (!clean.length) return [];

  const merged = [clean[0]];
  for (const segment of clean.slice(1)) {
    const last = merged[merged.length - 1];
    if (segment.from <= last.to + 1) {
      last.to = Math.max(last.to, segment.to);
    } else {
      merged.push(segment);
    }
  }
  return merged;
}
