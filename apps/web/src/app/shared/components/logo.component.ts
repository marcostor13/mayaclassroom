import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Contador de instancias: cada marca necesita un `id` de degradado propio. */
let uid = 0;

/**
 * Marca de Maya Classroom.
 *
 * El símbolo es una «M» geométrica de trazo continuo —dos astas y un valle
 * central— sobre un cuadrado redondeado, rematada por un punto bajo el valle.
 * Se dibuja con `currentColor` y `var(--maya-primary)` para que la
 * personalización de marca por empresa lo tiña sin tocar el SVG.
 */
@Component({
  selector: 'maya-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="logo__mark" [style.--logo-size.px]="size()">
      <svg viewBox="0 0 64 64" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
        <defs>
          <linearGradient [attr.id]="sheenId" x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="0" stop-color="#fff" stop-opacity="0.34" />
            <stop offset="0.55" stop-color="#fff" stop-opacity="0.06" />
            <stop offset="1" stop-color="#000" stop-opacity="0.1" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="19" fill="var(--maya-primary)" />
        <rect width="64" height="64" rx="19" [attr.fill]="sheenUrl" />
        <path
          d="M18 46V25.4a2.9 2.9 0 0 1 5.15-1.83L32 34.6l8.85-11.03A2.9 2.9 0 0 1 46 25.4V46"
          fill="none"
          stroke="#fff"
          stroke-width="6.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="32" cy="45" r="3.4" fill="#fff" />
      </svg>
    </span>

    @if (showText()) {
      <span class="logo__text">
        <strong>Maya</strong>
        <span>Classroom</span>
      </span>
    }
  `,
  host: {
    class: 'logo',
    '[class.logo--stacked]': "textLayout() === 'stacked'",
    '[class.logo--inline]': "textLayout() === 'inline'",
  },
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        color: inherit;
      }

      .logo__mark {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        line-height: 0;
        border-radius: calc(var(--logo-size, 38px) * 0.3);
        box-shadow: var(--maya-shadow-primary);
      }

      .logo__text {
        font-family: var(--maya-font-heading);
        letter-spacing: -0.035em;
        line-height: 1.05;
        min-width: 0;
      }

      /* Apilado: «Maya» sobre un rótulo pequeño en versales. */
      :host(.logo--stacked) .logo__text {
        display: flex;
        flex-direction: column;
      }

      :host(.logo--stacked) strong {
        font-size: 1.05rem;
        font-weight: 800;
        color: var(--maya-text);
      }

      :host(.logo--stacked) span {
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--maya-text-subtle);
      }

      /* En línea: «Maya Classroom» como una sola palabra de dos pesos. */
      :host(.logo--inline) .logo__text {
        font-size: 1.05rem;
        font-weight: 800;
        white-space: nowrap;
      }

      :host(.logo--inline) span {
        font-weight: 500;
        opacity: 0.85;
      }

      :host(.logo--inline) span::before {
        content: ' ';
      }

      /* En pantallas muy estrechas el símbolo carga solo con la identidad: el
         rótulo compite con el título de la pantalla. */
      @media (max-width: 479px) {
        :host(.logo--mark-only-mobile) .logo__text {
          display: none;
        }
      }
    `,
  ],
})
export class LogoComponent {
  /** Lado del símbolo en píxeles. */
  readonly size = input<number>(38);
  readonly showText = input<boolean>(true);
  readonly textLayout = input<'stacked' | 'inline'>('stacked');

  protected readonly sheenId = `maya-logo-sheen-${++uid}`;
  protected readonly sheenUrl = `url(#${this.sheenId})`;
}
