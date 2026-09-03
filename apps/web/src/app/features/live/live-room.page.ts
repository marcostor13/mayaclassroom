import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LiveParticipantDto,
  LiveParticipantRole,
  LiveSessionMode,
  WhiteboardOp,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { LiveRecorderService, RecorderSource } from '../../core/services/live-recorder.service';
import { LivePeer, LiveRoomService } from '../../core/services/live-room.service';
import { ToastService } from '../../core/services/toast.service';
import { AvatarComponent, IconComponent } from '../../shared';
import { LiveTileComponent } from './live-tile.component';
import { LiveWhiteboardComponent } from './live-whiteboard.component';

/** Paneles laterales; solo uno abierto a la vez. */
type Panel = 'chat' | 'people' | 'settings' | null;

/** Disposición del escenario. */
type Layout = 'grid' | 'spotlight';

/**
 * La sala en vivo.
 *
 * Vive fuera del armazón de la aplicación —sin barra lateral ni menú— porque
 * durante una clase la pantalla es el escenario: cualquier cromo alrededor
 * resta sitio a los rostros y a lo que se comparte.
 *
 * El servicio de la sala se registra aquí y no en la raíz a propósito: al salir
 * de la ruta, Angular lo destruye y con él se cierran las conexiones y se
 * apagan cámara y micrófono. Con un servicio global, salir de la sala dejaría
 * el piloto de la cámara encendido.
 */
@Component({
  selector: 'maya-live-room',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, AvatarComponent, LiveTileComponent, LiveWhiteboardComponent],
  providers: [LiveRoomService, LiveRecorderService],
  templateUrl: './live-room.page.html',
  styleUrl: './live-room.page.scss',
})
export class LiveRoomPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly room = inject(LiveRoomService);
  readonly recorder = inject(LiveRecorderService);

  readonly roomRef = signal(this.route.snapshot.paramMap.get('ref') ?? '');

  /** Antes de entrar: se prueban cámara y micrófono sin molestar a nadie. */
  readonly prejoin = signal(true);
  readonly wantAudio = signal(true);
  readonly wantVideo = signal(true);
  readonly joining = signal(false);
  readonly previewStream = signal<MediaStream | null>(null);

  readonly panel = signal<Panel>(null);
  readonly layout = signal<Layout>('grid');
  readonly boardOpen = signal(false);
  readonly chatDraft = signal('');
  readonly copied = signal(false);

  readonly userId = computed(() => this.auth.user()?.id ?? '');
  readonly session = this.room.session;
  readonly participants = computed(() => this.room.peers());
  readonly unreadChat = signal(0);

  /** Quien comparte pantalla manda en el escenario, sea quien sea. */
  readonly presenter = computed<LivePeer | null>(
    () => this.participants().find((peer) => Boolean(peer.screenStream)) ?? null,
  );

  readonly sharingLocally = computed(() => Boolean(this.room.screenStream()));

  /** Escenario: pizarra, pantalla compartida o quien esté destacado. */
  readonly stage = computed<'board' | 'screen' | 'grid'>(() => {
    if (this.boardOpen()) return 'board';
    if (this.sharingLocally() || this.presenter()) return 'screen';
    return this.layout() === 'spotlight' ? 'screen' : 'grid';
  });

  readonly peopleCount = computed(() => this.participants().length + 1);

  // `stageEl` y no `stage`: la referencia de plantilla eclipsaría a la señal
  // `stage()` dentro del propio HTML, y el compilador intenta llamar al
  // elemento del DOM.
  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stageEl');

  /** Tamaño del escenario; cambia al abrir un panel o girar el teléfono. */
  private readonly stageSize = signal({ width: 0, height: 0 });

  /**
   * Columnas de la rejilla.
   *
   * No vale repartir por la raíz cuadrada: lo que importa no es que la rejilla
   * sea cuadrada sino que cada recuadro se acerque a la proporción del vídeo.
   * Se prueban todas las reparticiones posibles y gana la que deja los
   * recuadros más grandes con esa proporción — el mismo criterio que usa
   * cualquier sala de videoconferencia, y lo que evita a la vez los recuadros
   * altísimos y estrechos y las filas medio vacías.
   */
  readonly gridColumns = computed(() => {
    const total = this.peopleCount();
    const { width, height } = this.stageSize();
    if (total <= 1) return 1;
    if (!width || !height) return Math.ceil(Math.sqrt(total));

    let mejor = { columnas: 1, lado: 0 };
    for (let columnas = 1; columnas <= total; columnas++) {
      const filas = Math.ceil(total / columnas);
      const ancho = width / columnas;
      const alto = height / filas;
      // Lado útil del recuadro una vez encajada la proporción 16:9 dentro
      // de la celda: la dimensión que de verdad se ve.
      const lado = Math.min(ancho, alto * (16 / 9));
      if (lado > mejor.lado) mejor = { columnas, lado };
    }
    return mejor.columnas;
  });

  /**
   * Columna donde empieza el primer recuadro de la última fila, para centrar
   * los que sobran. Sin esto, siete personas en tres columnas dejan una fila
   * con un solo recuadro pegado a la izquierda y un hueco enorme al lado.
   */
  gridStart(indice: number): number | null {
    const columnas = this.gridColumns();
    const total = this.peopleCount();
    const sobrantes = total % columnas;
    if (!sobrantes || indice !== total - sobrantes) return null;
    return Math.floor((columnas - sobrantes) / 2) + 1;
  }

  readonly waiting = this.room.waitingRoom;

  readonly roleLabel = computed(() => {
    switch (this.room.self()?.role) {
      case LiveParticipantRole.Host:
        return 'Anfitrión';
      case LiveParticipantRole.CoHost:
        return 'Co-anfitrión';
      default:
        return 'Asistente';
    }
  });

  readonly modeLabel = computed(() =>
    this.session()?.mode === LiveSessionMode.Meeting ? 'Reunión' : 'Clase',
  );

  readonly mics = computed(() =>
    this.room.devices().filter((device) => device.kind === 'audioinput'),
  );
  readonly cams = computed(() =>
    this.room.devices().filter((device) => device.kind === 'videoinput'),
  );

  readonly recorderSupported = LiveRecorderService.soportado;

  constructor() {
    void this.startPreview();

    // Contador de mensajes sin leer mientras el panel del chat está cerrado.
    let vistos = 0;
    effect(() => {
      const total = this.room.chat().length;
      if (this.panel() === 'chat') {
        vistos = total;
        this.unreadChat.set(0);
        return;
      }
      this.unreadChat.set(Math.max(0, total - vistos));
    });

    // Un aviso del navegador antes de cerrar la pestaña mientras se graba: si
    // se cierra, la grabación se queda a medias y no hay forma de recuperarla.
    const alSalir = (event: BeforeUnloadEvent) => {
      if (!this.recorder.recording()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);

    // El escenario se mide de verdad y no por la ventana: abrir el panel
    // lateral le quita 330 px y la repartición tiene que rehacerse.
    let observador: ResizeObserver | null = null;
    afterNextRender(() => {
      const elemento = this.stageRef()?.nativeElement;
      if (!elemento) return;
      observador = new ResizeObserver(([entrada]) => {
        const { width, height } = entrada.contentRect;
        this.stageSize.set({ width, height });
      });
      observador.observe(elemento);
    });

    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeunload', alSalir);
      observador?.disconnect();
      this.stopPreview();
      if (this.recorder.recording()) void this.recorder.abort();
    });
  }

  /* ------------------------------ Antesala -------------------------------- */

  /** Vista previa local; no se envía a nadie y se apaga al entrar. */
  private async startPreview(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      this.previewStream.set(stream);
      await this.room.refreshDevices();
    } catch {
      this.wantVideo.set(false);
      this.wantAudio.set(false);
    }
  }

  private stopPreview(): void {
    for (const track of this.previewStream()?.getTracks() ?? []) track.stop();
    this.previewStream.set(null);
  }

  async enter(): Promise<void> {
    this.joining.set(true);
    // La vista previa suelta la cámara antes de que la pida la sala: algunos
    // sistemas no permiten dos capturas simultáneas del mismo dispositivo.
    this.stopPreview();

    await this.room.join(this.roomRef(), {
      audio: this.wantAudio(),
      video: this.wantVideo(),
    });
    this.joining.set(false);

    if (this.room.state() === 'error') {
      this.toast.error('No se ha podido entrar', this.room.error() ?? '');
      return;
    }
    this.prejoin.set(false);

    if (this.room.error()) this.toast.warning('Aviso', this.room.error() ?? '');
    if (this.session()?.settings.autoRecord && this.session()?.canRecord) {
      await this.toggleRecording();
    }
  }

  /* ------------------------------- Controles ------------------------------ */

  toggleMic(): void {
    this.room.setMic(!this.room.micOn());
  }

  toggleCam(): void {
    this.room.setCam(!this.room.camOn());
  }

  async toggleScreen(): Promise<void> {
    try {
      if (this.sharingLocally()) await this.room.stopScreenShare();
      else await this.room.startScreenShare();
    } catch {
      // Cancelar el selector del navegador no es un error que contar.
    }
  }

  toggleBoard(): void {
    this.boardOpen.set(!this.boardOpen());
  }

  togglePanel(panel: Exclude<Panel, null>): void {
    this.panel.set(this.panel() === panel ? null : panel);
  }

  toggleLayout(): void {
    this.layout.set(this.layout() === 'grid' ? 'spotlight' : 'grid');
  }

  async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await document.documentElement.requestFullscreen().catch(() => undefined);
  }

  sendChat(): void {
    const texto = this.chatDraft().trim();
    if (!texto) return;
    this.room.sendChat(texto);
    this.chatDraft.set('');
  }

  onBoardOp(op: WhiteboardOp): void {
    this.room.sendBoardOp(op);
  }

  async switchMic(deviceId: string): Promise<void> {
    await this.room.switchDevice('audio', deviceId).catch(() => {
      this.toast.error('No se ha podido cambiar el micrófono');
    });
  }

  async switchCam(deviceId: string): Promise<void> {
    await this.room.switchDevice('video', deviceId).catch(() => {
      this.toast.error('No se ha podido cambiar la cámara');
    });
  }

  /** Copia el enlace de la sala al portapapeles. */
  async copyLink(): Promise<void> {
    const url = this.session()?.joinUrl ?? window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toast.info('Enlace de la sala', url);
    }
  }

  /* ------------------------------ Grabación ------------------------------- */

  async toggleRecording(): Promise<void> {
    const session = this.session();
    if (!session?.canRecord) return;

    if (this.recorder.recording()) {
      const grabacion = await this.recorder.stop();
      this.room.announceRecording(false);
      if (grabacion) {
        this.toast.success('Grabación guardada', 'Ya está disponible en la sesión.');
      } else if (this.recorder.error()) {
        this.toast.error('Grabación', this.recorder.error() ?? '');
      }
      return;
    }

    await this.recorder.start(session.id, session.title, () => this.recorderSources());
    if (this.recorder.error()) {
      this.toast.error('Grabación', this.recorder.error() ?? '');
      return;
    }
    this.room.announceRecording(true);
    this.toast.info('Grabando', 'Se avisa a toda la sala de que la clase se está grabando.');
  }

  /** Lo que entra en el vídeo: la pantalla compartida y todas las cámaras. */
  private recorderSources(): RecorderSource[] {
    const fuentes: RecorderSource[] = [];
    const propio = this.room.self();

    const pantallaLocal = this.room.screenStream();
    if (pantallaLocal) {
      fuentes.push({ label: 'Pantalla compartida', stream: pantallaLocal, kind: 'screen' });
    }

    const local = this.room.localStream();
    if (local && propio) {
      fuentes.push({ label: propio.fullName, stream: local, kind: 'camera' });
    }

    for (const peer of this.participants()) {
      if (peer.screenStream) {
        fuentes.push({
          label: `${peer.participant.fullName} · pantalla`,
          stream: peer.screenStream,
          kind: 'screen',
        });
      }
      if (peer.stream) {
        fuentes.push({ label: peer.participant.fullName, stream: peer.stream, kind: 'camera' });
      }
    }
    return fuentes;
  }

  /* ------------------------------ Moderación ------------------------------ */

  muteEveryone(): void {
    this.room.muteEveryone();
    this.toast.info('Silencio', 'Se ha pedido silencio a los asistentes.');
  }

  kick(peer: LiveParticipantDto): void {
    this.confirm
      .ask({
        title: 'Expulsar de la sala',
        message: `Se expulsará a ${peer.fullName}. Podrá volver a entrar con el enlace.`,
        confirmLabel: 'Expulsar',
      })
      .subscribe((confirmado) => {
        if (confirmado) this.room.kick(peer.socketId);
      });
  }

  promote(peer: LiveParticipantDto): void {
    const siguiente =
      peer.role === LiveParticipantRole.CoHost
        ? LiveParticipantRole.Attendee
        : LiveParticipantRole.CoHost;
    this.room.setRole(peer.socketId, siguiente);
  }

  /* -------------------------------- Salida -------------------------------- */

  async leave(): Promise<void> {
    if (this.recorder.recording()) {
      const grabacion = await this.recorder.stop();
      this.room.announceRecording(false);
      if (grabacion) this.toast.success('Grabación guardada');
    }
    this.room.leave();
    await this.router.navigate(['/live']);
  }

  endForEveryone(): void {
    this.confirm
      .ask({
        title: 'Finalizar la sesión',
        message: 'Se cerrará la sala para todo el mundo y se guardará la asistencia.',
        confirmLabel: 'Finalizar',
      })
      .subscribe(async (confirmado) => {
        if (!confirmado) return;
        if (this.recorder.recording()) {
          await this.recorder.stop();
        }
        this.room.endSession();
        await this.router.navigate(['/live']);
      });
  }

  async backToList(): Promise<void> {
    await this.router.navigate(['/live']);
  }

  /** Reloj de la grabación en `mm:ss`. */
  readonly recordingClock = computed(() => {
    const total = this.recorder.seconds();
    const minutos = Math.floor(total / 60);
    const segundos = total % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  });

  /** Un flujo tiene vídeo si su pista está viva y encendida. */
  hasVideo(stream: MediaStream | null | undefined, enabled = true): boolean {
    if (!stream || !enabled) return false;
    return stream.getVideoTracks().some((track) => track.readyState === 'live');
  }
}
