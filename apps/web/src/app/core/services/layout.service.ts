import { Injectable, signal } from '@angular/core';

const SIDEBAR_KEY = 'maya.sidebar';

/** Estado del armazón de la interfaz: barra lateral y menú móvil. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly collapsedSignal = signal(localStorage.getItem(SIDEBAR_KEY) === 'collapsed');
  private readonly mobileOpenSignal = signal(false);

  readonly sidebarCollapsed = this.collapsedSignal.asReadonly();
  readonly mobileMenuOpen = this.mobileOpenSignal.asReadonly();

  toggleSidebar(): void {
    const next = !this.collapsedSignal();
    this.collapsedSignal.set(next);
    localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded');
  }

  openMobileMenu(): void {
    this.mobileOpenSignal.set(true);
  }

  closeMobileMenu(): void {
    this.mobileOpenSignal.set(false);
  }

  toggleMobileMenu(): void {
    this.mobileOpenSignal.update((open) => !open);
  }
}
