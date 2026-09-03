import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { ExtendedError, Namespace, Socket } from 'socket.io';
import { LIVE_EVENT, LIVE_NAMESPACE, LiveParticipantRole, LiveSessionMode } from '@maya/shared';
import type {
  LiveJoinPayload,
  LiveJoinedPayload,
  LiveMediaStatePayload,
  LiveParticipantDto,
  WhiteboardOp,
} from '@maya/shared';
import type { JwtConfig } from '../../config';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AuthService } from '../auth/auth.service';
import { LiveBoardService } from './live-board.service';
import { LivePresenceService } from './live-presence.service';
import { LiveRequester, LiveService } from './live.service';
import type { LiveSessionDocument } from './schemas/live-session.schema';

/** Lo que se guarda en cada conexión una vez autenticada. */
interface SocketState {
  user: LiveRequester;
  sessionId: string;
  role: LiveParticipantRole;
}

/**
 * Señalización de las salas en vivo.
 *
 * La plataforma **no** transporta audio ni vídeo: los navegadores se conectan
 * entre sí en malla y esto solo hace de centralita. Reparte las descripciones
 * de sesión (SDP) y los candidatos ICE, mantiene la lista de quién está dentro
 * y difunde lo que no es media —chat, pizarra, mano alzada, moderación—.
 *
 * Por qué malla y no un servidor de medios (SFU): un SFU obliga a desplegar y
 * mantener un proceso aparte con rangos de puertos UDP abiertos y un módulo
 * nativo; una malla no necesita nada que este despliegue no tenga ya. A cambio,
 * cada emisor sube una copia por asistente, y por eso el modo `class` deja
 * emitiendo solo a quien presenta: con un emisor, el coste de la sala es el
 * mismo que con un SFU. Toda la parte de medios del cliente está detrás de una
 * fachada, así que sustituir la malla por un SFU no toca ni la interfaz ni
 * estos mensajes.
 *
 * Al entrar, quien llega es siempre quien ofrece la conexión a los que ya
 * estaban. Esa asimetría es deliberada: evita que dos extremos se ofrezcan a la
 * vez, que es el fallo clásico de una malla y se manifiesta como «unos se ven
 * y otros no» sin ningún error visible.
 */
// El CORS lo fija `LiveIoAdapter` a partir de `CORS_ORIGINS`, para que la
// señalización y la API acepten exactamente los mismos orígenes.
@WebSocketGateway({
  namespace: LIVE_NAMESPACE,
  // Los trazos de la pizarra van en ráfagas de mensajes pequeños; el
  // agrupamiento por defecto de Socket.IO los junta y basta con eso.
  maxHttpBufferSize: 1_000_000,
})
export class LiveGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);

  /**
   * Con `namespace`, Nest inyecta aquí el espacio de nombres, no el servidor
   * entero: `server.sockets` es entonces el mapa de conexiones de esta sala de
   * conferencias y no el espacio por defecto de Socket.IO.
   */
  @WebSocketServer()
  private server!: Namespace;

  /** Estado por conexión: quién es y en qué sala está. */
  private readonly states = new Map<string, SocketState>();

  constructor(
    private readonly live: LiveService,
    private readonly board: LiveBoardService,
    private readonly presence: LivePresenceService,
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /* ---------------------------- Ciclo de vida ---------------------------- */

  /**
   * Identificar a quien llama es lo primero que hace la sala, y va en un
   * middleware de Socket.IO —no en `handleConnection`— por una cuestión de
   * orden.
   *
   * Nest no espera a que `handleConnection` termine: en cuanto la conexión
   * existe ata los manejadores de mensajes y sigue. El cliente, por su parte,
   * emite `live:join` en cuanto recibe el `connect`. Como reconocer a alguien
   * cuesta varias consultas a la base de datos, ese `join` llegaba antes de
   * que `client.data.user` estuviera puesto y la sala lo rechazaba con
   * «Sesión no válida» aunque el testigo fuese perfecto: un fallo que aparece
   * y desaparece según lo que tarde la base de datos frente al viaje de ida y
   * vuelta hasta el navegador.
   *
   * Un middleware corre antes de que el cliente reciba el `connect`, así que
   * cuando llega el `join` la conexión ya sabe quién es. No hay carrera
   * posible.
   */
  afterInit(server: Namespace): void {
    server.use((client: Socket, next: (err?: ExtendedError) => void) => {
      void this.authenticate(client).then(
        () => next(),
        (error: unknown) => {
          this.logger.debug(`Conexión rechazada: ${String(error)}`);
          // Rechazar desde el middleware llega al cliente como `connect_error`
          // con este mensaje; emitir por el socket no serviría, porque para el
          // navegador la conexión todavía no existe.
          next(new Error('Sesión no válida o caducada.'));
        },
      );
    });
  }

  /**
   * La conexión llega con el testigo de acceso en `auth.token`. Se verifica
   * aquí y no en un guard porque un socket rechazado debe cerrarse, no
   * devolver un 401 que nadie va a leer.
   */
  private async authenticate(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) throw new Error('sin testigo');

    const jwtConfig = this.config.getOrThrow<JwtConfig>('jwt');
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: jwtConfig.accessSecret,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
    });
    if (payload.type !== 'access') throw new Error('el testigo no es de acceso');

    const user = await this.auth.buildSessionUser(payload.sub);
    client.data.user = {
      id: user.id,
      tenantId: user.tenantId,
      isPlatformAdmin: user.isPlatformAdmin,
      capabilities: user.capabilities,
    } satisfies LiveRequester;
    client.data.fullName = user.fullName;
    client.data.avatarUrl = user.avatarUrl;
  }

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth as { token?: unknown } | undefined;
    if (typeof auth?.token === 'string' && auth.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return null;
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const state = this.states.get(client.id);
    this.states.delete(client.id);

    const gone = this.presence.remove(client.id);
    if (!gone || !state) return;

    // Una persona con dos pestañas sigue presente: solo se cierra su tramo de
    // asistencia cuando se va la última.
    const quedan = this.presence.socketsOfUser(gone.sessionId, state.user.id);
    if (!quedan.length) {
      await this.live
        .recordLeave(gone.sessionId, state.user.id)
        .catch((error: unknown) => this.logger.warn(`Asistencia: ${String(error)}`));
    }

    this.server.to(gone.sessionId).emit(LIVE_EVENT.PeerLeft, { socketId: client.id });

    // Sala vacía: se cierra sola. Sin esto, una clase de la que todo el mundo
    // se va sin pulsar «finalizar» quedaría «en directo» para siempre.
    if (!this.presence.everyone(gone.sessionId).length) {
      await this.closeIfEmpty(gone.sessionId, state.user.tenantId);
    }
  }

  private async closeIfEmpty(sessionId: string, tenantId: string): Promise<void> {
    try {
      const session = await this.live.findById(sessionId, tenantId);
      if (this.presence.everyone(sessionId).length) return;
      await this.live.markEnded(session);
    } catch (error) {
      this.logger.warn(`No se pudo cerrar la sala ${sessionId}: ${String(error)}`);
    }
  }

  /* -------------------------------- Entrada ------------------------------ */

  @SubscribeMessage(LIVE_EVENT.Join)
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LiveJoinPayload,
  ): Promise<{ ok: false; message: string } | { ok: true; data: LiveJoinedPayload }> {
    const user = client.data.user as LiveRequester | undefined;
    if (!user) return { ok: false, message: 'Sesión no válida.' };

    let session: LiveSessionDocument;
    let role: LiveParticipantRole;
    try {
      session = await this.live.findByRef(String(payload?.room ?? ''), user.tenantId);
      role = await this.live.authorizeJoin(user, session);
    } catch (error) {
      return { ok: false, message: mensajeDe(error) };
    }

    const modera = role !== LiveParticipantRole.Attendee;
    // Quien presenta nunca espera en la puerta: si esperase, no habría nadie
    // dentro para abrirla.
    const espera = Boolean(session.settings.lobby) && !modera && !this.presence.hasHost(session.id);

    // En una clase, el alumnado escucha; en una reunión, todos publican. Con la
    // cámara pasa lo mismo, salvo que los ajustes digan lo contrario.
    const puedeEmitir = modera || session.mode === LiveSessionMode.Meeting;
    const audio = puedeEmitir && Boolean(payload?.audio) && !session.settings.muteOnJoin;
    const video =
      Boolean(payload?.video) &&
      (puedeEmitir || Boolean(session.settings.allowAttendeeCamera));

    const participant: LiveParticipantDto = {
      socketId: client.id,
      userId: user.id,
      fullName: String(client.data.fullName ?? 'Participante'),
      avatarUrl: (client.data.avatarUrl as string | null) ?? null,
      role,
      audio,
      video,
      screen: false,
      hand: false,
      waiting: espera,
      joinedAt: new Date().toISOString(),
    };

    this.states.set(client.id, { user, sessionId: session.id, role });
    this.presence.add(session.id, participant);
    await client.join(session.id);

    if (espera) {
      // Solo quien modera ve la sala de espera; el resto no sabe quién llama.
      this.emitToModerators(session.id, LIVE_EVENT.Waiting, { participant });
    } else {
      if (modera) await this.live.markStarted(session);
      await this.live.recordJoin(session, user.id, role);
      client.to(session.id).emit(LIVE_EVENT.PeerJoined, { participant });
    }

    const [board, chat, dto] = await Promise.all([
      this.board.state(session.id, session.tenant),
      this.live.chatHistory(session),
      this.live.toDto(session, user),
    ]);

    return {
      ok: true,
      data: {
        self: participant,
        // Quien espera no recibe la lista: aún no está en la sala.
        participants: espera
          ? []
          : this.presence.participants(session.id).filter((p) => p.socketId !== client.id),
        session: dto,
        board,
        chat,
        recording: this.recordingActive.has(session.id),
      },
    };
  }

  @SubscribeMessage(LIVE_EVENT.Leave)
  async onLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const sessionId = this.states.get(client.id)?.sessionId;
    await this.handleDisconnect(client);
    if (sessionId) await client.leave(sessionId);
  }

  /* ------------------------- Señalización de medios ---------------------- */

  /**
   * Oferta, respuesta y candidatos se reenvían tal cual al destinatario. El
   * servidor no mira dentro: solo comprueba que emisor y destinatario están en
   * la misma sala, que es lo que impide usar la centralita para hablarle a
   * cualquiera de la plataforma.
   */
  @SubscribeMessage(LIVE_EVENT.Offer)
  onOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): void {
    this.relay(client, LIVE_EVENT.Offer, payload);
  }

  @SubscribeMessage(LIVE_EVENT.Answer)
  onAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): void {
    this.relay(client, LIVE_EVENT.Answer, payload);
  }

  @SubscribeMessage(LIVE_EVENT.Ice)
  onIce(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown): void {
    this.relay(client, LIVE_EVENT.Ice, payload);
  }

  private relay(client: Socket, event: string, payload: unknown): void {
    const state = this.states.get(client.id);
    if (!state) return;

    const body = (payload ?? {}) as { peer?: unknown };
    const peer = typeof body.peer === 'string' ? body.peer : null;
    if (!peer) return;

    const destino = this.presence.get(peer);
    if (!destino || destino.sessionId !== state.sessionId) return;

    this.server.to(peer).emit(event, { ...body, peer: client.id });
  }

  @SubscribeMessage(LIVE_EVENT.MediaState)
  onMediaState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LiveMediaStatePayload,
  ): void {
    const state = this.states.get(client.id);
    if (!state) return;

    const patch: Partial<LiveParticipantDto> = {};
    if (typeof payload?.audio === 'boolean') patch.audio = payload.audio;
    if (typeof payload?.video === 'boolean') patch.video = payload.video;
    if (typeof payload?.screen === 'boolean') patch.screen = payload.screen;
    if (typeof payload?.hand === 'boolean') patch.hand = payload.hand;

    const updated = this.presence.update(client.id, patch);
    if (!updated) return;
    this.server.to(state.sessionId).emit(LIVE_EVENT.PeerState, { participant: updated });
  }

  /* --------------------------------- Chat -------------------------------- */

  @SubscribeMessage(LIVE_EVENT.ChatSend)
  async onChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { body?: string },
  ): Promise<void> {
    const state = this.states.get(client.id);
    if (!state || !payload?.body?.trim()) return;

    try {
      const session = await this.live.findById(state.sessionId, state.user.tenantId);
      if (!session.settings.allowChat && state.role === LiveParticipantRole.Attendee) return;

      const message = await this.live.appendChat({
        session,
        authorId: state.user.id,
        body: payload.body,
      });
      this.server.to(state.sessionId).emit(LIVE_EVENT.ChatMessage, message);
    } catch (error) {
      client.emit(LIVE_EVENT.Error, { message: mensajeDe(error) });
    }
  }

  /* ------------------------------- Pizarra ------------------------------- */

  @SubscribeMessage(LIVE_EVENT.BoardOp)
  async onBoardOp(
    @ConnectedSocket() client: Socket,
    @MessageBody() op: WhiteboardOp,
  ): Promise<void> {
    const state = this.states.get(client.id);
    if (!state || !op?.kind) return;

    try {
      const session = await this.live.findById(state.sessionId, state.user.tenantId);
      const modera = state.role !== LiveParticipantRole.Attendee;
      if (!modera && !session.settings.allowWhiteboard) return;
      // Añadir y quitar páginas reordena la clase entera: es cosa de quien
      // presenta, aunque el alumnado pueda dibujar.
      if (!modera && op.kind.startsWith('page-')) return;

      const applied = await this.board.apply(session.id, session.tenant, op);
      if (!applied) return;
      // Quien dibuja ya lo ha pintado en su lienzo: reenviárselo haría que el
      // trazo parpadease.
      client.to(state.sessionId).emit(LIVE_EVENT.BoardOp, applied);
      if (applied.kind === 'page-add') client.emit(LIVE_EVENT.BoardOp, applied);
    } catch (error) {
      client.emit(LIVE_EVENT.Error, { message: mensajeDe(error) });
    }
  }

  /* ------------------------------ Moderación ----------------------------- */

  @SubscribeMessage(LIVE_EVENT.HostMute)
  onHostMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { target?: string; all?: boolean },
  ): void {
    const state = this.moderator(client);
    if (!state) return;

    const objetivos = payload?.all
      ? this.presence
          .participants(state.sessionId)
          .filter((p) => p.role === LiveParticipantRole.Attendee)
          .map((p) => p.socketId)
      : payload?.target
        ? [payload.target]
        : [];

    for (const socketId of objetivos) {
      const destino = this.presence.get(socketId);
      if (!destino || destino.sessionId !== state.sessionId) continue;
      // Se pide al cliente que se silencie y él confirma con `media:state`: el
      // servidor no puede apagar un micrófono que no pasa por él.
      this.server.to(socketId).emit(LIVE_EVENT.Muted, { by: state.user.id });
    }
  }

  @SubscribeMessage(LIVE_EVENT.HostLowerHand)
  onLowerHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { target?: string },
  ): void {
    const state = this.moderator(client);
    if (!state || !payload?.target) return;

    const destino = this.presence.get(payload.target);
    if (!destino || destino.sessionId !== state.sessionId) return;

    const updated = this.presence.update(payload.target, { hand: false });
    if (updated) this.server.to(state.sessionId).emit(LIVE_EVENT.PeerState, { participant: updated });
  }

  @SubscribeMessage(LIVE_EVENT.HostKick)
  async onKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { target?: string },
  ): Promise<void> {
    const state = this.moderator(client);
    if (!state || !payload?.target) return;

    const destino = this.presence.get(payload.target);
    if (!destino || destino.sessionId !== state.sessionId) return;
    if (destino.participant.role === LiveParticipantRole.Host) return;

    this.server.to(payload.target).emit(LIVE_EVENT.Kicked, { by: state.user.id });
    const socket = this.server.sockets.get(payload.target);
    if (socket) {
      await this.handleDisconnect(socket);
      socket.disconnect(true);
    }
  }

  @SubscribeMessage(LIVE_EVENT.HostAdmit)
  async onAdmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { target?: string; admit?: boolean },
  ): Promise<void> {
    const state = this.moderator(client);
    if (!state || !payload?.target) return;

    const destino = this.presence.get(payload.target);
    if (!destino || destino.sessionId !== state.sessionId || !destino.participant.waiting) return;

    if (payload.admit === false) {
      this.server.to(payload.target).emit(LIVE_EVENT.Kicked, { by: state.user.id, denied: true });
      const socket = this.server.sockets.get(payload.target);
      if (socket) {
        await this.handleDisconnect(socket);
        socket.disconnect(true);
      }
      return;
    }

    const admitido = this.presence.update(payload.target, { waiting: false });
    if (!admitido) return;

    try {
      const session = await this.live.findById(state.sessionId, state.user.tenantId);
      await this.live.recordJoin(session, admitido.userId, admitido.role);
      const [board, chat, dto] = await Promise.all([
        this.board.state(session.id, session.tenant),
        this.live.chatHistory(session),
        this.live.toDto(session, state.user),
      ]);
      this.server.to(payload.target).emit(LIVE_EVENT.Admitted, {
        self: admitido,
        participants: this.presence
          .participants(session.id)
          .filter((p) => p.socketId !== payload.target),
        session: dto,
        board,
        chat,
        recording: this.recordingActive.has(session.id),
      } satisfies LiveJoinedPayload);
      this.server
        .to(state.sessionId)
        .except(payload.target)
        .emit(LIVE_EVENT.PeerJoined, { participant: admitido });
    } catch (error) {
      this.server.to(payload.target).emit(LIVE_EVENT.Error, { message: mensajeDe(error) });
    }
  }

  @SubscribeMessage(LIVE_EVENT.HostPromote)
  onPromote(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { target?: string; role?: LiveParticipantRole },
  ): void {
    const state = this.moderator(client);
    if (!state || !payload?.target) return;

    const destino = this.presence.get(payload.target);
    if (!destino || destino.sessionId !== state.sessionId) return;
    if (destino.participant.role === LiveParticipantRole.Host) return;

    // Solo se sube y baja entre asistente y co-anfitrión: el anfitrión es quien
    // convocó la sesión y eso no se cede desde la sala.
    const role =
      payload.role === LiveParticipantRole.CoHost
        ? LiveParticipantRole.CoHost
        : LiveParticipantRole.Attendee;

    const updated = this.presence.update(payload.target, { role });
    if (!updated) return;

    const estadoDestino = this.states.get(payload.target);
    if (estadoDestino) this.states.set(payload.target, { ...estadoDestino, role });

    this.server.to(state.sessionId).emit(LIVE_EVENT.PeerState, { participant: updated });
    this.server.to(payload.target).emit(LIVE_EVENT.RoleChanged, { role });
  }

  /* ------------------------------- Grabación ------------------------------ */

  /** Salas que alguien está grabando; el aviso tiene que verlo todo el mundo. */
  private readonly recordingActive = new Set<string>();

  @SubscribeMessage(LIVE_EVENT.RecordingState)
  onRecordingState(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { active?: boolean },
  ): void {
    const state = this.moderator(client);
    if (!state) return;

    if (payload?.active) this.recordingActive.add(state.sessionId);
    else this.recordingActive.delete(state.sessionId);

    this.server.to(state.sessionId).emit(LIVE_EVENT.RecordingState, {
      active: Boolean(payload?.active),
      by: state.user.id,
    });
  }

  /* -------------------------------- Cierre -------------------------------- */

  @SubscribeMessage(LIVE_EVENT.SessionEnd)
  async onEnd(@ConnectedSocket() client: Socket): Promise<void> {
    const state = this.moderator(client);
    if (!state) return;

    try {
      const session = await this.live.findById(state.sessionId, state.user.tenantId);
      await this.live.requireManage(state.user, session);
      await this.live.markEnded(session);
      this.recordingActive.delete(state.sessionId);
      this.server.to(state.sessionId).emit(LIVE_EVENT.SessionEnded, { by: state.user.id });

      for (const socket of await this.server.in(state.sessionId).fetchSockets()) {
        this.states.delete(socket.id);
        socket.disconnect(true);
      }
    } catch (error) {
      client.emit(LIVE_EVENT.Error, { message: mensajeDe(error) });
    }
  }

  /* -------------------------------- Ayudas -------------------------------- */

  /** Estado de la conexión solo si manda en su sala. */
  private moderator(client: Socket): SocketState | null {
    const state = this.states.get(client.id);
    if (!state || state.role === LiveParticipantRole.Attendee) return null;
    return state;
  }

  private emitToModerators(sessionId: string, event: string, payload: unknown): void {
    for (const participant of this.presence.everyone(sessionId)) {
      if (participant.role === LiveParticipantRole.Attendee) continue;
      this.server.to(participant.socketId).emit(event, payload);
    }
  }
}

/** Mensaje legible de un error de Nest o de cualquier otra cosa. */
function mensajeDe(error: unknown): string {
  if (error instanceof Error) {
    const response = (error as { response?: { message?: unknown } }).response;
    if (response && typeof response.message === 'string') return response.message;
    return error.message;
  }
  return 'No se ha podido completar la operación.';
}
