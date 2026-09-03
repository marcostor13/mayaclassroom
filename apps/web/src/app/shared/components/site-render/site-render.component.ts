import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DEFAULT_SECTION_STYLE, SiteSectionType, SiteTemplate, formatMoney } from '@maya/shared';
import type {
  PublicCourseDto,
  PublicCurriculumSection,
  PublicPaymentMethod,
  PublicSiteDto,
  SiteContact,
  SiteSection,
  SiteSectionStyle,
} from '@maya/shared';
import { IconComponent } from '../icon.component';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { SafeResourcePipe } from '../../pipes/safe-resource.pipe';
import { resolveVideo } from '../../utils/embed';
import type { VideoResuelto } from '../../utils/embed';

/** Todo lo que hace falta para pintar una página, venga de donde venga. */
export interface SiteRenderData {
  tenant: PublicSiteDto['tenant'];
  template: SiteTemplate;
  contact: SiteContact;
  courses: PublicCourseDto[];
  categories: { id: string; name: string; courseCount: number }[];
  /** Curso cuando lo que se pinta es su página de venta. */
  course?: PublicCourseDto | null;
  curriculum?: PublicCurriculumSection[];
  paymentMethods?: PublicPaymentMethod[];
}

/** Icono de cada tipo de material del temario. */
const ICONO_MODULO: Record<string, string> = {
  page: 'file-text',
  resource: 'file',
  quiz: 'help-circle',
  assign: 'clipboard-list',
  forum: 'message-square',
  choice: 'list-checks',
  feedback: 'star',
  folder: 'folder',
  url: 'link',
};

/**
 * Pinta una página compuesta por secciones.
 *
 * Existe una sola implementación y la usan los tres sitios donde esa página
 * aparece: el escaparate público, la ficha de venta de un curso y el editor.
 * Es lo que hace que el editor sea de verdad una **vista de visualización**:
 * no enseña una aproximación de la página, enseña exactamente el mismo
 * componente que verá el visitante, con los mismos estilos.
 *
 * En modo edición añade por encima los controles de cada bloque —seleccionar,
 * mover, ocultar, duplicar, borrar— sin tocar el marcado de la página, de modo
 * que lo que se ve sigue siendo lo que se publica.
 */
@Component({
  selector: 'maya-site-render',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SafeHtmlPipe, SafeResourcePipe],
  templateUrl: './site-render.component.html',
  styleUrl: './site-render.component.scss',
})
export class SiteRenderComponent {
  readonly data = input.required<SiteRenderData>();
  readonly sections = input.required<SiteSection[]>();

  /** Cabecera y pie de la página. Se apagan al pintar una previsualización suelta. */
  readonly chrome = input(true);

  /** En edición se pintan también las secciones desactivadas, atenuadas. */
  readonly editable = input(false);
  readonly selectedId = input<string | null>(null);

  readonly courseOpen = output<PublicCourseDto>();
  /** Pulsación en cualquier botón de compra de la ficha de un curso. */
  readonly buy = output<void>();
  readonly categoryFilter = output<string>();

  readonly sectionSelect = output<string>();
  readonly sectionMove = output<{ id: string; delta: -1 | 1 }>();
  readonly sectionToggle = output<string>();
  readonly sectionDuplicate = output<string>();
  readonly sectionRemove = output<string>();
  /** Añadir un bloque detrás del indicado; `null` significa al final. */
  readonly sectionAdd = output<string | null>();

  /** Categoría por la que se filtra el catálogo; vacío es «todas». */
  readonly activeCategory = input('');

  readonly Tipo = SiteSectionType;
  readonly anio = new Date().getFullYear();

  /** Las secciones que llegan a pintarse: fuera de edición, solo las activas. */
  readonly visibles = computed(() =>
    this.editable() ? this.sections() : this.sections().filter((s) => s.enabled),
  );

  readonly cursosFiltrados = computed(() => {
    const courses = this.data().courses;
    const category = this.activeCategory();
    return category ? courses.filter((course) => course.categoryId === category) : courses;
  });

  estilo(section: SiteSection): SiteSectionStyle {
    return { ...DEFAULT_SECTION_STYLE, ...(section.style ?? {}) };
  }

  clases(section: SiteSection): string {
    const s = this.estilo(section);
    return [
      'seccion',
      `seccion--${s.background}`,
      `seccion--esp-${s.spacing}`,
      `seccion--${s.align}`,
      `seccion--col-${s.columns}`,
      section.enabled ? '' : 'seccion--oculta',
      this.selectedId() === section.id ? 'seccion--activa' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Imagen de fondo, solo cuando el estilo la pide y existe. */
  fondo(section: SiteSection): string | null {
    const s = this.estilo(section);
    return s.background === 'image' && section.imageUrl ? `url("${section.imageUrl}")` : null;
  }

  cursosDe(section: SiteSection): PublicCourseDto[] {
    const courses = this.cursosFiltrados();
    return section.limit ? courses.slice(0, section.limit) : courses;
  }

  /**
   * Resuelve el vídeo de una sección.
   *
   * Devuelve cómo hay que pintarlo —marco de YouTube o Vimeo, o el
   * reproductor del navegador para un fichero suelto— y no solo la dirección,
   * porque un `.mp4` metido en un `iframe` se ve como el visor pelado del
   * navegador dentro de la página.
   */
  video(url: string | null | undefined): VideoResuelto | null {
    return resolveVideo(url);
  }

  iconoModulo(type: string): string {
    return ICONO_MODULO[type] ?? 'file-text';
  }

  precio(course: PublicCourseDto): string {
    if (course.catalog.priceCents <= 0) return 'Gratis';
    return this.formatear(course.catalog.priceCents, course.catalog.currency);
  }

  precioAntes(course: PublicCourseDto): string | null {
    const antes = course.catalog.compareAtPriceCents ?? 0;
    if (antes <= course.catalog.priceCents) return null;
    return this.formatear(antes, course.catalog.currency);
  }

  descuento(course: PublicCourseDto): number | null {
    const antes = course.catalog.compareAtPriceCents ?? 0;
    if (antes <= course.catalog.priceCents || antes <= 0) return null;
    return Math.round((1 - course.catalog.priceCents / antes) * 100);
  }

  private formatear(cents: number, currency: string): string {
    return formatMoney(cents, currency);
  }

  /** Las viñetas de «lo que aprenderás», que alimentan la sección de ventajas. */
  ventajas(section: SiteSection): { title: string; body: string | null; icon: string | null }[] {
    if (section.items?.length) {
      return section.items.map((item) => ({
        title: item.title,
        body: item.body ?? null,
        icon: item.icon ?? null,
      }));
    }
    // En la ficha de un curso la sección se rellena sola con sus viñetas: es
    // el dato que ya tiene el curso y repetirlo a mano sería trabajo perdido.
    return (this.data().course?.catalog.highlights ?? []).map((title) => ({
      title,
      body: null,
      icon: 'check',
    }));
  }

  /** Estrellas enteras de la valoración, para pintarlas. */
  estrellas(nota: number | null | undefined): number[] {
    return Array.from({ length: 5 }, (_, i) => (i < Math.round(nota ?? 0) ? 1 : 0));
  }

  onSectionClick(section: SiteSection, event: Event): void {
    if (!this.editable()) return;
    // En edición, la página no navega: pulsar es elegir el bloque que se edita.
    event.preventDefault();
    event.stopPropagation();
    this.sectionSelect.emit(section.id);
  }

  onCourseClick(course: PublicCourseDto, event: Event): void {
    event.preventDefault();
    if (this.editable()) return;
    this.courseOpen.emit(course);
  }

  onBuy(event: Event): void {
    event.preventDefault();
    if (this.editable()) return;
    this.buy.emit();
  }

  /** «Mercado Pago y PayPal»: la lista en prosa, no separada por comas secas. */
  formaDePagoTexto(): string {
    const nombres = (this.data().paymentMethods ?? []).map((method) => method.label);
    if (nombres.length <= 1) return nombres[0] ?? '';
    return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  }

  /** Un ancla dentro de la propia página no debe navegar en el editor. */
  href(url: string | null | undefined): string {
    return this.editable() ? '#' : (url ?? '#');
  }
}
