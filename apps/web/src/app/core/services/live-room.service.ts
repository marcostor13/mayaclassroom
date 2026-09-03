import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import {
  LIVE_EVENT,
  LIVE_NAMESPACE,
  LiveChatMessageDto,
  LiveJoinedPayload,
  LiveParticipantDto,
  LiveParticipantRole,
  LiveSessionDto,
  LiveSessionMode,
  WhiteboardOp,
  WhiteboardStateDto,
} from '../models';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { LiveService } from './live.service';

/** Cómo se ve un participante remoto desde aquí. */
export interface LivePeer {
  socketId: string;
  participant: LiveParticipantDto;
  /** Pistas que llegan de esa persona; `null` hasta que conecta. */
  stream: MediaStream | null;
  /** Pantalla compartida, cuando llega por una pista aparte. */
  screenStream: MediaStream | null;
  connection: RTCPeerConnectionState;
}

export type LiveRoomState =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'connected'
  | 'ended'
  | 'error';

/** Todo lo que hace falta para hablar con un extremo de la malla. */
interface PeerLink {
  pc: RTCPeerConnection;
  /** Regla de cortesía: quien cede cuando los dos ofrecen a la vez. */
  polite: boolean;
  makingOffer: boolean;
  ignoringOffer: boolean;
  /** Candidatos llegados antes de la descripción remota. */
  pending: RTCIceCandidateInit[];
  senders: { audio: RTCRtpSender | null; video: RTCRtpSender | null };
}

/**
 * La sala: malla WebRTC entre navegadores más la señalización por socket.
 *
 * El audio y el vídeo **no** pasan por la plataforma; van de navegador a
 * navegador. Esta clase abre una conexión con cada participante, mantiene las
 * pistas al día (cámara, micrófono, pantalla) y traduce los mensajes de la
 * centralita a señales que la interfaz puede pintar.
 *
 * La negociación sigue el patrón de «negociación perfecta» del WHATWG: cada
 * pareja decide quién cede comparando sus identificadores de conexión, así que
 * cuando los dos extremos ofrecen a la vez —lo normal al entrar dos personas
 * juntas— uno retrocede y la conexión se establece igual. Sin esa regla, la
 * malla falla de la peor manera posible: sin ningún error, con unos viéndose y
 * otros no.
 */
@Injectable()
export class LiveRoomService {
  private readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);
  private readonly destroyRef = inject(DestroyRef);

  private socket: Socket | null = null;
  private readonly links = new Map<string, PeerLink>();
  private iceServers: RTCIceServer[] = [];
  private forceRelay = false;

  /* -------------------------------- Estado ------------------------------- */

  readonly state = signal<LiveRoomState>('idle');
  readonly error = signal<string | null>(null);
  readonly session = signal<LiveSessionDto | null>(null);
  readonly self = signal<LiveParticipantDto | null>(null);
  readonly peers = signal<LivePeer[]>([]);
  readonly chat = signal<LiveChatMessageDto[]>([]);
  readonly board = signal<WhiteboardStateDto | null>(null);
  readonly waitingRoom = signal<LiveParticipantDto[]>([]);
  readonly recordingActive = signal(false);
  readonly localStream = signal<MediaStream | null>(null);
  readonly screenStream = signal<MediaStream | null>(null);
  readonly micOn = signal(false);
  readonly camOn = signal(false);
  readonly handUp = signal(false);
  readonly devices = signal<MediaDeviceInfo[]>([]);
  readonly selectedMic = signal<string | null>(null);
  readonly selectedCam = signal<string | null>(null);
  /** Aviso cuando quien modera pide silencio, para explicarlo en pantalla. */
  readonly mutedByHost = signal(false);

  /** Operaciones de pizarra que llegan de fuera; las consume el lienzo. */
  readonly incomingBoardOps = new Subject<WhiteboardOp>();

  readonly moderator = computed(() => {
    const role = this.self()?.role;
    return role === LiveParticipantRole.Host || role === LiveParticipantRole.CoHost;
  });

  /** ¿Puede publicar cámara y micrófono con las reglas de esta sala? */
  readonly canPublish = computed(() => {
    const session = this.session();
    if (!session) return false;
    return this.moderator() || session.mode === LiveSessionMode.Meeting;
  });

  readonly canDraw = computed(() => {
    const session = this.session();
    if (!session) return false;
    return this.moderator() || session.settings.allowWhiteboard;
  });

  readonly canShareScreen = computed(() => {
    const session = this.session();
    if (!session) return false;
    return this.moderator() || session.settings.allowAttendeeScreenShare;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.leave());
  }

  /* -------------------------------- Entrada ------------------------------ */

  /**
   * Entra en la sala. El orden importa: primero los medios locales, luego la
   * lista de servidores ICE y solo al final el socket. Conectando antes de
   * tener los medios, la primera oferta sale sin pistas y hay que renegociar
   * enseguida, que es justo el momento en el que la malla se enreda.
   */
  async join(roomRef: string, options: { audio: boolean; video: boolean }): Promise<void> {
    this.state.set('connecting');
    this.error.set(null);

    try {
      this.iceServers = await this.loadIceServers();
      await this.openLocalMedia(options).catch((mediaError: unknown) => {
        // Sin cámara ni micrófono se puede asistir igual: escuchar y ver es la
        // mitad de una clase, y negarle la entrada a quien no tiene webcam
        // sería peor que dejarle entrar en silencio.
        this.error.set(descripcionDeMedios(mediaError));
      });

      await this.connectSocket(roomRef, options);
    } catch (error) {
      this.error.set(mensaje(error));
      this.state.set('error');
      this.releaseMedia();
    }
  }

  private async loadIceServers(): Promise<RTCIceServer[]> {
    try {
      const config = await firstValueFrom(this.live.iceServers());
      this.forceRelay = config.forceRelay;
      return config.iceServers as RTCIceServer[];
    } catch {
      // Sin la lista del servidor queda el STUN público: basta en la mayoría
      // de redes domésticas y es mejor que no intentarlo.
      this.forceRelay = false;
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }

  /** Dirección del socket a partir de la de la API, que puede ser relativa. */
  private socketUrl(): { origin: string; path: string } {
    const apiUrl = environment.apiUrl;
    const absoluta = /^https?:\/\//i.test(apiUrl);
    const base = absoluta ? new URL(apiUrl) : new URL(apiUrl, window.location.origin);
    // `/api/v1` → prefijo `/api`: el socket cuelga del prefijo, no de la
    // versión, porque no versiona nada.
    const prefijo = base.pathname.replace(/\/v\d+\/?$/, '').replace(/\/$/, '') || '/api';
    return { origin: base.origin, path: `${prefijo}/live-socket` };
  }

  private connectSocket(roomRef: string, options: { audio: boolean; video: boolean }): Promise<void> {
    const { origin, path } = this.socketUrl();

    return new Promise<void>((resolve, reject) => {
      const socket = io(`${origin}${LIVE_NAMESPACE}`, {
        path,
        transports: ['websocket', 'polling'],
        auth: { token: this.auth.accessToken },
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      this.socket = socket;
      this.wire(socket);

      socket.on('connect_error', (err: Error) => {
        if (this.state() === 'connecting') reject(err);
      });

      socket.on('connect', () => {
        socket.emit(
          LIVE_EVENT.Join,
          { room: roomRef, audio: options.audio, video: options.video },
          (respuesta: { ok: false; message: string } | { ok: true; data: LiveJoinedPayload }) => {
            if (!respuesta?.ok) {
              reject(new Error(respuesta?.message ?? 'No se ha podido entrar a la sala.'));
              socket.disconnect();
              return;
            }
            this.applyJoined(respuesta.data);
            resolve();
          },
        );
      });
    });
  }

  /** Vuelca en las señales todo lo que devuelve la sala al entrar. */
  private applyJoined(data: LiveJoinedPayload): void {
    this.session.set(data.session);
    this.self.set(data.self);
    this.chat.set(data.chat);
    this.board.set(data.board);
    this.recordingActive.set(data.recording);
    this.micOn.set(data.self.audio);
    this.camOn.set(data.self.video);
    this.applyLocalTrackFlags();

    if (data.self.waiting) {
      this.state.set('waiting');
      return;
    }

    this.state.set('connected');
    this.peers.set(
      data.participants.map((participant) => ({
        socketId: participant.socketId,
        participant,
        stream: null,
        screenStream: null,
        connection: 'new' as RTCPeerConnectionState,
      })),
    );
    for (const participant of data.participants) this.openLink(participant.socketId);
  }

  /* ------------------------------ Señalización --------------------------- */

  private wire(socket: Socket): void {
    socket.on(LIVE_EVENT.PeerJoined, ({ participant }: { participant: LiveParticipantDto }) => {
      this.upsertPeer(participant);
      this.openLink(participant.socketId);
    });

    socket.on(LIVE_EVENT.PeerLeft, ({ socketId }: { socketId: string }) => {
      this.closeLink(socketId);
      this.peers.update((list) => list.filter((peer) => peer.socketId !== socketId));
      this.waitingRoom.update((list) => list.filter((p) => p.socketId !== socketId));
    });

    socket.on(LIVE_EVENT.PeerState, ({ participant }: { participant: LiveParticipantDto }) => {
      if (participant.socketId === this.self()?.socketId) {
        this.self.set(participant);
        return;
      }
      this.upsertPeer(participant);
    });

    socket.on(LIVE_EVENT.Offer, (payload: SignalPayload) => void this.onDescription(payload));
    socket.on(LIVE_EVENT.Answer, (payload: SignalPayload) => void this.onDescription(payload));
    socket.on(LIVE_EVENT.Ice, (payload: SignalPayload) => void this.onCandidate(payload));

    socket.on(LIVE_EVENT.ChatMessage, (message: LiveChatMessageDto) => {
      this.chat.update((list) => [...list, message]);
    });

    socket.on(LIVE_EVENT.BoardOp, (op: WhiteboardOp) => {
      this.applyBoardOpLocally(op);
      this.incomingBoardOps.next(op);
    });

    socket.on(LIVE_EVENT.Waiting, ({ participant }: { participant: LiveParticipantDto }) => {
      this.waitingRoom.update((list) => [...list.filter((p) => p.socketId !== participant.socketId), participant]);
    });

    socket.on(LIVE_EVENT.Admitted, (data: LiveJoinedPayload) => this.applyJoined(data));

    socket.on(LIVE_EVENT.Muted, () => {
      this.setMic(false);
      this.mutedByHost.set(true);
    });

    socket.on(LIVE_EVENT.RoleChanged, ({ role }: { role: LiveParticipantRole }) => {
      const self = this.self();
      if (self) this.self.set({ ...self, role });
    });

    socket.on(LIVE_EVENT.RecordingState, ({ active }: { active: boolean }) => {
      this.recordingActive.set(active);
    });

    socket.on(LIVE_EVENT.Kicked, ({ denied }: { denied?: boolean }) => {
      this.error.set(denied ? 'No se le ha admitido en la sala.' : 'Se le ha expulsado de la sala.');
      this.state.set('ended');
      this.teardown();
    });

    socket.on(LIVE_EVENT.SessionEnded, () => {
      this.state.set('ended');
      this.teardown();
    });

    socket.on(LIVE_EVENT.Error, ({ message }: { message: string }) => this.error.set(message));

    socket.on('disconnect', (reason: string) => {
      // Socket.IO reconecta solo salvo cuando el cierre es deliberado; en ese
      // caso la sala ya no existe para nosotros.
      if (reason === 'io client disconnect' || reason === 'io server disconnect') {
        if (this.state() !== 'ended') this.state.set('ended');
        this.teardown();
      }
    });
  }

  private upsertPeer(participant: LiveParticipantDto): void {
    this.peers.update((list) => {
      const existente = list.find((peer) => peer.socketId === participant.socketId);
      if (!existente) {
        return [
          ...list,
          {
            socketId: participant.socketId,
            participant,
            stream: null,
            screenStream: null,
            connection: 'new' as RTCPeerConnectionState,
          },
        ];
      }
      return list.map((peer) =>
        peer.socketId === participant.socketId ? { ...peer, participant } : peer,
      );
    });
  }

  private patchPeer(socketId: string, patch: Partial<LivePeer>): void {
    this.peers.update((list) =>
      list.map((peer) => (peer.socketId === socketId ? { ...peer, ...patch } : peer)),
    );
  }

  /* ------------------------------ Malla WebRTC --------------------------- */

  private openLink(peerId: string): PeerLink {
    const existente = this.links.get(peerId);
    if (existente) return existente;

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceTransportPolicy: this.forceRelay ? 'relay' : 'all',
      // Un solo lote de candidatos por conexión: en una malla de diez extremos,
      // negociar cada uno por separado multiplica el trasiego sin ganar nada.
      bundlePolicy: 'max-bundle',
    });

    const link: PeerLink = {
      pc,
      // El identificador de conexión decide, y es distinto en cada extremo:
      // exactamente uno de los dos resulta cortés.
      polite: (this.self()?.socketId ?? '') > peerId,
      makingOffer: false,
      ignoringOffer: false,
      pending: [],
      senders: { audio: null, video: null },
    };
    this.links.set(peerId, link);

    pc.onnegotiationneeded = async () => {
      try {
        link.makingOffer = true;
        await pc.setLocalDescription();
        this.emitSignal(LIVE_EVENT.Offer, peerId, pc.localDescription);
      } catch {
        // Una negociación fallida se reintenta sola en cuanto cambie algo.
      } finally {
        link.makingOffer = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.socket?.emit(LIVE_EVENT.Ice, { peer: peerId, candidate });
    };

    pc.onconnectionstatechange = () => {
      this.patchPeer(peerId, { connection: pc.connectionState });
      if (pc.connectionState === 'failed') {
        // Reinicia solo la negociación ICE: cerrar y rehacer la conexión
        // perdería las pistas ya negociadas y parpadearía el vídeo.
        pc.restartIce();
      }
    };

    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      const peer = this.peers().find((p) => p.socketId === peerId);
      // Una segunda emisión de vídeo del mismo extremo es la pantalla que
      // comparte: la primera es su cámara.
      const esPantalla =
        track.kind === 'video' && Boolean(peer?.stream) && peer?.stream?.id !== stream.id;
      this.patchPeer(peerId, esPantalla ? { screenStream: stream } : { stream });

      track.onended = () => {
        if (esPantalla) this.patchPeer(peerId, { screenStream: null });
      };
    };

    this.attachLocalTracks(link);
    return link;
  }

  /** Publica lo que emitimos en una conexión concreta. */
  private attachLocalTracks(link: PeerLink): void {
    const stream = this.localStream();
    if (!stream) return;

    for (const track of stream.getTracks()) {
      const sender = link.pc.addTrack(track, stream);
      if (track.kind === 'audio') link.senders.audio = sender;
      else link.senders.video = sender;
    }

    // Con la pantalla ya compartida, el recién llegado la ve desde el principio.
    const pantalla = this.screenStream();
    const pista = pantalla?.getVideoTracks()[0];
    if (pista) link.pc.addTrack(pista, pantalla as MediaStream);
  }

  private emitSignal(event: string, peerId: string, description: RTCSessionDescription | null): void {
    if (!description) return;
    this.socket?.emit(event, { peer: peerId, description });
  }

  private async onDescription(payload: SignalPayload): Promise<void> {
    const description = payload?.description;
    if (!payload?.peer || !description) return;

    const link = this.links.get(payload.peer) ?? this.openLink(payload.peer);
    const { pc } = link;

    const colision =
      description.type === 'offer' && (link.makingOffer || pc.signalingState !== 'stable');
    link.ignoringOffer = !link.polite && colision;
    if (link.ignoringOffer) return;

    try {
      await pc.setRemoteDescription(description as RTCSessionDescriptionInit);
      for (const candidate of link.pending.splice(0)) {
        await pc.addIceCandidate(candidate).catch(() => undefined);
      }
      if (description.type === 'offer') {
        await pc.setLocalDescription();
        this.emitSignal(LIVE_EVENT.Answer, payload.peer, pc.localDescription);
      }
    } catch {
      // Descripción fuera de tiempo: la siguiente negociación la corrige.
    }
  }

  private async onCandidate(payload: SignalPayload): Promise<void> {
    if (!payload?.peer || !payload.candidate) return;
    const link = this.links.get(payload.peer);
    if (!link) return;

    const candidate = payload.candidate as RTCIceCandidateInit;
    // Un candidato antes de la descripción remota se descarta en el navegador;
    // guardarlo y reponerlo después evita perder la ruta más rápida.
    if (!link.pc.remoteDescription) {
      link.pending.push(candidate);
      return;
    }
    await link.pc.addIceCandidate(candidate).catch(() => {
      if (!link.ignoringOffer) return;
    });
  }

  private closeLink(peerId: string): void {
    const link = this.links.get(peerId);
    if (!link) return;
    link.pc.onnegotiationneeded = null;
    link.pc.onicecandidate = null;
    link.pc.ontrack = null;
    link.pc.onconnectionstatechange = null;
    link.pc.close();
    this.links.delete(peerId);
  }

  /* -------------------------------- Medios ------------------------------- */

  private async openLocalMedia(options: { audio: boolean; video: boolean }): Promise<void> {
    if (!options.audio && !options.video) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: options.audio
        ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : false,
      video: options.video
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : false,
    });
    this.localStream.set(stream);
    this.micOn.set(options.audio && stream.getAudioTracks().length > 0);
    this.camOn.set(options.video && stream.getVideoTracks().length > 0);
    this.applyLocalTrackFlags();
    await this.refreshDevices();
  }

  /** Enciende o apaga las pistas según lo que digan las señales. */
  private applyLocalTrackFlags(): void {
    const stream = this.localStream();
    if (!stream) return;
    for (const track of stream.getAudioTracks()) track.enabled = this.micOn();
    for (const track of stream.getVideoTracks()) track.enabled = this.camOn();
  }

  async refreshDevices(): Promise<void> {
    try {
      this.devices.set(await navigator.mediaDevices.enumerateDevices());
    } catch {
      this.devices.set([]);
    }
  }

  setMic(on: boolean): void {
    if (on && !this.canPublish()) return;
    this.micOn.set(on);
    if (on) this.mutedByHost.set(false);
    this.applyLocalTrackFlags();
    this.publishState({ audio: on });
  }

  setCam(on: boolean): void {
    if (on && !this.canPublish() && !this.session()?.settings.allowAttendeeCamera) return;
    this.camOn.set(on);
    this.applyLocalTrackFlags();
    this.publishState({ video: on });
  }

  toggleHand(): void {
    const next = !this.handUp();
    this.handUp.set(next);
    this.publishState({ hand: next });
  }

  /**
   * Cambia de micrófono o de cámara sin cortar la conferencia.
   * `replaceTrack` sustituye la pista en cada conexión sin volver a negociar,
   * que es lo que hace que el cambio sea instantáneo para los demás.
   */
  async switchDevice(kind: 'audio' | 'video', deviceId: string): Promise<void> {
    const constraints: MediaStreamConstraints =
      kind === 'audio'
        ? { audio: { deviceId: { exact: deviceId }, echoCancellation: true } }
        : { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 } } };

    const nuevo = await navigator.mediaDevices.getUserMedia(constraints);
    const pista = kind === 'audio' ? nuevo.getAudioTracks()[0] : nuevo.getVideoTracks()[0];
    if (!pista) return;

    const actual = this.localStream() ?? new MediaStream();
    const anteriores = kind === 'audio' ? actual.getAudioTracks() : actual.getVideoTracks();
    for (const vieja of anteriores) {
      actual.removeTrack(vieja);
      vieja.stop();
    }
    actual.addTrack(pista);
    this.localStream.set(actual);
    this.applyLocalTrackFlags();

    for (const link of this.links.values()) {
      const sender = kind === 'audio' ? link.senders.audio : link.senders.video;
      if (sender) await sender.replaceTrack(pista).catch(() => undefined);
      else this.attachLocalTracks(link);
    }

    if (kind === 'audio') this.selectedMic.set(deviceId);
    else this.selectedCam.set(deviceId);
  }

  /**
   * Comparte pantalla, ventana o pestaña. El navegador es quien ofrece elegir
   * cuál —la plataforma no puede ni debe decidirlo— y `getDisplayMedia` es la
   * única vía por la que un sitio web puede pedirlo.
   */
  async startScreenShare(withAudio = true): Promise<void> {
    if (!this.canShareScreen()) return;

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } },
      audio: withAudio,
    });
    this.screenStream.set(stream);

    const pista = stream.getVideoTracks()[0];
    for (const link of this.links.values()) {
      link.pc.addTrack(pista, stream);
    }
    // El botón «Dejar de compartir» del navegador termina la pista sin pasar
    // por la interfaz: hay que escucharlo o la sala seguiría anunciándola.
    pista.onended = () => void this.stopScreenShare();
    this.publishState({ screen: true });
  }

  async stopScreenShare(): Promise<void> {
    const stream = this.screenStream();
    if (!stream) return;

    for (const link of this.links.values()) {
      for (const sender of link.pc.getSenders()) {
        if (sender.track && stream.getTracks().includes(sender.track)) {
          link.pc.removeTrack(sender);
        }
      }
    }
    for (const track of stream.getTracks()) track.stop();
    this.screenStream.set(null);
    this.publishState({ screen: false });
  }

  private publishState(patch: { audio?: boolean; video?: boolean; screen?: boolean; hand?: boolean }): void {
    this.socket?.emit(LIVE_EVENT.MediaState, patch);
    const self = this.self();
    if (self) this.self.set({ ...self, ...patch });
  }

  /* --------------------------------- Chat -------------------------------- */

  sendChat(body: string): void {
    const texto = body.trim();
    if (!texto) return;
    this.socket?.emit(LIVE_EVENT.ChatSend, { body: texto });
  }

  /* ------------------------------- Pizarra ------------------------------- */

  /** Envía una operación y la aplica ya en local, para que no haya latencia. */
  sendBoardOp(op: WhiteboardOp): void {
    this.applyBoardOpLocally(op);
    this.socket?.emit(LIVE_EVENT.BoardOp, op);
  }

  private applyBoardOpLocally(op: WhiteboardOp): void {
    const estado = this.board();
    if (!estado) return;

    const pages = estado.pages.map((page) => ({ ...page, items: [...page.items] }));
    let activePageId = estado.activePageId;

    switch (op.kind) {
      case 'add': {
        const page = pages.find((p) => p.id === op.pageId);
        // Un trazo repetido llega cuando el servidor devuelve el eco de una
        // operación propia; sin esta comprobación se dibujaría dos veces.
        if (page && !page.items.some((item) => item.id === op.item.id)) page.items.push(op.item);
        break;
      }
      case 'remove': {
        const page = pages.find((p) => p.id === op.pageId);
        if (page) {
          const fuera = new Set(op.itemIds);
          page.items = page.items.filter((item) => !fuera.has(item.id));
        }
        break;
      }
      case 'clear': {
        const page = pages.find((p) => p.id === op.pageId);
        if (page) page.items = [];
        break;
      }
      case 'page-add': {
        if (!pages.some((p) => p.id === op.page.id)) pages.push({ ...op.page, items: [] });
        activePageId = op.page.id;
        break;
      }
      case 'page-remove': {
        if (pages.length <= 1) break;
        const restantes = pages.filter((p) => p.id !== op.pageId);
        if (activePageId === op.pageId) activePageId = restantes[0].id;
        this.board.set({ pages: restantes, activePageId });
        return;
      }
      case 'page-select':
        activePageId = op.pageId;
        break;
    }

    this.board.set({ pages, activePageId });
  }

  /* ------------------------------ Moderación ----------------------------- */

  muteParticipant(socketId: string): void {
    this.socket?.emit(LIVE_EVENT.HostMute, { target: socketId });
  }

  muteEveryone(): void {
    this.socket?.emit(LIVE_EVENT.HostMute, { all: true });
  }

  lowerHand(socketId: string): void {
    this.socket?.emit(LIVE_EVENT.HostLowerHand, { target: socketId });
  }

  kick(socketId: string): void {
    this.socket?.emit(LIVE_EVENT.HostKick, { target: socketId });
  }

  admit(socketId: string, admit: boolean): void {
    this.socket?.emit(LIVE_EVENT.HostAdmit, { target: socketId, admit });
    this.waitingRoom.update((list) => list.filter((p) => p.socketId !== socketId));
  }

  setRole(socketId: string, role: LiveParticipantRole): void {
    this.socket?.emit(LIVE_EVENT.HostPromote, { target: socketId, role });
  }

  announceRecording(active: boolean): void {
    this.socket?.emit(LIVE_EVENT.RecordingState, { active });
    this.recordingActive.set(active);
  }

  endSession(): void {
    this.socket?.emit(LIVE_EVENT.SessionEnd);
  }

  /* -------------------------------- Salida ------------------------------- */

  leave(): void {
    this.socket?.emit(LIVE_EVENT.Leave);
    this.teardown();
    if (this.state() !== 'ended') this.state.set('idle');
  }

  private teardown(): void {
    for (const peerId of Array.from(this.links.keys())) this.closeLink(peerId);
    this.peers.set([]);
    this.releaseMedia();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private releaseMedia(): void {
    for (const track of this.localStream()?.getTracks() ?? []) track.stop();
    for (const track of this.screenStream()?.getTracks() ?? []) track.stop();
    this.localStream.set(null);
    this.screenStream.set(null);
  }

  /** Todas las pistas que suenan o se ven ahora: lo que hay que grabar. */
  captureSources(): { local: MediaStream | null; screen: MediaStream | null; remote: MediaStream[] } {
    return {
      local: this.localStream(),
      screen: this.screenStream(),
      remote: this.peers()
        .flatMap((peer) => [peer.stream, peer.screenStream])
        .filter((stream): stream is MediaStream => Boolean(stream)),
    };
  }
}

interface SignalPayload {
  peer: string;
  description?: RTCSessionDescriptionInit;
  candidate?: unknown;
}


function mensaje(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'No se ha podido entrar a la sala.';
}

/** Traduce el error de `getUserMedia` a algo accionable. */
function descripcionDeMedios(error: unknown): string {
  const name = (error as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError') {
    return 'Ha denegado el acceso a la cámara y al micrófono. Puede entrar igual, pero solo escuchando.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No se ha encontrado cámara ni micrófono. Entrará solo para ver y escuchar.';
  }
  if (name === 'NotReadableError') {
    return 'Otra aplicación está usando la cámara o el micrófono.';
  }
  return 'No se ha podido acceder a la cámara ni al micrófono.';
}
