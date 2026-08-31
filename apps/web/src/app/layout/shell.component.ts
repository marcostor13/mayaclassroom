import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CommunicationService } from '../core/services/communication.service';
import { LayoutService } from '../core/services/layout.service';
import { ThemeService } from '../core/services/theme.service';
import { AvatarComponent, IconComponent, ToastContainerComponent } from '../shared';
import { NAV_ITEMS, NavItem } from './nav-items';

/**
 * Armazón de la aplicación: barra superior, menú lateral colapsable y
 * navegación inferior en móvil. Mobile-first y accesible con teclado.
 */
@Component({
  selector: 'maya-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    IconComponent,
    AvatarComponent,
    ToastContainerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly layout = inject(LayoutService);
  readonly theme = inject(ThemeService);
  readonly comms = inject(CommunicationService);

  readonly user = this.auth.user;
  readonly collapsed = this.layout.sidebarCollapsed;
  readonly mobileOpen = this.layout.mobileMenuOpen;

  /** Elementos de menú visibles según las capacidades del usuario. */
  readonly navigation = computed(() => {
    const visible = NAV_ITEMS.filter(
      (item) => !item.capabilities?.length || this.auth.canAny(item.capabilities),
    );
    const groups: { name: NavItem['group']; items: NavItem[] }[] = [];
    for (const item of visible) {
      let group = groups.find((g) => g.name === item.group);
      if (!group) {
        group = { name: item.group, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  });

  readonly mobileNav = computed(() =>
    NAV_ITEMS.filter((item) => item.mobile).slice(0, 4),
  );

  readonly themeIcon = computed(() => (this.theme.resolved() === 'dark' ? 'sun' : 'moon'));

  constructor() {
    this.comms.refreshUnreadCounts();
  }

  logout(): void {
    this.auth.logout();
  }
}
