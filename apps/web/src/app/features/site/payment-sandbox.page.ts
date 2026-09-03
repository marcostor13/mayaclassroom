import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { OrderStatus, formatMoney } from '@maya/shared';
import type { CheckoutResult } from '@maya/shared';
import { SiteService } from '../../core/services/site.service';
import { IconComponent } from '../../shared';

/**
 * Pasarela de prueba.
 *
 * Imita la pantalla de una pasarela real —importe, concepto y dos salidas— en
 * lugar de matricular en silencio, porque lo que se quiere enseñar es el
 * circuito entero: salir de la página, decidir y volver con el resultado. Un
 * atajo que matricula sin salir no demuestra que el circuito funcione.
 *
 * Solo llega aquí quien ha elegido «Pago de prueba», y la API vuelve a
 * comprobar que la empresa la tiene activada: esta pantalla no concede nada
 * por sí misma.
 */
@Component({
  selector: 'maya-payment-sandbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './payment-sandbox.page.html',
  styleUrl: './payment-sandbox.page.scss',
})
export class PaymentSandboxPage implements OnInit {
  private readonly site = inject(SiteService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  readonly slug = input.required<string>();
  readonly reference = input.required<string>();

  readonly result = signal<CheckoutResult | null>(null);
  readonly loading = signal(true);
  readonly enviando = signal(false);
  readonly error = signal(false);

  readonly resuelto = computed(() => {
    const estado = this.result()?.order.status;
    return estado !== undefined && estado !== OrderStatus.Pending;
  });

  readonly importe = computed(() => {
    const order = this.result()?.order;
    if (!order) return '';
    if (order.amountCents <= 0) return 'Gratis';
    return formatMoney(order.amountCents, order.currency);
  });

  ngOnInit(): void {
    this.title.setTitle('Pago de prueba · Maya Classroom');
    // Se lee el pedido para enseñar el importe real y no uno de adorno: si la
    // referencia no existe, es mejor decirlo antes de ofrecer botones.
    this.site.orderStatus(this.slug(), this.reference()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  resolver(approve: boolean): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.site.simulatePayment(this.slug(), this.reference(), approve).subscribe({
      next: () => {
        this.enviando.set(false);
        void this.router.navigate(['/p', this.slug(), 'pedido', this.reference()]);
      },
      error: () => this.enviando.set(false),
    });
  }
}
