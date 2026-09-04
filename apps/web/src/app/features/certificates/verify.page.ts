import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CertificateVerificationDto } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { FormatDatePipe, IconComponent, LogoComponent } from '../../shared';

/**
 * Comprobación pública de un certificado.
 *
 * Es la página a la que llevan el código QR y el enlace del documento, así que
 * su público es alguien de fuera: una empresa que contrata, un organismo que
 * homologa. No pide sesión, no enseña nada más que lo acreditado y dice en una
 * línea si el certificado vale o no, que es lo único que se viene a saber.
 */
@Component({
  selector: 'maya-certificate-verify',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, LogoComponent, FormatDatePipe],
  templateUrl: './verify.page.html',
  styleUrl: './verify.page.scss',
})
export class CertificateVerifyPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);

  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly result = signal<CertificateVerificationDto | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.api.get<CertificateVerificationDto>(`/certificates/verify/${this.code}`).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      // Un código inexistente responde con `valid: false`, no con un error; si
      // aun así falla la petición, se dice lo mismo antes que dejar la página
      // en blanco.
      error: () => {
        this.result.set({ valid: false, reason: 'No se ha podido comprobar el certificado.' });
        this.loading.set(false);
      },
    });
  }

  viewUrl(): string {
    return `${this.api.baseUrl}/certificates/${this.code}/view`;
  }
}
