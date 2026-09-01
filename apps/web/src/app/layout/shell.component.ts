import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { CommunicationService } from '../core/services/communication.service';
import { LayoutService } from '../core/services/layout.service';
import { ThemeService } from '../core/services/theme.service';
import {
  AvatarComponent,
  ConfirmHostComponent,
  GlobalSearchComponent,
  IconComponent,
  LogoComponent,
  ToastContainerComponent,
} from '../shared';
import { NAV_GROUPS, NAV_ITEMS, NavItem } from './nav-items';

/** Ranuras de la barra inferior reservadas a rutas; la quinta es «Más». */
const BOTTOM_NAV_SLOTS = 4;

/**
 * Armazón de la aplicación.
 *
 * En móvil y tableta se comporta como una app: barra inferior con cinco
 * ranuras, cajón lateral deslizante y hoja «Más». A partir de `lg` la barra
 * lateral pasa a ser fija y desaparece el cromo móvil. La frontera la decide
 * `LayoutService.isDesktop`, de modo que la plantilla y el CSS conmutan a la
 * vez.
 */
@Component({
  selector: 'maya-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    LogoComponent,
    AvatarComponent,
    GlobalSearchComponent,
    ToastContainerComponent,
    ConfirmHostComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  host: {
    // Escape cierra la capa superpuesta que esté abierta, como en cualquier
    // diálogo modal.
    '(document:keydown.escape)': 'layout.closeOverlays()',
  },
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly layout = inject(LayoutService);
  readonly theme = inject(ThemeService);
  readonly comms = inject(CommunicationService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly collapsed = this.layout.sidebarCollapsed;
  readonly mobileOpen = this.layout.mobileMenuOpen;
  readonly moreOpen = this.layout.moreSheetOpen;
  readonly isDesktop = this.layout.isDesktop;

  /** URL actual, para marcar el elemento activo también en la hoja «Más». */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Elementos de menú visibles según las capacidades del usuario. */
  private readonly visibleItems = computed(() =>
    NAV_ITEMS.filter((item) => {
      // `platformAdmin` no se cubre con capacidades: los endpoints de ámbito
      // plataforma se protegen con el indicador del usuario, no con el RBAC
      // por contexto, y `canAny` daría verdadero a cualquier gestor.
      if (item.platformAdmin && !this.auth.isPlatformAdmin()) return false;
      return !item.capabilities?.length || this.auth.canAny(item.capabilities);
    }),
  );

  /** Elementos agrupados por sección, en el orden declarado. */
  readonly navigation = computed(() => {
    const items = this.visibleItems();
    return NAV_GROUPS.map((name) => ({
      name,
      items: items.filter((item) => item.group === name),
    })).filter((group) => group.items.length > 0);
  });

  /** Las cuatro rutas que ocupan la barra inferior. */
  readonly bottomNav = computed(() =>
    this.visibleItems()
      .filter((item) => item.mobile)
      .slice(0, BOTTOM_NAV_SLOTS),
  );

  /** Todo lo que no cupo en la barra inferior, agrupado para la hoja «Más». */
  readonly moreNavigation = computed(() => {
    const inBottomNav = new Set(this.bottomNav().map((item) => item.route));
    const rest = this.visibleItems().filter((item) => !inBottomNav.has(item.route));
    return NAV_GROUPS.map((name) => ({
      name,
      items: rest.filter((item) => item.group === name),
    })).filter((group) => group.items.length > 0);
  });

  /** La ranura «Más» se ilumina cuando la ruta activa vive dentro de la hoja. */
  readonly moreIsActive = computed(() => {
    if (this.moreOpen()) return true;
    const url = this.currentUrl();
    return this.moreNavigation().some((group) =>
      group.items.some((item) => this.matches(item, url)),
    );
  });

  readonly themeIcon = computed(() => (this.theme.resolved() === 'dark' ? 'sun' : 'moon'));

  constructor() {
    this.comms.refreshUnreadCounts();

    // Navegar siempre cierra el cajón y la hoja: sin esto, al volver atrás con
    // el gesto del sistema la capa quedaba abierta sobre la pantalla nueva.
    effect(() => {
      this.currentUrl();
      this.layout.closeOverlays();
    });
  }

  /** Contador sin leer asociado a una ruta, si lo tiene. */
  badgeFor(route: string): number {
    if (route === '/notifications') return this.comms.unreadNotifications();
    if (route === '/messages') return this.comms.unreadMessages();
    return 0;
  }

  /** Etiqueta corta si existe; si no, la larga. */
  shortLabel(item: NavItem): string {
    return item.shortLabel ?? item.label;
  }

  /** ¿Es esta la ruta activa? Réplica de `routerLinkActiveOptions`. */
  private matches(item: NavItem, url: string): boolean {
    const path = url.split(/[?#]/)[0];
    return item.exact ? path === item.route : path.startsWith(item.route);
  }

  isActive(item: NavItem): boolean {
    return this.matches(item, this.currentUrl());
  }

  logout(): void {
    this.auth.logout();
  }
}
