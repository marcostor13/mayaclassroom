import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';

const SIDEBAR_KEY = 'maya.sidebar';

/**
 * Frontera entre la experiencia de app (cajón + barra inferior) y la de
 * escritorio (barra lateral fija). Debe coincidir con `$maya-bp-app` de
 * `_tokens.scss`: si divergen, quedan resoluciones sin barra inferior *ni*
 * barra lateral visible.
 */
const DESKTOP_QUERY = '(min-width: 1024px)';

/** Estado del armazón de la interfaz: barra lateral, cajón móvil y hojas. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);

  private readonly collapsedSignal = signal(localStorage.getItem(SIDEBAR_KEY) === 'collapsed');
  private readonly mobileOpenSignal = signal(false);
  private readonly moreSheetSignal = signal(false);
  private readonly desktopSignal = signal(false);

  readonly sidebarCollapsed = this.collapsedSignal.asReadonly();
  readonly mobileMenuOpen = this.mobileOpenSignal.asReadonly();
  readonly moreSheetOpen = this.moreSheetSignal.asReadonly();
  /** Verdadero a partir de `DESKTOP_QUERY`. */
  readonly isDesktop = this.desktopSignal.asReadonly();

  /** Hay algo superpuesto que debe congelar el desplazamiento del documento. */
  private readonly overlayOpen = computed(() => this.mobileOpenSignal() || this.moreSheetSignal());

  /** Posición de desplazamiento congelada, para restaurarla al cerrar. */
  private lockedScrollY = 0;

  constructor() {
    const media = window.matchMedia(DESKTOP_QUERY);
    this.desktopSignal.set(media.matches);
    media.addEventListener('change', (event) => {
      this.desktopSignal.set(event.matches);
      // Al pasar a escritorio la barra lateral es permanente: un cajón
      // abierto se quedaría flotando sobre ella.
      if (event.matches) {
        this.mobileOpenSignal.set(false);
        this.moreSheetSignal.set(false);
      }
    });

    effect(() => this.applyScrollLock(this.overlayOpen()));
  }

  toggleSidebar(): void {
    const next = !this.collapsedSignal();
    this.collapsedSignal.set(next);
    localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
  }

  openMobileMenu(): void {
    this.moreSheetSignal.set(false);
    this.mobileOpenSignal.set(true);
  }

  closeMobileMenu(): void {
    this.mobileOpenSignal.set(false);
  }

  toggleMobileMenu(): void {
    if (this.mobileOpenSignal()) this.closeMobileMenu();
    else this.openMobileMenu();
  }

  openMoreSheet(): void {
    this.mobileOpenSignal.set(false);
    this.moreSheetSignal.set(true);
  }

  closeMoreSheet(): void {
    this.moreSheetSignal.set(false);
  }

  /** Cierra cualquier capa superpuesta (Escape, navegación, toque en el velo). */
  closeOverlays(): void {
    this.mobileOpenSignal.set(false);
    this.moreSheetSignal.set(false);
  }

  /**
   * Congela el desplazamiento del documento mientras hay una capa abierta.
   * `position: fixed` sobre `body` es lo único que detiene el arrastre de
   * fondo en Safari de iOS, pero salta al principio de la página: por eso se
   * guarda la posición y se restaura al liberar.
   */
  private applyScrollLock(locked: boolean): void {
    const body = this.document.body;
    if (locked) {
      if (body.classList.contains('maya-locked')) return;
      this.lockedScrollY = window.scrollY;
      body.style.top = `-${this.lockedScrollY}px`;
      body.classList.add('maya-locked');
    } else {
      if (!body.classList.contains('maya-locked')) return;
      body.classList.remove('maya-locked');
      body.style.top = '';
      window.scrollTo({ top: this.lockedScrollY, behavior: 'instant' as ScrollBehavior });
    }
  }
}
