import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GuidesService } from '../../../core/services/guides.service';
import { GuideTourComponent } from '../guide-tour/guide-tour.component';

/**
 * Enchufa el recorrido guiado al armazón de la aplicación.
 *
 * Vive en el armazón y no en cada pantalla porque una guía cruza varias: si
 * cada página montara el suyo, el recorrido se desmontaría al navegar y habría
 * que empezar de nuevo en cada paso.
 */
@Component({
  selector: 'maya-guide-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GuideTourComponent],
  template: `
    @if (guides.active(); as guide) {
      <maya-guide-tour
        [title]="guide.title"
        [steps]="guide.steps"
        [index]="guides.step()"
        (next)="guides.next()"
        (prev)="guides.prev()"
        (close)="guides.close()"
      />
    }
  `,
})
export class GuideHostComponent {
  readonly guides = inject(GuidesService);
}
