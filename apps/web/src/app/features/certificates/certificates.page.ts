import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CourseSummary, IssuedCertificateDto } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent, FormatDatePipe, IconComponent } from '../../shared';

/** Certificados obtenidos y solicitud de los cursos ya completados. */
@Component({
  selector: 'maya-certificates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, EmptyStateComponent, FormatDatePipe],
  templateUrl: './certificates.page.html',
})
export class CertificatesPage {
  private readonly api = inject(ApiService);
  private readonly courses = inject(CoursesService);
  private readonly toast = inject(ToastService);

  readonly certificates = signal<IssuedCertificateDto[]>([]);
  readonly myCourses = signal<CourseSummary[]>([]);
  readonly loading = signal(true);
  readonly claiming = signal<string | null>(null);

  /** Cursos superados de los que aún no se tiene certificado. */
  readonly claimable = computed(() => {
    const yaEmitidos = new Set(this.certificates().map((item) => item.courseId));
    return this.myCourses().filter(
      (course) => (course.progress ?? 0) >= 100 && !yaEmitidos.has(course.id),
    );
  });

  constructor() {
    this.load();
    this.courses.myCourses({ limit: 100 }).subscribe({
      next: (result) => this.myCourses.set(result.items),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<IssuedCertificateDto[]>('/certificates/me').subscribe({
      next: (list) => {
        this.certificates.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  courseName(courseId: string): string {
    return this.myCourses().find((course) => course.id === courseId)?.fullName ?? 'Curso';
  }

  readonly copied = signal<string | null>(null);

  /** El certificado imprimible y la verificación son públicos: van a la API. */
  renderUrl(certificate: IssuedCertificateDto): string {
    return `${this.api.baseUrl}/certificates/${certificate.code}/render`;
  }

  /** Vista en línea, la única disponible cuando el curso no deja descargar. */
  viewUrl(certificate: IssuedCertificateDto): string {
    return `${this.api.baseUrl}/certificates/${certificate.code}/view`;
  }

  /**
   * Copia el enlace de verificación.
   *
   * Es lo que se manda a quien pide acreditar el título: lleva a una página que
   * comprueba el sello contra el servidor, y no a una imagen que cualquiera
   * podría haber retocado.
   */
  async copyVerifyLink(certificate: IssuedCertificateDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.verifyUrl(certificate));
      this.copied.set(certificate.id);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      this.toast.error('No se ha podido copiar el enlace');
    }
  }

  verifyUrl(certificate: IssuedCertificateDto): string {
    return `${this.api.baseUrl}/certificates/verify/${certificate.code}`;
  }

  claim(course: CourseSummary): void {
    this.claiming.set(course.id);
    this.api.post<IssuedCertificateDto>(`/certificates/courses/${course.id}/claim`).subscribe({
      next: () => {
        this.claiming.set(null);
        this.toast.success('Certificado emitido', course.fullName);
        this.load();
      },
      error: () => this.claiming.set(null),
    });
  }
}
