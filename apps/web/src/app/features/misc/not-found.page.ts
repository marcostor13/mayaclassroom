import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared';

@Component({
  selector: 'maya-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="maya-empty" style="min-height: 60vh">
      <div class="maya-empty__icon"><maya-icon name="search" [size]="34" /></div>
      <p style="font-family: var(--maya-font-heading); font-size: var(--maya-text-4xl); font-weight: 800; color: var(--maya-primary)">
        404
      </p>
      <p class="maya-empty__title">No hemos encontrado esta página</p>
      <p class="maya-small maya-muted">
        Puede que el enlace haya cambiado o que ya no tenga acceso a este contenido.
      </p>
      <a routerLink="/dashboard" class="maya-btn maya-btn--primary" style="margin-top: var(--maya-space-4)">
        <maya-icon name="home" [size]="16" /> Volver al panel
      </a>
    </div>
  `,
})
export class NotFoundPage {}
