import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHmac, randomInt } from 'node:crypto';
import type { FilterQuery } from 'mongoose';
import { Model, Types } from 'mongoose';
import {
  CAP,
  CalendarEventType,
  ContextLevel,
  DEFAULT_LIVE_SETTINGS,
  LiveParticipantRole,
  LiveSessionMode,
  LiveSessionStatus,
  fullName,
} from '@maya/shared';
import type {
  LiveChatMessageDto,
  LiveIceConfigDto,
  LiveSessionDto,
  LiveSessionSettings,
  LiveUserRef,
} from '@maya/shared';
import type { AppConfig, LiveConfig } from '../../config';
import { dayjs, notDeleted, toObjectId } from '../../common/utils';
import { LiveSession, LiveSessionDocument } from './schemas/live-session.schema';
import { LiveAttendance, LiveAttendanceDocument } from './schemas/live-attendance.schema';
import { LiveChatMessage, LiveChatMessageDocument } from './schemas/live-chat-message.schema';
import { LivePresenceService } from './live-presence.service';
import type { CreateLiveSessionDto, LiveSessionQueryDto, UpdateLiveSessionDto } from './dto/live.dto';
import { CalendarService } from '../calendar/calendar.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { CoursesService } from '../courses/courses.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccessService } from '../rbac/access.service';
import { ContextsService } from '../contexts/contexts.service';

/** Quien pide algo: el usuario de la sesión HTTP o el de la conexión de socket. */
export interface LiveRequester {
  id: string;
  tenantId: string;
  isPlatformAdmin: boolean;
  capabilities: string[];
}

/**
 * Alfabeto del código de sala. Sin vocales —para que el azar no escriba
 * palabras— y sin los caracteres que se confunden al dictarlos por teléfono
 * (0/o, 1/l, 5/s).
 */
const ROOM_ALPHABET = 'bcdfghjkmnpqrstvwxyz2346789';

@Injectable()
export class LiveService {
  private readonly logger = new Logger(LiveService.name);

  constructor(
    @InjectModel(LiveSession.name) private readonly model: Model<LiveSessionDocument>,
    @InjectModel(LiveAttendance.name)
    private readonly attendanceModel: Model<LiveAttendanceDocument>,
    @InjectModel(LiveChatMessage.name)
    private readonly chatModel: Model<LiveChatMessageDocument>,
    private readonly presence: LivePresenceService,
    private readonly calendar: CalendarService,
    private readonly enrolments: EnrolmentsService,
    private readonly courses: CoursesService,
    private readonly users: UsersService,
    private readonly notifications: NotificationsService,
    private readonly access: AccessService,
    private readonly contexts: ContextsService,
    private readonly config: ConfigService,
  ) {}

  private get live(): LiveConfig {
    return this.config.getOrThrow<LiveConfig>('live');
  }

  private get app(): AppConfig {
    return this.config.getOrThrow<AppConfig>('app');
  }

  /* ------------------------------ Creación ------------------------------- */

  /**
   * Código de sala del estilo `maya-kfvt-brnq-xdm`. Se reintenta ante colisión
   * en lugar de confiar en la probabilidad: el índice único es la verdad, y con
   * salas de larga vida las colisiones dejan de ser hipotéticas.
   */
  private async generateRoomCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const group = (length: number) =>
        Array.from({ length }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');
      const code = `maya-${group(4)}-${group(4)}-${group(3)}`;
      const taken = await this.model.exists({ roomCode: code }).exec();
      if (!taken) return code;
    }
    throw new BadRequestException('No se ha podido generar un código de sala. Inténtelo de nuevo.');
  }

  async create(user: LiveRequester, dto: CreateLiveSessionDto): Promise<LiveSessionDocument> {
    const start = new Date(dto.scheduledStart);
    const end = dto.scheduledEnd ? new Date(dto.scheduledEnd) : null;
    if (end && end <= start) {
      throw new BadRequestException('El final de la sesión debe ser posterior al comienzo.');
    }

    // El curso se resuelve dentro de la empresa: sin ese filtro, un
    // identificador adivinado colgaría una clase del curso de otra empresa.
    const course = dto.courseId
      ? await this.courses.findByIdInTenant(dto.courseId, user.tenantId)
      : null;

    const settings: LiveSessionSettings = {
      ...DEFAULT_LIVE_SETTINGS,
      maxParticipants: this.live.maxParticipants,
      ...(dto.settings ?? {}),
    };

    const session = await this.model.create({
      tenant: toObjectId(user.tenantId),
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      roomCode: await this.generateRoomCode(),
      status: LiveSessionStatus.Scheduled,
      mode: dto.mode ?? LiveSessionMode.Class,
      course: course?._id ?? null,
      group: dto.groupId ? toObjectId(dto.groupId) : null,
      host: toObjectId(user.id),
      coHosts: (dto.coHostIds ?? []).map(toObjectId),
      scheduledStart: start,
      scheduledEnd: end,
      settings,
      // Una sesión sin curso no tiene a quién restringirse: es de la empresa.
      openToTenant: course ? (dto.openToTenant ?? false) : true,
      createdBy: toObjectId(user.id),
    });

    await this.syncCalendarEvent(session, dto.reminderMinutes ?? 15);
    if (dto.notify ?? true) await this.announce(session, 'live_session_scheduled');

    return session;
  }

  /** Crea o actualiza el evento del calendario espejo de la sesión. */
  private async syncCalendarEvent(
    session: LiveSessionDocument,
    reminderMinutes = 15,
  ): Promise<void> {
    const payload = {
      tenantId: session.tenant,
      name: session.title,
      description: session.description,
      startAt: session.scheduledStart,
      endAt: session.scheduledEnd,
      location: 'Aula en vivo de Maya Classroom',
      actionable: true,
      actionUrl: `/live/${session.roomCode}`,
      reminderMinutes,
    };

    if (session.calendarEvent) {
      await this.calendar.update(session.calendarEvent, session.host, payload, true);
      return;
    }

    const event = await this.calendar.create({
      ...payload,
      eventType: session.course ? CalendarEventType.Course : CalendarEventType.Tenant,
      courseId: session.course,
      groupId: session.group,
      userId: session.course ? null : session.host,
    });
    session.calendarEvent = event._id;
    await session.save();
  }

  /** Avisa por notificación a quien tiene que asistir. */
  private async announce(
    session: LiveSessionDocument,
    eventName: 'live_session_scheduled' | 'live_session_started',
  ): Promise<void> {
    const audience = await this.audienceIds(session);
    if (!audience.length) return;

    const cuando = dayjs(session.scheduledStart).format('D [de] MMMM [a las] HH:mm');
    const empieza = eventName === 'live_session_started';

    await this.notifications.notify({
      tenantId: session.tenant,
      userIds: audience,
      component: 'maya/live',
      eventName,
      subject: empieza ? `Ha empezado: ${session.title}` : `Clase en vivo: ${session.title}`,
      body: empieza
        ? `La sala ya está abierta. Entre cuando quiera.`
        : `Convocada para el ${cuando}.`,
      contextUrl: `/live/${session.roomCode}`,
      icon: 'play-circle',
      fromUserId: session.host,
    });
  }

  /** A quién va dirigida la sesión, sin contar a quien la convoca. */
  private async audienceIds(session: LiveSessionDocument): Promise<Types.ObjectId[]> {
    if (!session.course) return session.coHosts;
    const enrolled = await this.enrolments.activeUserIds(session.course);
    return enrolled.filter((id) => String(id) !== String(session.host));
  }

  /* ------------------------------ Consulta ------------------------------- */

  async findById(
    id: string | Types.ObjectId,
    tenantId: string | Types.ObjectId,
  ): Promise<LiveSessionDocument> {
    const session = await this.model
      .findOne({ _id: toObjectId(id), tenant: toObjectId(tenantId), ...notDeleted })
      .exec();
    if (!session) throw new NotFoundException('La sesión en vivo no existe.');
    return session;
  }

  /**
   * Busca por identificador o por código de sala. El enlace que se comparte
   * lleva el código, que es lo que la gente pega en el navegador; las llamadas
   * internas usan el identificador.
   */
  async findByRef(ref: string, tenantId: string | Types.ObjectId): Promise<LiveSessionDocument> {
    const filter: FilterQuery<LiveSessionDocument> = Types.ObjectId.isValid(ref)
      ? { _id: new Types.ObjectId(ref) }
      : { roomCode: ref.trim().toLowerCase() };

    const session = await this.model
      .findOne({ ...filter, tenant: toObjectId(tenantId), ...notDeleted })
      .exec();
    if (!session) throw new NotFoundException('La sesión en vivo no existe.');
    return session;
  }

  /** Sesiones que esta persona puede ver, con los filtros del listado. */
  async list(user: LiveRequester, query: LiveSessionQueryDto): Promise<LiveSessionDocument[]> {
    const filter: FilterQuery<LiveSessionDocument> = {
      tenant: toObjectId(user.tenantId),
      ...notDeleted,
    };

    if (query.status) filter.status = query.status;
    if (query.courseId) filter.course = toObjectId(query.courseId);

    if (query.upcoming) {
      filter.status = { $in: [LiveSessionStatus.Scheduled, LiveSessionStatus.Live] };
      filter.scheduledStart = { $gte: dayjs().subtract(12, 'hour').toDate() };
    }
    if (query.from || query.to) {
      filter.scheduledStart = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    if (!user.isPlatformAdmin && !user.capabilities.includes(CAP.LIVE_MANAGE_ANY)) {
      const courseIds = await this.enrolments.courseIdsOfUser(user.id);
      filter.$or = [
        { host: toObjectId(user.id) },
        { coHosts: toObjectId(user.id) },
        { openToTenant: true },
        { course: { $in: courseIds } },
      ];
    }

    return this.model
      .find(filter)
      .sort(query.upcoming ? { scheduledStart: 1 } : { scheduledStart: -1 })
      .limit(query.limit)
      .exec();
  }

  /* ---------------------------- Modificación ----------------------------- */

  async update(
    user: LiveRequester,
    id: string,
    dto: UpdateLiveSessionDto,
  ): Promise<LiveSessionDocument> {
    const session = await this.findById(id, user.tenantId);
    await this.requireManage(user, session);

    if (dto.title !== undefined) session.title = dto.title.trim();
    if (dto.description !== undefined) session.description = dto.description?.trim() || null;
    if (dto.mode !== undefined) session.mode = dto.mode;
    if (dto.scheduledStart !== undefined) session.scheduledStart = new Date(dto.scheduledStart);
    if (dto.scheduledEnd !== undefined) {
      session.scheduledEnd = dto.scheduledEnd ? new Date(dto.scheduledEnd) : null;
    }
    if (dto.coHostIds !== undefined) session.coHosts = dto.coHostIds.map(toObjectId);
    if (dto.openToTenant !== undefined) session.openToTenant = dto.openToTenant;
    if (dto.status !== undefined) session.status = dto.status;
    if (dto.settings) session.settings = { ...session.settings, ...dto.settings };
    if (dto.courseId !== undefined) {
      const course = dto.courseId
        ? await this.courses.findByIdInTenant(dto.courseId, user.tenantId)
        : null;
      session.course = course?._id ?? null;
      if (!course) session.openToTenant = true;
    }

    if (session.scheduledEnd && session.scheduledEnd <= session.scheduledStart) {
      throw new BadRequestException('El final de la sesión debe ser posterior al comienzo.');
    }

    session.updatedBy = toObjectId(user.id);
    await session.save();
    await this.syncCalendarEvent(session, dto.reminderMinutes ?? 15);
    return session;
  }

  async remove(user: LiveRequester, id: string): Promise<void> {
    const session = await this.findById(id, user.tenantId);
    await this.requireManage(user, session);

    if (session.calendarEvent) {
      await this.calendar.remove(session.calendarEvent, session.host, true).catch(() => undefined);
    }
    session.deletedAt = new Date();
    session.status = LiveSessionStatus.Cancelled;
    session.updatedBy = toObjectId(user.id);
    await session.save();
    this.presence.clear(session.id);
  }

  /** Abre la sala. Idempotente: entrar dos veces no reinicia el reloj. */
  async markStarted(session: LiveSessionDocument): Promise<LiveSessionDocument> {
    if (session.status === LiveSessionStatus.Live) return session;
    session.status = LiveSessionStatus.Live;
    session.startedAt ??= new Date();
    await session.save();
    await this.announce(session, 'live_session_started').catch((error: unknown) =>
      this.logger.warn(`No se pudo avisar del comienzo de ${session.roomCode}: ${String(error)}`),
    );
    return session;
  }

  async markEnded(session: LiveSessionDocument): Promise<LiveSessionDocument> {
    if (session.status === LiveSessionStatus.Ended) return session;
    session.status = LiveSessionStatus.Ended;
    session.endedAt = new Date();
    await session.save();
    await this.closeOpenAttendance(session);
    this.presence.clear(session.id);
    return session;
  }

  /* ------------------------------ Permisos ------------------------------- */

  /**
   * Comprueba una capacidad en el contexto que le corresponde: el del curso si
   * la sesión cuelga de uno, y el de la empresa si no. Las capacidades
   * precalculadas de la sesión solo cubren el nivel de empresa, así que un
   * profesor con el rol asignado únicamente en su curso necesita esta segunda
   * vuelta para que no se le nieguen sus propias clases.
   */
  private async can(
    user: LiveRequester,
    capability: string,
    session?: LiveSessionDocument | null,
  ): Promise<boolean> {
    if (user.isPlatformAdmin) return true;
    if (user.capabilities.includes(capability)) return true;
    if (!session?.course) return false;

    const context = await this.contexts
      .requireByInstance(ContextLevel.Course, session.course)
      .catch(() => null);
    if (!context) return false;
    return this.access.hasCapability({ userId: user.id }, capability, context);
  }

  isOwner(user: LiveRequester, session: LiveSessionDocument): boolean {
    return (
      String(session.host) === user.id ||
      session.coHosts.some((id) => String(id) === user.id)
    );
  }

  async canManage(user: LiveRequester, session: LiveSessionDocument): Promise<boolean> {
    if (this.isOwner(user, session)) return true;
    return this.can(user, CAP.LIVE_MANAGE_ANY, session);
  }

  async requireManage(user: LiveRequester, session: LiveSessionDocument): Promise<void> {
    if (!(await this.canManage(user, session))) {
      throw new ForbiddenException('No puede gestionar esta sesión en vivo.');
    }
  }

  async canRecord(user: LiveRequester, session: LiveSessionDocument): Promise<boolean> {
    if (!(await this.canManage(user, session))) return false;
    return this.can(user, CAP.LIVE_RECORD, session);
  }

  /**
   * Resuelve el papel de alguien en la sala y, de paso, si puede entrar.
   * Devolver el papel y no un booleano evita repetir la misma consulta en la
   * señalización: quien pregunta ya sabe si manda.
   */
  async resolveRole(
    user: LiveRequester,
    session: LiveSessionDocument,
  ): Promise<LiveParticipantRole> {
    if (String(session.host) === user.id) return LiveParticipantRole.Host;
    if (session.coHosts.some((id) => String(id) === user.id)) return LiveParticipantRole.CoHost;
    if (await this.can(user, CAP.LIVE_MANAGE_ANY, session)) return LiveParticipantRole.CoHost;
    return LiveParticipantRole.Attendee;
  }

  /** Deja entrar o explica por qué no. Devuelve el papel con el que se entra. */
  async authorizeJoin(
    user: LiveRequester,
    session: LiveSessionDocument,
  ): Promise<LiveParticipantRole> {
    if (session.status === LiveSessionStatus.Cancelled || session.deletedAt) {
      throw new ForbiddenException('Esta sesión se ha cancelado.');
    }

    const role = await this.resolveRole(user, session);
    if (role !== LiveParticipantRole.Attendee) return role;

    if (session.status === LiveSessionStatus.Ended) {
      throw new ForbiddenException('Esta sesión ya ha terminado.');
    }
    if (!(await this.can(user, CAP.LIVE_JOIN, session))) {
      throw new ForbiddenException('No tiene permiso para entrar a las salas en vivo.');
    }

    // Restringida al curso: solo el alumnado matriculado, y con el filtro de
    // empresa ya aplicado al cargar la sesión.
    if (!session.openToTenant) {
      if (!session.course) throw new ForbiddenException('La sesión no admite invitados.');
      const enrolled = await this.enrolments.isEnrolled(session.course, user.id);
      if (!enrolled) {
        throw new ForbiddenException('No está matriculado en el curso de esta clase.');
      }
    }

    // Antes de tiempo y sin nadie que presente, la sala no se abre: lo
    // contrario deja al alumnado solo en una clase que aún no existe.
    const abre = dayjs(session.scheduledStart).subtract(
      session.settings.joinBeforeHostMinutes ?? 15,
      'minute',
    );
    if (dayjs().isBefore(abre) && !this.presence.hasHost(session.id)) {
      throw new ForbiddenException(
        `La sala abre el ${dayjs(session.scheduledStart).format('D [de] MMMM [a las] HH:mm')}.`,
      );
    }

    if (this.presence.count(session.id) >= session.settings.maxParticipants) {
      throw new ForbiddenException('La sala ha alcanzado su aforo máximo.');
    }
    return role;
  }

  /* ----------------------------- Asistencia ------------------------------ */

  /** Registra una entrada. Suma a lo ya acumulado si es una reconexión. */
  async recordJoin(
    session: LiveSessionDocument,
    userId: string,
    role: LiveParticipantRole,
  ): Promise<void> {
    const now = new Date();
    await this.attendanceModel
      .updateOne(
        { session: session._id, user: toObjectId(userId) },
        {
          $setOnInsert: {
            tenant: session.tenant,
            session: session._id,
            user: toObjectId(userId),
            firstJoinAt: now,
          },
          $set: { role, openedAt: now },
          $inc: { joins: 1 },
        },
        { upsert: true },
      )
      .exec();

    const live = this.presence.count(session.id);
    if (live > session.peakParticipants) {
      await this.model.updateOne({ _id: session._id }, { $set: { peakParticipants: live } }).exec();
    }
  }

  /** Cierra el tramo abierto y acumula el tiempo. */
  async recordLeave(sessionId: string, userId: string): Promise<void> {
    const row = await this.attendanceModel
      .findOne({ session: toObjectId(sessionId), user: toObjectId(userId) })
      .exec();
    if (!row?.openedAt) return;

    const seconds = Math.max(0, Math.round((Date.now() - row.openedAt.getTime()) / 1000));
    row.totalSeconds += seconds;
    row.lastLeaveAt = new Date();
    row.openedAt = null;
    await row.save();
  }

  /** Al terminar la sesión, nadie puede quedarse con un tramo abierto. */
  private async closeOpenAttendance(session: LiveSessionDocument): Promise<void> {
    const abiertas = await this.attendanceModel
      .find({ session: session._id, openedAt: { $ne: null } })
      .exec();
    for (const row of abiertas) {
      await this.recordLeave(session.id, String(row.user));
    }
  }

  async attendance(session: LiveSessionDocument) {
    const rows = await this.attendanceModel
      .find({ session: session._id })
      .sort({ firstJoinAt: 1 })
      .exec();

    const refs = await this.userRefs(rows.map((r) => r.user));
    const presentes = new Set(this.presence.participants(session.id).map((p) => p.userId));

    return rows.map((row) => {
      const userId = String(row.user);
      const abierto = row.openedAt
        ? Math.round((Date.now() - row.openedAt.getTime()) / 1000)
        : 0;
      return {
        user: refs.get(userId) ?? { id: userId, fullName: 'Usuario', avatarUrl: null },
        role: row.role,
        firstJoinAt: row.firstJoinAt.toISOString(),
        lastLeaveAt: row.lastLeaveAt?.toISOString() ?? null,
        totalSeconds: row.totalSeconds + abierto,
        joins: row.joins,
        present: presentes.has(userId),
      };
    });
  }

  /* -------------------------------- Chat --------------------------------- */

  async appendChat(params: {
    session: LiveSessionDocument;
    authorId: string | null;
    body: string;
    system?: boolean;
  }): Promise<LiveChatMessageDto> {
    const body = params.body.trim().slice(0, 2000);
    if (!body) throw new BadRequestException('El mensaje está vacío.');

    const message = await this.chatModel.create({
      tenant: params.session.tenant,
      session: params.session._id,
      author: params.authorId ? toObjectId(params.authorId) : null,
      body,
      system: params.system ?? false,
    });

    const refs = params.authorId ? await this.userRefs([params.authorId]) : new Map();
    return {
      id: message.id,
      sessionId: params.session.id,
      author: params.authorId ? (refs.get(params.authorId) ?? null) : null,
      body: message.body,
      system: message.system,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /** Últimos mensajes, en orden cronológico, para quien entra a mitad. */
  async chatHistory(session: LiveSessionDocument, limit = 100): Promise<LiveChatMessageDto[]> {
    const rows = await this.chatModel
      .find({ session: session._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    rows.reverse();

    const refs = await this.userRefs(rows.map((r) => r.author).filter(Boolean) as Types.ObjectId[]);
    return rows.map((row) => ({
      id: row.id,
      sessionId: session.id,
      author: row.author ? (refs.get(String(row.author)) ?? null) : null,
      body: row.body,
      system: row.system,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /* ------------------------------ ICE / TURN ------------------------------ */

  /**
   * Servidores por los que el navegador negocia la conexión.
   *
   * Con `LIVE_TURN_SECRET` las credenciales se emiten al vuelo y caducan: el
   * usuario es «caducidad:identificador» y la contraseña su HMAC con el secreto
   * que comparte coturn. Es el mecanismo REST que documenta el propio coturn y
   * evita repartir una contraseña fija que cualquiera puede leer en el cliente.
   */
  iceConfig(userId: string): LiveIceConfigDto {
    const live = this.live;
    const iceServers: LiveIceConfigDto['iceServers'] = [];

    if (live.stunUrls.length) iceServers.push({ urls: live.stunUrls });

    if (live.turnUrls.length) {
      if (live.turnSecret) {
        const expira = Math.floor(Date.now() / 1000) + live.turnTtl;
        const username = `${expira}:${userId}`;
        const credential = createHmac('sha1', live.turnSecret).update(username).digest('base64');
        iceServers.push({ urls: live.turnUrls, username, credential });
      } else if (live.turnUsername) {
        iceServers.push({
          urls: live.turnUrls,
          username: live.turnUsername,
          credential: live.turnPassword,
        });
      } else {
        iceServers.push({ urls: live.turnUrls });
      }
    }

    return {
      iceServers,
      ttlSeconds: live.turnTtl,
      // Sin TURN configurado no se puede forzar el relevo: dejaría la sala sin
      // ninguna ruta posible en lugar de con una peor.
      forceRelay: live.forceRelay && live.turnUrls.length > 0,
    };
  }

  /* ---------------------------- Serialización ---------------------------- */

  /** Referencias de usuario en una sola consulta, indexadas por identificador. */
  async userRefs(ids: (string | Types.ObjectId)[]): Promise<Map<string, LiveUserRef>> {
    const unicos = Array.from(new Set(ids.map(String)));
    if (!unicos.length) return new Map();

    const users = await this.users.findManyByIds(unicos);
    return new Map(
      users.map((user) => [
        user.id as string,
        {
          id: user.id as string,
          fullName: fullName(user.firstName, user.lastName),
          avatarUrl: user.avatarUrl,
        },
      ]),
    );
  }

  async toDto(session: LiveSessionDocument, user: LiveRequester): Promise<LiveSessionDto> {
    const [refs, canManage, canRecord] = await Promise.all([
      this.userRefs([session.host, ...session.coHosts]),
      this.canManage(user, session),
      this.canRecord(user, session),
    ]);

    const course = session.course
      ? await this.courses.findById(session.course).catch(() => null)
      : null;

    const desconocido = (id: string): LiveUserRef => ({ id, fullName: 'Usuario', avatarUrl: null });

    return {
      id: session.id,
      title: session.title,
      description: session.description,
      roomCode: session.roomCode,
      joinUrl: `${this.app.webUrl.replace(/\/$/, '')}/live/${session.roomCode}`,
      status: session.status,
      mode: session.mode,
      courseId: session.course ? String(session.course) : null,
      courseName: course?.fullName ?? null,
      groupId: session.group ? String(session.group) : null,
      host: refs.get(String(session.host)) ?? desconocido(String(session.host)),
      coHosts: session.coHosts.map((id) => refs.get(String(id)) ?? desconocido(String(id))),
      calendarEventId: session.calendarEvent ? String(session.calendarEvent) : null,
      scheduledStart: session.scheduledStart.toISOString(),
      scheduledEnd: session.scheduledEnd?.toISOString() ?? null,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      settings: { ...DEFAULT_LIVE_SETTINGS, ...session.settings },
      openToTenant: session.openToTenant,
      liveParticipants: this.presence.count(session.id),
      recordingCount: session.recordingCount,
      canManage,
      canRecord,
      createdAt: session.createdAt.toISOString(),
    };
  }

  async toDtos(sessions: LiveSessionDocument[], user: LiveRequester): Promise<LiveSessionDto[]> {
    return Promise.all(sessions.map((session) => this.toDto(session, user)));
  }
}
