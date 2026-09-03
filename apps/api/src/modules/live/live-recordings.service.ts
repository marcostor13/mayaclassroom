import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { FilterQuery } from 'mongoose';
import { Model, Types } from 'mongoose';
import { CAP, LiveRecordingStatus } from '@maya/shared';
import type { LiveRecordingDto } from '@maya/shared';
import type { LiveConfig } from '../../config';
import { notDeleted, toObjectId } from '../../common/utils';
import { LiveRecording, LiveRecordingDocument } from './schemas/live-recording.schema';
import { LiveSession, LiveSessionDocument } from './schemas/live-session.schema';
import { LiveRequester, LiveService } from './live.service';
import type { FinishRecordingDto, StartRecordingDto, UpdateRecordingDto } from './dto/live.dto';
import { FilesService } from '../files/files.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Tipos que el navegador puede producir con `MediaRecorder`. */
const ALLOWED_MIME = ['video/webm', 'video/mp4', 'video/x-matroska'];

/**
 * Grabación de las clases.
 *
 * El vídeo lo compone y codifica el navegador de quien presenta —ya tiene todas
 * las pistas y la disposición en pantalla— y lo va enviando por trozos. El
 * servidor los acumula en disco y, al terminar, los une y los guarda como un
 * fichero más de la plataforma. Componerlo aquí exigiría un servidor de medios
 * con FFmpeg y decodificar cada pista: mucha máquina para lo que la pestaña ya
 * está haciendo de todos modos.
 *
 * El precio es que la grabación depende de que esa pestaña siga abierta hasta
 * el final; por eso la interfaz avisa antes de cerrarla y el estado
 * `recording` de una grabación que nunca se cierra se puede podar sin miedo.
 */
@Injectable()
export class LiveRecordingsService {
  private readonly logger = new Logger(LiveRecordingsService.name);

  constructor(
    @InjectModel(LiveRecording.name) private readonly model: Model<LiveRecordingDocument>,
    @InjectModel(LiveSession.name) private readonly sessionModel: Model<LiveSessionDocument>,
    private readonly live: LiveService,
    private readonly files: FilesService,
    private readonly enrolments: EnrolmentsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): LiveConfig {
    return this.config.getOrThrow<LiveConfig>('live');
  }

  /** Carpeta de trozos de una grabación, siempre dentro del área de trabajo. */
  private stagingDir(recordingId: string): string {
    const base = resolve(this.settings.recordingStagingPath);
    const target = resolve(join(base, recordingId));
    if (!target.startsWith(base)) {
      throw new BadRequestException('Identificador de grabación no válido.');
    }
    return target;
  }

  /* ------------------------------ Ciclo de vida --------------------------- */

  async start(
    user: LiveRequester,
    session: LiveSessionDocument,
    dto: StartRecordingDto,
  ): Promise<LiveRecordingDocument> {
    if (!(await this.live.canRecord(user, session))) {
      throw new ForbiddenException('No tiene permiso para grabar esta sesión.');
    }

    const mimeType = dto.mimeType?.split(';')[0]?.trim() || 'video/webm';
    if (!ALLOWED_MIME.includes(mimeType)) {
      throw new BadRequestException(`No se admite el formato «${mimeType}».`);
    }

    const recording = await this.model.create({
      tenant: session.tenant,
      session: session._id,
      title: dto.title?.trim() || session.title,
      status: LiveRecordingStatus.Recording,
      recordedBy: toObjectId(user.id),
      startedAt: new Date(),
      mimeType,
      visibleToStudents: session.settings.recordingVisibleToStudents ?? true,
      createdBy: toObjectId(user.id),
    });

    await mkdir(this.stagingDir(recording.id), { recursive: true });
    return recording;
  }

  /**
   * Recibe un trozo. Se guarda como fichero suelto numerado en lugar de
   * añadirse a uno solo para que reenviar un trozo tras un corte de red lo
   * sustituya en su sitio en vez de duplicarlo a mitad del vídeo.
   */
  async appendChunk(
    user: LiveRequester,
    recordingId: string,
    index: number,
    data: Buffer,
  ): Promise<{ received: number; size: number }> {
    const recording = await this.findById(recordingId, user.tenantId);
    if (recording.status !== LiveRecordingStatus.Recording) {
      throw new BadRequestException('Esta grabación ya no admite más trozos.');
    }
    if (String(recording.recordedBy) !== user.id) {
      throw new ForbiddenException('Solo quien inició la grabación puede enviar sus trozos.');
    }
    if (!Number.isInteger(index) || index < 0 || index > 100_000) {
      throw new BadRequestException('El número de trozo no es válido.');
    }
    if (data.length > this.settings.recordingChunkSize) {
      throw new BadRequestException('El trozo supera el tamaño máximo permitido.');
    }
    if (recording.size + data.length > this.settings.recordingMaxSize) {
      await this.fail(recording, 'La grabación ha superado el tamaño máximo permitido.');
      throw new BadRequestException('La grabación ha superado el tamaño máximo permitido.');
    }

    const dir = this.stagingDir(recording.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${String(index).padStart(6, '0')}.part`), data);

    await this.model
      .updateOne(
        { _id: recording._id },
        { $inc: { size: data.length, chunkCount: 1 } },
      )
      .exec();

    return { received: recording.chunkCount + 1, size: recording.size + data.length };
  }

  /** Une los trozos, los guarda como fichero de la plataforma y publica. */
  async finish(
    user: LiveRequester,
    recordingId: string,
    dto: FinishRecordingDto,
  ): Promise<LiveRecordingDto> {
    const recording = await this.findById(recordingId, user.tenantId);
    if (String(recording.recordedBy) !== user.id) {
      throw new ForbiddenException('Solo quien inició la grabación puede cerrarla.');
    }
    if (recording.status === LiveRecordingStatus.Ready) return this.toDto(recording, user);

    recording.status = LiveRecordingStatus.Processing;
    recording.finishedAt = new Date();
    recording.durationSeconds = dto.durationSeconds;
    await recording.save();

    const dir = this.stagingDir(recording.id);
    try {
      const partes = (await readdir(dir)).filter((f) => f.endsWith('.part')).sort();
      if (!partes.length) throw new Error('No se ha recibido ningún trozo.');

      // Los trozos de `MediaRecorder` son un flujo continuo: el primero trae la
      // cabecera y el resto son clústeres que continúan donde quedó el
      // anterior. Unidos en orden dan un fichero reproducible sin recodificar.
      const buffers: Buffer[] = [];
      for (const parte of partes) buffers.push(await readFile(join(dir, parte)));
      const completo = Buffer.concat(buffers);

      const session = await this.sessionModel.findById(recording.session).exec();
      const extension = recording.mimeType === 'video/mp4' ? 'mp4' : 'webm';
      const stored = await this.files.upload({
        tenantId: recording.tenant,
        ownerId: recording.recordedBy,
        component: 'maya/live',
        fileArea: 'recording',
        itemId: recording._id,
        file: {
          originalname: `${slug(recording.title)}.${extension}`,
          mimetype: recording.mimeType,
          buffer: completo,
          size: completo.length,
        },
        maxSize: this.settings.recordingMaxSize,
        makeThumbnail: false,
      });

      recording.file = stored._id;
      recording.size = completo.length;
      recording.status = LiveRecordingStatus.Ready;
      await recording.save();

      if (session) {
        await this.sessionModel
          .updateOne({ _id: session._id }, { $inc: { recordingCount: 1 } })
          .exec();
        await this.announce(session, recording).catch((error: unknown) =>
          this.logger.warn(`No se pudo avisar de la grabación: ${String(error)}`),
        );
      }
    } catch (error) {
      await this.fail(recording, String(error));
      throw new BadRequestException('No se ha podido guardar la grabación.');
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }

    return this.toDto(recording, user);
  }

  private async fail(recording: LiveRecordingDocument, reason: string): Promise<void> {
    recording.status = LiveRecordingStatus.Failed;
    recording.error = reason.slice(0, 500);
    await recording.save();
    await rm(this.stagingDir(recording.id), { recursive: true, force: true }).catch(
      () => undefined,
    );
    this.logger.warn(`Grabación ${recording.id} fallida: ${reason}`);
  }

  /** Cierre en falso: la pestaña se fue sin terminar. */
  async abort(user: LiveRequester, recordingId: string): Promise<void> {
    const recording = await this.findById(recordingId, user.tenantId);
    if (String(recording.recordedBy) !== user.id) {
      throw new ForbiddenException('Solo quien inició la grabación puede cancelarla.');
    }
    if (recording.status === LiveRecordingStatus.Ready) return;
    await this.fail(recording, 'Cancelada por quien grababa.');
  }

  private async announce(
    session: LiveSessionDocument,
    recording: LiveRecordingDocument,
  ): Promise<void> {
    if (!recording.visibleToStudents || !session.course) return;
    const alumnado = (await this.enrolments.activeUserIds(session.course)).filter(
      (id) => String(id) !== String(recording.recordedBy),
    );
    if (!alumnado.length) return;

    await this.notifications.notify({
      tenantId: session.tenant,
      userIds: alumnado,
      component: 'maya/live',
      eventName: 'live_recording_ready',
      subject: `Grabación disponible: ${recording.title}`,
      body: 'Ya puede ver la grabación de la clase cuando quiera.',
      contextUrl: `/live/sessions/${session.id}`,
      icon: 'play-circle',
      fromUserId: recording.recordedBy,
    });
  }

  /* -------------------------------- Consulta ------------------------------ */

  async findById(
    id: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<LiveRecordingDocument> {
    const recording = await this.model
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId), ...notDeleted })
      .exec();
    if (!recording) throw new NotFoundException('La grabación no existe.');
    return recording;
  }

  /** Grabaciones de una sesión, filtradas por lo que esta persona puede ver. */
  async listBySession(
    user: LiveRequester,
    session: LiveSessionDocument,
  ): Promise<LiveRecordingDto[]> {
    const puedeGestionar = await this.live.canManage(user, session);
    const filter: FilterQuery<LiveRecordingDocument> = {
      session: session._id,
      tenant: toObjectId(user.tenantId),
      ...notDeleted,
    };
    if (!puedeGestionar) {
      filter.status = LiveRecordingStatus.Ready;
      filter.visibleToStudents = true;
    }

    const rows = await this.model.find(filter).sort({ startedAt: -1 }).exec();
    return Promise.all(rows.map((row) => this.toDto(row, user, session, puedeGestionar)));
  }

  /** Biblioteca de grabaciones de esta persona: las suyas y las de sus cursos. */
  async library(user: LiveRequester, limit = 50): Promise<LiveRecordingDto[]> {
    const gestionaTodo =
      user.isPlatformAdmin || user.capabilities.includes(CAP.LIVE_MANAGE_ANY);

    let sessionFilter: FilterQuery<LiveSessionDocument> = {
      tenant: toObjectId(user.tenantId),
      ...notDeleted,
    };
    if (!gestionaTodo) {
      const courseIds = await this.enrolments.courseIdsOfUser(user.id);
      sessionFilter = {
        ...sessionFilter,
        $or: [
          { host: toObjectId(user.id) },
          { coHosts: toObjectId(user.id) },
          { course: { $in: courseIds } },
          { openToTenant: true },
        ],
      };
    }

    const sessions = await this.sessionModel.find(sessionFilter).select('_id').lean().exec();
    const sessionIds = sessions.map((s) => s._id);
    if (!sessionIds.length) return [];

    const filter: FilterQuery<LiveRecordingDocument> = {
      tenant: toObjectId(user.tenantId),
      session: { $in: sessionIds },
      status: LiveRecordingStatus.Ready,
      ...notDeleted,
    };
    if (!gestionaTodo) {
      filter.$or = [{ visibleToStudents: true }, { recordedBy: toObjectId(user.id) }];
    }

    const rows = await this.model.find(filter).sort({ startedAt: -1 }).limit(limit).exec();
    return Promise.all(rows.map((row) => this.toDto(row, user)));
  }

  async update(
    user: LiveRequester,
    id: string,
    dto: UpdateRecordingDto,
  ): Promise<LiveRecordingDto> {
    const recording = await this.findById(id, user.tenantId);
    const session = await this.requireSession(recording, user);
    await this.live.requireManage(user, session);

    if (dto.title !== undefined) recording.title = dto.title.trim() || recording.title;
    if (dto.visibleToStudents !== undefined) recording.visibleToStudents = dto.visibleToStudents;
    recording.updatedBy = toObjectId(user.id);
    await recording.save();
    return this.toDto(recording, user, session, true);
  }

  async remove(user: LiveRequester, id: string): Promise<void> {
    const recording = await this.findById(id, user.tenantId);
    const session = await this.requireSession(recording, user);
    await this.live.requireManage(user, session);

    if (recording.file) {
      await this.files.remove(recording.file, user.id).catch(() => undefined);
    }
    recording.deletedAt = new Date();
    recording.updatedBy = toObjectId(user.id);
    await recording.save();
    await this.sessionModel
      .updateOne({ _id: recording.session, recordingCount: { $gt: 0 } }, { $inc: { recordingCount: -1 } })
      .exec();
  }

  /** Entrega el vídeo comprobando antes que esta persona puede verlo. */
  async download(user: LiveRequester, id: string) {
    const recording = await this.findById(id, user.tenantId);
    if (recording.status !== LiveRecordingStatus.Ready || !recording.file) {
      throw new NotFoundException('La grabación todavía no está disponible.');
    }
    const session = await this.requireSession(recording, user);
    const puedeGestionar = await this.live.canManage(user, session);

    if (!puedeGestionar) {
      if (!recording.visibleToStudents) {
        throw new ForbiddenException('Esta grabación no está publicada.');
      }
      if (!session.openToTenant && session.course) {
        const matriculado = await this.enrolments.isEnrolled(session.course, user.id);
        if (!matriculado) {
          throw new ForbiddenException('No está matriculado en el curso de esta clase.');
        }
      }
    }

    return { recording, ...(await this.files.download(recording.file)) };
  }

  private async requireSession(
    recording: LiveRecordingDocument,
    user: LiveRequester,
  ): Promise<LiveSessionDocument> {
    const session = await this.sessionModel
      .findOne({ _id: recording.session, tenant: toObjectId(user.tenantId) })
      .exec();
    if (!session) throw new NotFoundException('La sesión de la grabación no existe.');
    return session;
  }

  /* ----------------------------- Serialización ---------------------------- */

  async toDto(
    recording: LiveRecordingDocument,
    user: LiveRequester,
    session?: LiveSessionDocument,
    canManage?: boolean,
  ): Promise<LiveRecordingDto> {
    const owner = session ?? (await this.sessionModel.findById(recording.session).exec());
    const gestiona =
      canManage ?? (owner ? await this.live.canManage(user, owner) : false);
    const refs = await this.live.userRefs([recording.recordedBy]);

    return {
      id: recording.id,
      sessionId: String(recording.session),
      sessionTitle: owner?.title ?? '',
      title: recording.title,
      status: recording.status,
      startedAt: recording.startedAt.toISOString(),
      durationSeconds: recording.durationSeconds,
      size: recording.size,
      mimeType: recording.mimeType,
      url:
        recording.status === LiveRecordingStatus.Ready
          ? `/live/recordings/${recording.id}/media`
          : null,
      recordedBy: refs.get(String(recording.recordedBy)) ?? {
        id: String(recording.recordedBy),
        fullName: 'Usuario',
        avatarUrl: null,
      },
      visibleToStudents: recording.visibleToStudents,
      canManage: gestiona,
      createdAt: recording.createdAt.toISOString(),
    };
  }
}

/** Nombre de fichero legible y seguro a partir del título de la sesión. */
function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'grabacion'
  );
}
