import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DEFAULT_SECTION_STYLE, SiteSectionType } from '@maya/shared';
import type { SiteSection, SiteSectionItem, SiteSectionStyle } from '@maya/shared';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { LayoutService } from '../../../../core/services/layout.service';
import {
  IconComponent,
  ImageUploadComponent,
  RichEditorComponent,
  SiteRenderComponent,
} from '../../../../shared';
import type { SiteRenderData } from '../../../../shared';
import { toEmbedUrl } from '../../../../shared';
import {
  BLOQUES,
  ICONOS_BLOQUE,
  definicion,
  nuevaSeccion,
  nuevoElemento,
} from './section-catalog';
import type { DefinicionBloque } from './section-catalog';

/** Anchuras del lienzo. Son las tres que de verdad cambian una maqueta. */
export const DISPOSITIVOS = [
  { id: 'movil', label: 'Móvil', icon: 'phone', ancho: 390 },
  { id: 'tableta', label: 'Tableta', icon: 'template', ancho: 834 },
  { id: 'escritorio', label: 'Escritorio', icon: 'sliders', ancho: 0 },
] as const;

export type Dispositivo = (typeof DISPOSITIVOS)[number]['id'];

/**
 * Constructor visual de páginas.
 *
 * Hay **una sola vista**: la página tal como se publica. No existe un modo
 * «previsualizar» separado porque un formulario y una vista previa siempre
 * acaban divergiendo, y con dos vistas hay que aprender la correspondencia
 * entre una y otra antes de poder cambiar nada.
 *
 * Aquí se pulsa sobre el bloque que se quiere cambiar y sus ajustes aparecen
 * al lado —o abajo, en móvil—. El lienzo es el mismo `maya-site-render` que
 * usa la página pública, con lo que lo que se ve es literalmente lo que se
 * publica, incluida la anchura: el marco de dispositivo funciona con consultas
 * de contenedor, así que a 390 px se comporta como un móvil de verdad.
 */
@Component({
  selector: 'maya-page-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    ImageUploadComponent,
    RichEditorComponent,
    SiteRenderComponent,
  ],
  templateUrl: './page-builder.component.html',
  styleUrl: './page-builder.component.scss',
})
export class PageBuilderComponent {
  private readonly confirm = inject(ConfirmService);
  private readonly layout = inject(LayoutService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly sections = model.required<SiteSection[]>();
  readonly data = input.required<SiteRenderData>();
  /** `true` cuando se diseña la ficha de un curso, no la página de la empresa. */
  readonly forCourse = input(false);

  readonly sectionsChanged = output<void>();

  readonly Tipo = SiteSectionType;
  readonly dispositivos = DISPOSITIVOS;
  readonly iconos = ICONOS_BLOQUE;

  readonly dispositivo = signal<Dispositivo>('escritorio');
  readonly selectedId = signal<string | null>(null);
  readonly paletaAbierta = signal(false);
  readonly categoria = signal('');

  /** Dónde insertar el bloque que se elija en la paleta. */
  private insertarTras: string | null = null;

  readonly anchoLienzo = computed(
    () => DISPOSITIVOS.find((d) => d.id === this.dispositivo())?.ancho ?? 0,
  );

  readonly seleccionada = computed(
    () => this.sections().find((section) => section.id === this.selectedId()) ?? null,
  );

  readonly definicionActual = computed(() => {
    const section = this.seleccionada();
    return section ? definicion(section.type) : null;
  });

  /** Los bloques que tiene sentido ofrecer en esta página. */
  readonly paleta = computed<DefinicionBloque[]>(() =>
    BLOQUES.filter((bloque) =>
      this.forCourse() ? !bloque.soloEmpresa : !bloque.soloCurso,
    ),
  );

  readonly fondos = [
    { id: 'plain', label: 'Liso' },
    { id: 'soft', label: 'Suave' },
    { id: 'brand', label: 'Marca' },
    { id: 'dark', label: 'Oscuro' },
    { id: 'image', label: 'Imagen' },
  ] as const;

  readonly aires = [
    { id: 'compact', label: 'Poco' },
    { id: 'normal', label: 'Normal' },
    { id: 'roomy', label: 'Mucho' },
  ] as const;

  /* ------------------------------ Utilidades ------------------------------ */

  etiqueta(section: SiteSection): string {
    return definicion(section.type).label;
  }

  usa(campo: string): boolean {
    return this.definicionActual()?.campos.includes(campo as never) ?? false;
  }

  usaEnElemento(campo: string): boolean {
    return this.definicionActual()?.elemento?.campos.includes(campo as never) ?? false;
  }

  estilo(section: SiteSection): SiteSectionStyle {
    return { ...DEFAULT_SECTION_STYLE, ...(section.style ?? {}) };
  }

  /* ------------------------------- Selección ------------------------------ */

  seleccionar(id: string): void {
    const abriendo = this.selectedId() !== id;
    this.selectedId.set(abriendo ? id : null);

    // En móvil los ajustes suben desde abajo y tapan media pantalla; si el
    // bloque elegido estaba en esa mitad, deja de verse justo cuando se
    // empieza a editarlo. Se sube a la parte de arriba, que es la que queda
    // libre. En escritorio no hace falta: el panel va al lado.
    if (abriendo && !this.layout.isDesktop()) {
      queueMicrotask(() =>
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
      return;
    }

    // En escritorio el panel se queda pegado bajo la barra de la aplicación,
    // pero si la página aún está arriba del todo arranca en su sitio natural,
    // más abajo, y el pie —«Ocultar bloque», «Eliminar»— queda fuera de la
    // pantalla. Se sube el constructor a su posición pegada para que el panel
    // se vea entero desde el primer momento.
    if (abriendo) queueMicrotask(() => this.encuadrarConstructor());
  }

  /** Deja el constructor justo debajo de la barra de la aplicación. */
  private encuadrarConstructor(): void {
    const raiz = this.host.nativeElement.querySelector<HTMLElement>('.constructor');
    const barra = raiz?.querySelector<HTMLElement>('.lienzo__barra');
    if (!raiz || !barra) return;

    // La barra del lienzo se pega a la misma altura que el panel, así que su
    // `top` resuelto en píxeles es exactamente el hueco que deja la barra de
    // la aplicación. Leerlo de ahí evita repetir el cálculo del CSS.
    const destino = Number.parseFloat(getComputedStyle(barra).top) || 0;
    const { top } = raiz.getBoundingClientRect();

    // Solo hacia abajo: si ya está encuadrado, o el usuario está más abajo, no
    // se le mueve la vista.
    if (top > destino + 1) window.scrollBy({ top: top - destino, behavior: 'smooth' });
  }

  cerrarInspector(): void {
    this.selectedId.set(null);
  }

  /* ------------------------------- Estructura ----------------------------- */

  private aplicar(cambio: (lista: SiteSection[]) => SiteSection[]): void {
    this.sections.update(cambio);
    this.sectionsChanged.emit();
  }

  private reemplazar(actualizada: SiteSection): void {
    this.aplicar((lista) =>
      lista.map((section) => (section.id === actualizada.id ? actualizada : section)),
    );
  }

  /**
   * Sube o baja un bloque.
   *
   * Con botones y no arrastrando: funciona con el teclado, y arrastrar un
   * bloque que ocupa toda la pantalla es incómodo justo donde más falta hace,
   * que es en el móvil.
   */
  mover(evento: { id: string; delta: -1 | 1 }): void {
    this.aplicar((lista) => {
      const from = lista.findIndex((section) => section.id === evento.id);
      const to = from + evento.delta;
      if (from < 0 || to < 0 || to >= lista.length) return lista;
      const copia = [...lista];
      [copia[from], copia[to]] = [copia[to], copia[from]];
      return copia;
    });
  }

  alternar(id: string): void {
    this.aplicar((lista) =>
      lista.map((section) =>
        section.id === id ? { ...section, enabled: !section.enabled } : section,
      ),
    );
  }

  duplicar(id: string): void {
    this.aplicar((lista) => {
      const i = lista.findIndex((section) => section.id === id);
      if (i < 0) return lista;
      const existentes = lista.map((section) => section.id);
      const copia: SiteSection = {
        ...lista[i],
        id: this.idLibre(lista[i].id, existentes),
        items: (lista[i].items ?? []).map((item) => ({ ...item })),
        style: { ...this.estilo(lista[i]) },
      };
      return [...lista.slice(0, i + 1), copia, ...lista.slice(i + 1)];
    });
  }

  private idLibre(base: string, existentes: string[]): string {
    let n = 2;
    while (existentes.includes(`${base}-${n}`)) n += 1;
    return `${base}-${n}`;
  }

  eliminar(id: string): void {
    const section = this.sections().find((item) => item.id === id);
    this.confirm
      .ask({
        title: 'Eliminar el bloque',
        message: `Se quitará «${section ? this.etiqueta(section) : 'el bloque'}» de la página. Puede volver a añadirlo después.`,
        confirmLabel: 'Eliminar',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        if (this.selectedId() === id) this.selectedId.set(null);
        this.aplicar((lista) => lista.filter((item) => item.id !== id));
      });
  }

  abrirPaleta(trasId: string | null): void {
    this.insertarTras = trasId;
    this.paletaAbierta.set(true);
  }

  anadir(type: SiteSectionType): void {
    const existentes = this.sections().map((section) => section.id);
    const nueva = nuevaSeccion(type, existentes);
    const tras = this.insertarTras;

    this.aplicar((lista) => {
      if (!tras) return [...lista, nueva];
      const i = lista.findIndex((section) => section.id === tras);
      if (i < 0) return [...lista, nueva];
      return [...lista.slice(0, i + 1), nueva, ...lista.slice(i + 1)];
    });

    this.paletaAbierta.set(false);
    this.selectedId.set(nueva.id);
    // Se lleva a la vista: recién insertada puede quedar fuera de pantalla y
    // parecería que el botón no hizo nada.
    queueMicrotask(() =>
      document.getElementById(nueva.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  /* -------------------------------- Contenido ----------------------------- */

  editar(campo: keyof SiteSection, valor: string | number | null): void {
    const section = this.seleccionada();
    if (!section) return;
    this.reemplazar({ ...section, [campo]: valor === '' ? null : valor });
  }

  /**
   * Guarda un enlace de vídeo ya convertido al formato que se puede incrustar.
   *
   * Se traduce al escribirlo y no al pintarlo para que el propio editor enseñe
   * al momento si el enlace vale: si no se reconoce, el campo se queda vacío y
   * el aviso aparece justo debajo.
   */
  editarVideo(valor: string): void {
    const section = this.seleccionada();
    if (!section) return;
    this.reemplazar({ ...section, videoUrl: toEmbedUrl(valor) });
  }

  editarEstilo(campo: keyof SiteSectionStyle, valor: string | number): void {
    const section = this.seleccionada();
    if (!section) return;
    this.reemplazar({
      ...section,
      style: { ...this.estilo(section), [campo]: valor } as SiteSectionStyle,
    });
  }

  editarImagen(url: string | null): void {
    this.editar('imageUrl', url);
  }

  /* -------------------------------- Elementos ----------------------------- */

  anadirElemento(): void {
    const section = this.seleccionada();
    const def = this.definicionActual();
    if (!section || !def) return;
    this.reemplazar({ ...section, items: [...(section.items ?? []), nuevoElemento(def)] });
  }

  editarElemento(indice: number, campo: keyof SiteSectionItem, valor: string): void {
    const section = this.seleccionada();
    if (!section) return;
    const items = [...(section.items ?? [])];
    items[indice] = { ...items[indice], [campo]: valor || null };
    this.reemplazar({ ...section, items });
  }

  moverElemento(indice: number, delta: -1 | 1): void {
    const section = this.seleccionada();
    if (!section) return;
    const items = [...(section.items ?? [])];
    const destino = indice + delta;
    if (destino < 0 || destino >= items.length) return;
    [items[indice], items[destino]] = [items[destino], items[indice]];
    this.reemplazar({ ...section, items });
  }

  quitarElemento(indice: number): void {
    const section = this.seleccionada();
    if (!section) return;
    this.reemplazar({
      ...section,
      items: (section.items ?? []).filter((_, i) => i !== indice),
    });
  }
}
