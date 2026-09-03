import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { SUPPORTED_CURRENCIES } from '@maya/shared';
import type { PaymentSettingsDto } from '@maya/shared';
import { CommerceService } from '../../../core/services/commerce.service';
import type { PaymentSettingsPayload } from '../../../core/services/commerce.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { IconComponent } from '../../../shared';

/** Monedas de los mercados donde operan las dos pasarelas admitidas. */
const MONEDAS = SUPPORTED_CURRENCIES;

/**
 * Ajustes de cobro.
 *
 * Las credenciales entran, se cifran y no vuelven a salir: la pantalla solo
 * sabe si están puestas. Por eso el campo del secreto aparece vacío aunque
 * haya una guardada, con un aviso al lado: escribir algo la sustituye y
 * dejarlo en blanco la conserva.
 */
@Component({
  selector: 'maya-admin-payments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './payments.page.html',
  styleUrl: './payments.page.scss',
})
export class AdminPaymentsPage implements OnInit {
  private readonly commerce = inject(CommerceService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly monedas = MONEDAS;

  readonly settings = signal<PaymentSettingsDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal(false);

  /** Credenciales escritas en esta sesión; vacías significan «no la toques». */
  readonly mpToken = signal('');
  readonly ppSecret = signal('');

  /** Dirección del aviso automático, que hay que pegar en el panel del proveedor. */
  readonly webhookUrl = signal('');

  ngOnInit(): void {
    const slug = this.auth.tenantSlug();
    if (slug) this.webhookUrl.set(`${location.origin}/api/v1/site/public/${slug}/webhooks`);
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(false);
    this.commerce.settings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  patch(cambio: PaymentSettingsPayload): void {
    const actual = this.settings();
    if (!actual) return;
    // Cambio optimista: el interruptor debe responder al instante; si el
    // guardado falla, la recarga del servidor devuelve el valor bueno.
    this.settings.set({
      ...actual,
      ...cambio,
      mercadoPago: { ...actual.mercadoPago, ...(cambio.mercadoPago ?? {}) },
      paypal: { ...actual.paypal, ...(cambio.paypal ?? {}) },
      manual: { ...actual.manual, ...(cambio.manual ?? {}) },
      simulated: { ...actual.simulated, ...(cambio.simulated ?? {}) },
    } as PaymentSettingsDto);
  }

  guardar(): void {
    const settings = this.settings();
    if (!settings || this.saving()) return;
    this.saving.set(true);

    const payload: PaymentSettingsPayload = {
      currency: settings.currency,
      mercadoPago: {
        enabled: settings.mercadoPago.enabled,
        publicKey: settings.mercadoPago.publicKey ?? null,
        sandbox: settings.mercadoPago.sandbox,
      },
      paypal: {
        enabled: settings.paypal.enabled,
        clientId: settings.paypal.clientId ?? null,
        sandbox: settings.paypal.sandbox,
      },
      manual: {
        enabled: settings.manual.enabled,
        instructions: settings.manual.instructions ?? null,
      },
      simulated: { enabled: settings.simulated.enabled },
    };

    // Solo se envían las credenciales que se hayan escrito: enviarlas vacías
    // borraría las que ya estaban guardadas.
    if (this.mpToken().trim()) payload.mercadoPago!.accessToken = this.mpToken().trim();
    if (this.ppSecret().trim()) payload.paypal!.secret = this.ppSecret().trim();

    this.commerce.updateSettings(payload).subscribe({
      next: (saved) => {
        this.settings.set(saved);
        this.mpToken.set('');
        this.ppSecret.set('');
        this.saving.set(false);
        this.toast.success('Ajustes de cobro guardados');
      },
      error: () => this.saving.set(false),
    });
  }

  borrarCredencial(pasarela: 'mercadoPago' | 'paypal'): void {
    const payload: PaymentSettingsPayload =
      pasarela === 'mercadoPago'
        ? { mercadoPago: { accessToken: null } }
        : { paypal: { secret: null } };

    this.commerce.updateSettings(payload).subscribe({
      next: (saved) => {
        this.settings.set(saved);
        this.toast.success('Credencial borrada');
      },
    });
  }
}
