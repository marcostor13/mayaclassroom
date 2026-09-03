import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { OrderStatus, formatMoney } from '@maya/shared';
import type { CheckoutResult } from '@maya/shared';
import { SiteService } from '../../core/services/site.service';
import { IconComponent } from '../../shared';

/** Cada cuánto se vuelve a preguntar mientras el pago sigue en curso. */
const REINTENTO_MS = 4000;
/** Cuántas veces. Pasado ese punto, el aviso automático hará su trabajo. */
const REINTENTOS = 10;

/**
 * Página de vuelta de la pasarela.
 *
 * La pasarela devuelve al comprador aquí, pero eso no significa que el pago
 * esté cobrado: puede tardar segundos en confirmarse, y en efectivo puede
 * tardar días. Por eso la página pregunta al servidor —que es quien consulta a
 * la pasarela— y reintenta unas cuantas veces antes de rendirse; a partir de
 * ahí lo resuelve el aviso automático y el correo.
 */
@Component({
  selector: 'maya-order-public',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './order-public.page.html',
  styleUrl: './order-public.page.scss',
})
export class OrderPublicPage implements OnInit, OnDestroy {
  private readonly site = inject(SiteService);
  private readonly title = inject(Title);

  readonly slug = input.required<string>();
  readonly reference = input.required<string>();

  readonly result = signal<CheckoutResult | null>(null);
  readonly loading = signal(true);
  readonly notFound = signal(false);

  readonly Estado = OrderStatus;

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private intentos = 0;

  readonly pendiente = computed(() => this.result()?.order.status === OrderStatus.Pending);

  readonly importe = computed(() => {
    const order = this.result()?.order;
    if (!order) return '';
    if (order.amountCents <= 0) return 'Gratis';
    return formatMoney(order.amountCents, order.currency);
  });

  ngOnInit(): void {
    this.title.setTitle('Su compra · Maya Classroom');
    this.consultar();
  }

  ngOnDestroy(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
  }

  consultar(): void {
    this.site.orderStatus(this.slug(), this.reference()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);

        if (result.order.status === OrderStatus.Pending && this.intentos < REINTENTOS) {
          this.intentos += 1;
          this.temporizador = setTimeout(() => this.consultar(), REINTENTO_MS);
        }
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Reintento manual, para quien no quiere esperar al siguiente automático. */
  reintentar(): void {
    this.intentos = 0;
    this.loading.set(true);
    this.consultar();
  }
}
