import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LiveRecordingDto } from '../models';
import { LiveService } from './live.service';

/** Lo que hay que pintar y mezclar en cada instante de la grabación. */
export interface RecorderSource {
  /** Persona a la que pertenece; se rotula bajo su recuadro. */
  label: string;
  stream: MediaStream;
  /** Las pantallas compartidas ocupan el escenario; las cámaras, las fichas. */
  kind: 'camera' | 'screen';
}

/** Tamaño del lienzo de grabación: 720p, suficiente y ligero de codificar. */
const ANCHO = 1280;
const ALTO = 720;

/** Un trozo cada cinco segundos: corto para no perder mucho si algo falla. */
const INTERVALO_TROZO = 5000;

/**
 * Grabación de la clase, compuesta en el propio navegador.
 *
 * Dibuja la sala en un lienzo —la pantalla compartida al frente y las cámaras
 * como fichas, o una rejilla si nadie comparte—, mezcla todos los audios en una
 * sola pista y lo entrega a `MediaRecorder`, que lo va troceando. Cada trozo
 * sube a la API en cuanto está listo, así que un corte de luz solo pierde los
 * últimos segundos y no la clase entera.
 *
 * Se compone aquí y no en el servidor porque esta pestaña ya tiene todas las
 * pistas descifradas y colocadas: hacerlo en el servidor exigiría un servidor
 * de medios que recibiese y decodificase cada flujo por separado.
 */
@Injectable()
export class LiveRecorderService {
  private readonly live = inject(LiveService);

  readonly recording = signal(false);
  readonly seconds = signal(0);
  readonly uploadPending = signal(0);
  readonly error = signal<string | null>(null);

  private recorder: MediaRecorder | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private readonly videos = new Map<string, HTMLVideoElement>();
  private readonly mixed = new Set<string>();
  private frame = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private chunkIndex = 0;
  private cola: Promise<unknown> = Promise.resolve();
  private recordingId: string | null = null;
  private sources: () => RecorderSource[] = () => [];

  /** Formato admitido por este navegador, del mejor al que siempre existe. */
  private static formato(): string {
    const candidatos = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidatos.find((tipo) => MediaRecorder.isTypeSupported(tipo)) ?? 'video/webm';
  }

  static get soportado(): boolean {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function'
    );
  }

  /* -------------------------------- Arranque ------------------------------ */

  async start(sessionId: string, title: string, sources: () => RecorderSource[]): Promise<void> {
    if (this.recording()) return;
    if (!LiveRecorderService.soportado) {
      this.error.set('Este navegador no puede grabar. Pruebe con Chrome, Edge o Firefox.');
      return;
    }

    this.error.set(null);
    this.sources = sources;

    const formato = LiveRecorderService.formato();
    const recording = await firstValueFrom(
      this.live.startRecording(sessionId, { title, mimeType: formato.split(';')[0] }),
    );
    this.recordingId = recording.id;
    this.chunkIndex = 0;
    this.cola = Promise.resolve();

    const canvas = document.createElement('canvas');
    canvas.width = ANCHO;
    canvas.height = ALTO;
    this.canvas = canvas;

    this.audioContext = new AudioContext();
    this.destination = this.audioContext.createMediaStreamDestination();

    const stream = new MediaStream([
      ...canvas.captureStream(24).getVideoTracks(),
      ...this.destination.stream.getAudioTracks(),
    ]);

    const recorder = new MediaRecorder(stream, {
      mimeType: formato,
      videoBitsPerSecond: 1_800_000,
      audioBitsPerSecond: 128_000,
    });
    this.recorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.encolar(event.data);
    };
    recorder.onerror = () => this.error.set('La grabación se ha interrumpido.');

    this.startedAt = Date.now();
    this.seconds.set(0);
    this.ticker = setInterval(
      () => this.seconds.set(Math.round((Date.now() - this.startedAt) / 1000)),
      1000,
    );

    this.pintar();
    recorder.start(INTERVALO_TROZO);
    this.recording.set(true);
  }

  /* --------------------------------- Cierre ------------------------------- */

  async stop(): Promise<LiveRecordingDto | null> {
    if (!this.recording() || !this.recorder || !this.recordingId) return null;

    const recorder = this.recorder;
    const detenido = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.stop();
    await detenido;

    const duracion = Math.round((Date.now() - this.startedAt) / 1000);
    this.desmontar();

    try {
      // Los trozos suben en fila; cerrar antes de que termine la cola dejaría
      // el final de la clase fuera del fichero.
      await this.cola;
      return await firstValueFrom(
        this.live.finishRecording(this.recordingId, {
          durationSeconds: duracion,
          chunkCount: this.chunkIndex,
        }),
      );
    } catch {
      this.error.set('No se ha podido guardar la grabación.');
      return null;
    } finally {
      this.recordingId = null;
    }
  }

  /** Descarta lo grabado; se usa al salir de la sala sin cerrar bien. */
  async abort(): Promise<void> {
    const id = this.recordingId;
    this.recorder?.stop();
    this.desmontar();
    this.recordingId = null;
    if (id) await firstValueFrom(this.live.abortRecording(id)).catch(() => undefined);
  }

  private desmontar(): void {
    this.recording.set(false);
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;

    for (const video of this.videos.values()) {
      video.srcObject = null;
      video.remove();
    }
    this.videos.clear();
    this.mixed.clear();

    void this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;
    this.destination = null;
    this.recorder = null;
    this.canvas = null;
  }

  /* ------------------------------ Subida en fila -------------------------- */

  private encolar(blob: Blob): void {
    const index = this.chunkIndex++;
    const id = this.recordingId;
    if (!id) return;

    this.uploadPending.update((n) => n + 1);
    // Encadenados y no en paralelo: el orden de los trozos *es* el vídeo, y
    // enviarlos a la vez los entrega desordenados en cuanto la red va justa.
    this.cola = this.cola
      .then(() => firstValueFrom(this.live.uploadChunk(id, index, blob)))
      .catch(() => this.error.set('Se ha perdido un fragmento de la grabación.'))
      .finally(() => this.uploadPending.update((n) => Math.max(0, n - 1)));
  }

  /* ------------------------------ Composición ----------------------------- */

  /** Elemento de vídeo oculto por cada flujo, reutilizado entre fotogramas. */
  private videoDe(source: RecorderSource): HTMLVideoElement {
    const clave = source.stream.id;
    const existente = this.videos.get(clave);
    if (existente) return existente;

    const video = document.createElement('video');
    video.srcObject = source.stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => undefined);
    this.videos.set(clave, video);
    return video;
  }

  /** Conecta el audio de un flujo a la mezcla, una sola vez por flujo. */
  private mezclar(stream: MediaStream): void {
    if (!this.audioContext || !this.destination) return;
    if (this.mixed.has(stream.id) || !stream.getAudioTracks().length) return;
    try {
      this.audioContext.createMediaStreamSource(stream).connect(this.destination);
      this.mixed.add(stream.id);
    } catch {
      // Un flujo sin audio utilizable no debe tumbar la grabación.
    }
  }

  private pintar = (): void => {
    const canvas = this.canvas;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const fuentes = this.sources();
    for (const fuente of fuentes) this.mezclar(fuente.stream);

    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, ANCHO, ALTO);

    const pantalla = fuentes.find((f) => f.kind === 'screen');
    const camaras = fuentes.filter((f) => f.kind === 'camera');

    if (pantalla) {
      this.dibujar(ctx, pantalla, 0, 0, ANCHO, ALTO, false);
      // Las cámaras se apilan en la esquina, como en cualquier videollamada
      // cuando alguien presenta.
      const ancho = 232;
      const alto = 130;
      camaras.slice(0, 4).forEach((camara, indice) => {
        const x = ANCHO - ancho - 16;
        const y = 16 + indice * (alto + 12);
        this.dibujar(ctx, camara, x, y, ancho, alto, true);
      });
    } else if (camaras.length) {
      const columnas = Math.ceil(Math.sqrt(camaras.length));
      const filas = Math.ceil(camaras.length / columnas);
      const ancho = Math.floor(ANCHO / columnas);
      const alto = Math.floor(ALTO / filas);
      camaras.forEach((camara, indice) => {
        const x = (indice % columnas) * ancho;
        const y = Math.floor(indice / columnas) * alto;
        this.dibujar(ctx, camara, x + 4, y + 4, ancho - 8, alto - 8, true);
      });
    } else {
      ctx.fillStyle = '#62666f';
      ctx.font = '600 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin vídeo', ANCHO / 2, ALTO / 2);
      ctx.textAlign = 'left';
    }

    this.frame = requestAnimationFrame(this.pintar);
  };

  /** Un recuadro con su vídeo ajustado sin deformar y su rótulo. */
  private dibujar(
    ctx: CanvasRenderingContext2D,
    source: RecorderSource,
    x: number,
    y: number,
    ancho: number,
    alto: number,
    conRotulo: boolean,
  ): void {
    const video = this.videoDe(source);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, ancho, alto);
    ctx.clip();
    ctx.fillStyle = '#17181c';
    ctx.fillRect(x, y, ancho, alto);

    if (video.videoWidth && video.videoHeight) {
      // `contain` y no `cover`: recortar una pantalla compartida escondería
      // justo lo que se está enseñando.
      const escala =
        source.kind === 'screen'
          ? Math.min(ancho / video.videoWidth, alto / video.videoHeight)
          : Math.max(ancho / video.videoWidth, alto / video.videoHeight);
      const w = video.videoWidth * escala;
      const h = video.videoHeight * escala;
      ctx.drawImage(video, x + (ancho - w) / 2, y + (alto - h) / 2, w, h);
    }

    if (conRotulo && source.label) {
      ctx.fillStyle = 'rgba(16, 17, 20, 0.66)';
      ctx.fillRect(x, y + alto - 26, ancho, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillText(recortar(ctx, source.label, ancho - 16), x + 8, y + alto - 8);
    }
    ctx.restore();
  }
}

/** Recorta el rótulo con puntos suspensivos si no cabe en el recuadro. */
function recortar(ctx: CanvasRenderingContext2D, texto: string, ancho: number): string {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let corto = texto;
  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > ancho) {
    corto = corto.slice(0, -1);
  }
  return `${corto}…`;
}

