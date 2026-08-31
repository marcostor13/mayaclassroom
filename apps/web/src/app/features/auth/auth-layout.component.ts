import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent, ToastContainerComponent } from '../../shared';

/** Marco visual de las pantallas de acceso: panel de marca + formulario. */
@Component({
  selector: 'maya-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, IconComponent, ToastContainerComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  readonly theme = inject(ThemeService);

  readonly highlights = [
    {
      icon: 'layers',
      title: 'Multiempresa de verdad',
      text: 'Cada organización con su marca, sus roles y su alumnado, totalmente aislados.',
    },
    {
      icon: 'shield',
      title: 'Permisos al detalle',
      text: 'Modelo de capacidades por contexto heredado de Moodle: sistema, categoría, curso y actividad.',
    },
    {
      icon: 'sparkles',
      title: 'Diseño que acompaña',
      text: 'Interfaz elegante y responsive pensada primero para el móvil.',
    },
  ];
}
