import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  WhiteboardItem,
  WhiteboardOp,
  WhiteboardStateDto,
  WhiteboardTool,
} from '../../core/models';
import { IconComponent } from '../../shared';

/**
 * Anchura de referencia de la pizarra.
 *
 * Los puntos se guardan normalizados entre 0 y 1 y los grosores en píxeles de
 * un lienzo de 1000 px. Así lo dibujado se ve igual en un móvil y en un
 * proyector, que es la razón de ser de una pizarra compartida.
 */
const REFERENCIA = 1000;

/** Paleta de la pizarra: contrastan sobre blanco y entre sí. */
const COLORES = [
  '#101114',
  '#e02020',
  '#1e6fe0',
  '#12a150',
  '#d98a00',
  '#7b3fe4',
  '#ff6a4d',
  '#ffffff',
];

const GROSORES = [2, 4, 8, 16];

interface Herramienta {
  tool: WhiteboardTool;
  icon: string;
  label: string;
}

const HERRAMIENTAS: Herramienta[] = [
  { tool: WhiteboardTool.Pen, icon: 'edit', label: 'Lápiz' },
  { tool: WhiteboardTool.Highlighter, icon: 'sparkles', label: 'Rotulador' },
  { tool: WhiteboardTool.Line, icon: 'minus', label: 'Línea' },
  { tool: WhiteboardTool.Arrow, icon: 'arrow-right', label: 'Flecha' },
  { tool: WhiteboardTool.Rectangle, icon: 'grid', label: 'Rectángulo' },
  { tool: WhiteboardTool.Ellipse, icon: 'circle', label: 'Elipse' },
  { tool: WhiteboardTool.Text, icon: 'file-text', label: 'Texto' },
  { tool: WhiteboardTool.Eraser, icon: 'trash', label: 'Borrador' },
];

/**
 * Pizarra colaborativa sobre un lienzo.
 *
 * Pinta en dos capas: una interna con lo ya confirmado, que solo se rehace
 * cuando cambia la lista de trazos, y encima el trazo que se está haciendo
 * ahora. Sin esa separación, arrastrar el lápiz obligaría a repintar la pizarra
 * entera sesenta veces por segundo y el trazo iría a tirones en cuanto hubiera
 * unos cientos de figuras.
 */
@Component({
  selector: 'maya-live-whiteboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './live-whiteboard.component.html',
  styleUrl: './live-whiteboard.component.scss',
})
export class LiveWhiteboardComponent {
  /** Estado compartido; llega ya con las operaciones remotas aplicadas. */
  readonly board = input.required<WhiteboardStateDto | null>();
  readonly canDraw = input<boolean>(true);
  readonly moderator = input<boolean>(false);
  readonly authorId = input.required<string>();

  readonly operation = output<WhiteboardOp>();
  readonly closed = output<void>();

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly wrapRef = viewChild<ElementRef<HTMLElement>>('wrap');

  readonly tools = HERRAMIENTAS;
  readonly colors = COLORES;
  readonly widths = GROSORES;

  readonly tool = signal<WhiteboardTool>(WhiteboardTool.Pen);
  readonly color = signal(COLORES[0]);
  readonly width = signal(4);
  readonly filled = signal(false);
  readonly fontSize = signal(28);

  /** Trazos propios, para deshacer y rehacer sin tocar los de los demás. */
  private readonly undoStack = signal<WhiteboardItem[]>([]);
  private readonly redoStack = signal<WhiteboardItem[]>([]);
  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  /** Rótulo del texto que se está escribiendo, con su sitio en la pizarra. */
  readonly textDraft = signal<{ x: number; y: number; value: string } | null>(null);

  readonly pages = computed(() => this.board()?.pages ?? []);
  readonly activePage = computed(() => {
    const state = this.board();
    return state?.pages.find((page) => page.id === state.activePageId) ?? null;
  });

  /** Capa con lo confirmado; se blitea en cada fotograma del trazo en curso. */
  private readonly commited = document.createElement('canvas');
  private trazo: { points: number[]; start: [number, number] } | null = null;
  private pointerId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Repintar cuando cambian los trazos, la página activa o el tamaño.
    effect(() => {
      this.activePage();
      this.board();
      queueMicrotask(() => this.redrawAll());
    });

    // El lienzo se dimensiona una vez pintado el DOM: un `canvas` no emite
    // ningún evento de carga y, sin medidas, `getBoundingClientRect` da cero.
    afterNextRender(() => this.montarLienzo());
    inject(DestroyRef).onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
    });
  }

  /** Ajusta el lienzo al hueco disponible y a la densidad de la pantalla. */
  private montarLienzo(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const wrap = this.wrapRef()?.nativeElement;
    if (!canvas || !wrap || this.resizeObserver) return;

    const ajustar = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      this.commited.width = canvas.width;
      this.commited.height = canvas.height;
      this.redrawAll();
    };

    this.resizeObserver = new ResizeObserver(ajustar);
    this.resizeObserver.observe(wrap);
    ajustar();
  }

  /* ------------------------------- Dibujado ------------------------------- */

  private redrawAll(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = this.commited.getContext('2d');
    if (!canvas || !ctx || !this.commited.width) return;

    ctx.clearRect(0, 0, this.commited.width, this.commited.height);
    for (const item of this.activePage()?.items ?? []) {
      this.paintItem(ctx, item, this.commited.width, this.commited.height);
    }
    this.blit();
  }

  /** Vuelca la capa confirmada y, encima, el trazo en curso. */
  private blit(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.commited, 0, 0);

    const trazo = this.trazo;
    if (trazo) {
      this.paintItem(ctx, this.itemFrom(trazo.points), canvas.width, canvas.height);
    }
  }

  private paintItem(
    ctx: CanvasRenderingContext2D,
    item: WhiteboardItem,
    ancho: number,
    alto: number,
  ): void {
    const px = (index: number) => item.points[index] * ancho;
    const py = (index: number) => item.points[index] * alto;
    const escala = ancho / REFERENCIA;

    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;
    ctx.lineWidth = Math.max(1, item.width * escala);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // El rotulador es el mismo trazo con transparencia y modo multiplicar: así
    // resalta lo de debajo en lugar de taparlo, que es para lo que sirve.
    if (item.tool === WhiteboardTool.Highlighter) {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'multiply';
      ctx.lineWidth = Math.max(1, item.width * escala * 2.5);
    }

    switch (item.tool) {
      case WhiteboardTool.Pen:
      case WhiteboardTool.Highlighter: {
        if (item.points.length < 4) break;
        ctx.beginPath();
        ctx.moveTo(px(0), py(1));
        // Curvas por el punto medio de cada par: suaviza el temblor del ratón
        // sin guardar más puntos de los que se capturaron.
        for (let i = 2; i < item.points.length - 2; i += 2) {
          const mx = (px(i) + px(i + 2)) / 2;
          const my = (py(i + 1) + py(i + 3)) / 2;
          ctx.quadraticCurveTo(px(i), py(i + 1), mx, my);
        }
        ctx.lineTo(px(item.points.length - 2), py(item.points.length - 1));
        ctx.stroke();
        break;
      }
      case WhiteboardTool.Line:
      case WhiteboardTool.Arrow: {
        if (item.points.length < 4) break;
        const [x1, y1, x2, y2] = [px(0), py(1), px(2), py(3)];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (item.tool === WhiteboardTool.Arrow) {
          const angulo = Math.atan2(y2 - y1, x2 - x1);
          const punta = Math.max(10, item.width * escala * 3);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - punta * Math.cos(angulo - Math.PI / 7),
            y2 - punta * Math.sin(angulo - Math.PI / 7),
          );
          ctx.lineTo(
            x2 - punta * Math.cos(angulo + Math.PI / 7),
            y2 - punta * Math.sin(angulo + Math.PI / 7),
          );
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case WhiteboardTool.Rectangle: {
        if (item.points.length < 4) break;
        const x = Math.min(px(0), px(2));
        const y = Math.min(py(1), py(3));
        const w = Math.abs(px(2) - px(0));
        const h = Math.abs(py(3) - py(1));
        if (item.filled) ctx.fillRect(x, y, w, h);
        else ctx.strokeRect(x, y, w, h);
        break;
      }
      case WhiteboardTool.Ellipse: {
        if (item.points.length < 4) break;
        const cx = (px(0) + px(2)) / 2;
        const cy = (py(1) + py(3)) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(px(2) - px(0)) / 2, Math.abs(py(3) - py(1)) / 2, 0, 0, Math.PI * 2);
        if (item.filled) ctx.fill();
        else ctx.stroke();
        break;
      }
      case WhiteboardTool.Text: {
        if (!item.text || item.points.length < 2) break;
        ctx.font = `600 ${(item.fontSize ?? 28) * escala}px var(--maya-font-body, system-ui), system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        item.text.split('\n').forEach((linea, indice) => {
          ctx.fillText(linea, px(0), py(1) + indice * (item.fontSize ?? 28) * escala * 1.25);
        });
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  /* ------------------------------- Puntero -------------------------------- */

  private posicion(event: PointerEvent): [number, number] {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return [0, 0];
    const rect = canvas.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.canDraw() || this.pointerId !== null) return;
    const punto = this.posicion(event);

    if (this.tool() === WhiteboardTool.Text) {
      this.textDraft.set({ x: punto[0], y: punto[1], value: '' });
      return;
    }
    if (this.tool() === WhiteboardTool.Eraser) {
      this.borrarEn(punto);
      this.pointerId = event.pointerId;
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      return;
    }

    this.pointerId = event.pointerId;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.trazo = { points: [...punto], start: punto };
    this.blit();
  }

  onPointerMove(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    const punto = this.posicion(event);

    if (this.tool() === WhiteboardTool.Eraser) {
      this.borrarEn(punto);
      return;
    }
    if (!this.trazo) return;

    const libre =
      this.tool() === WhiteboardTool.Pen || this.tool() === WhiteboardTool.Highlighter;
    if (libre) {
      // Se descartan los micromovimientos: recogerlos todos multiplica el
      // tamaño del trazo sin que se note en el dibujo.
      const ultimoX = this.trazo.points[this.trazo.points.length - 2];
      const ultimoY = this.trazo.points[this.trazo.points.length - 1];
      if (Math.hypot(punto[0] - ultimoX, punto[1] - ultimoY) < 0.002) return;
      this.trazo.points.push(...punto);
    } else {
      this.trazo.points = [...this.trazo.start, ...punto];
    }
    this.blit();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;

    const trazo = this.trazo;
    this.trazo = null;
    if (!trazo) return;

    // Un clic suelto con una figura no dibuja nada: sin esto, cada clic dejaría
    // un punto invisible en la pizarra de todo el mundo.
    if (trazo.points.length < 4) {
      this.blit();
      return;
    }
    this.emitAdd(this.itemFrom(trazo.points));
  }

  /* -------------------------------- Texto --------------------------------- */

  updateTextDraft(value: string): void {
    const draft = this.textDraft();
    if (draft) this.textDraft.set({ ...draft, value });
  }

  commitText(): void {
    const draft = this.textDraft();
    this.textDraft.set(null);
    if (!draft?.value.trim()) return;

    this.emitAdd({
      id: nuevoId(),
      tool: WhiteboardTool.Text,
      color: this.color(),
      width: this.width(),
      points: [draft.x, draft.y],
      text: draft.value.slice(0, 500),
      fontSize: this.fontSize(),
      authorId: this.authorId(),
      createdAt: Date.now(),
    });
  }

  cancelText(): void {
    this.textDraft.set(null);
  }

  /* ------------------------------ Operaciones ----------------------------- */

  private itemFrom(points: number[]): WhiteboardItem {
    return {
      id: nuevoId(),
      tool: this.tool(),
      color: this.color(),
      width: this.width(),
      points,
      filled: this.filled(),
      authorId: this.authorId(),
      createdAt: Date.now(),
    };
  }

  private emitAdd(item: WhiteboardItem): void {
    const pageId = this.activePage()?.id;
    if (!pageId) return;
    this.undoStack.update((list) => [...list, item].slice(-100));
    this.redoStack.set([]);
    this.operation.emit({ kind: 'add', pageId, item });
  }

  /** Borra lo que quede bajo el puntero, propio o ajeno. */
  private borrarEn(punto: [number, number]): void {
    const page = this.activePage();
    if (!page) return;

    const radio = (this.width() * 3) / REFERENCIA;
    const alcanzados = page.items
      .filter((item) => tocaPunto(item, punto, Math.max(radio, 0.012)))
      .map((item) => item.id);
    if (!alcanzados.length) return;

    const fuera = new Set(alcanzados);
    this.undoStack.update((list) => list.filter((item) => !fuera.has(item.id)));
    this.operation.emit({ kind: 'remove', pageId: page.id, itemIds: alcanzados });
  }

  undo(): void {
    const page = this.activePage();
    const pila = this.undoStack();
    if (!page || !pila.length) return;

    const item = pila[pila.length - 1];
    this.undoStack.set(pila.slice(0, -1));
    this.redoStack.update((list) => [...list, item]);
    this.operation.emit({ kind: 'remove', pageId: page.id, itemIds: [item.id] });
  }

  redo(): void {
    const page = this.activePage();
    const pila = this.redoStack();
    if (!page || !pila.length) return;

    const item = pila[pila.length - 1];
    this.redoStack.set(pila.slice(0, -1));
    this.undoStack.update((list) => [...list, item]);
    this.operation.emit({ kind: 'add', pageId: page.id, item });
  }

  clearPage(): void {
    const page = this.activePage();
    if (!page) return;
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.operation.emit({ kind: 'clear', pageId: page.id });
  }

  addPage(): void {
    this.operation.emit({
      kind: 'page-add',
      page: { id: nuevoId(), name: `Página ${this.pages().length + 1}`, items: [] },
    });
  }

  removePage(): void {
    const page = this.activePage();
    if (!page || this.pages().length <= 1) return;
    this.operation.emit({ kind: 'page-remove', pageId: page.id });
  }

  selectPage(pageId: string): void {
    this.operation.emit({ kind: 'page-select', pageId });
  }

  /** Descarga la página actual como imagen, con fondo blanco. */
  exportPng(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    const salida = document.createElement('canvas');
    salida.width = canvas.width;
    salida.height = canvas.height;
    const ctx = salida.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, salida.width, salida.height);
    ctx.drawImage(canvas, 0, 0);

    salida.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `pizarra-${this.activePage()?.name ?? 'maya'}.png`.replace(/\s+/g, '-').toLowerCase();
      enlace.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}

const nuevoId = (): string =>
  `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** ¿Pasa la figura lo bastante cerca del punto como para borrarla? */
function tocaPunto(item: WhiteboardItem, [x, y]: [number, number], radio: number): boolean {
  if (item.tool === WhiteboardTool.Text) {
    // El texto crece a la derecha y hacia abajo desde su ancla; se aproxima con
    // una caja generosa porque medirlo exigiría un contexto de dibujo.
    const alto = ((item.fontSize ?? 28) / REFERENCIA) * 1.4;
    const ancho = Math.min(0.6, ((item.text?.length ?? 0) * (item.fontSize ?? 28) * 0.55) / REFERENCIA);
    return x >= item.points[0] - radio && x <= item.points[0] + ancho && y >= item.points[1] - radio && y <= item.points[1] + alto;
  }
  for (let i = 0; i < item.points.length - 1; i += 2) {
    if (Math.hypot(item.points[i] - x, item.points[i + 1] - y) <= radio) return true;
  }
  // Las figuras de dos puntos se comprueban también por su contorno, o solo
  // se borrarían acertando en una esquina.
  if (item.points.length === 4) {
    const [x1, y1, x2, y2] = item.points;
    const dentroX = x >= Math.min(x1, x2) - radio && x <= Math.max(x1, x2) + radio;
    const dentroY = y >= Math.min(y1, y2) - radio && y <= Math.max(y1, y2) + radio;
    if (!dentroX || !dentroY) return false;
    if (item.tool === WhiteboardTool.Line || item.tool === WhiteboardTool.Arrow) {
      return distanciaASegmento(x, y, x1, y1, x2, y2) <= radio;
    }
    return true;
  }
  return false;
}

function distanciaASegmento(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const largo = dx * dx + dy * dy;
  if (!largo) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / largo));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
