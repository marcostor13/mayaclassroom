import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CompletionState,
  QuizAttemptState,
  StudentKpi,
  StudentReportDto,
  slugify,
} from '@maya/shared';
import { ReportsService } from '../../core/services/reports.service';
import { ToastService } from '../../core/services/toast.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ProgressBarComponent,
} from '../../shared';

/**
 * Expediente completo de un alumno.
 *
 * Reúne en una pantalla lo que antes obligaba a recorrer cinco: matrículas,
 * avance, notas, exámenes, asistencia y firma. Se organiza en pestañas porque
 * quien lo abre viene a mirar una cosa concreta —una nota, una asistencia— y
 * una página con todo desplegado obliga a buscar.
 *
 * Lo mismo que se ve se descarga: la exportación no es un resumen aparte que
 * pueda acabar diciendo algo distinto.
 */
@Component({
  selector: 'maya-student-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    ProgressBarComponent,
    FormatDatePipe,
  ],
  templateUrl: './student-report.page.html',
  styleUrl: './student-report.page.scss',
})
export class StudentReportPage {
  private readonly route = inject(ActivatedRoute);
  private readonly reports = inject(ReportsService);
  private readonly toast = inject(ToastService);

  readonly CompletionState = CompletionState;
  readonly QuizAttemptState = QuizAttemptState;

  readonly userId = this.route.snapshot.paramMap.get('userId')!;
  readonly report = signal<StudentReportDto | null>(null);
  readonly loading = signal(true);
  readonly downloading = signal<'excel' | 'pdf' | null>(null);
  readonly tab = signal<'courses' | 'activities' | 'exams' | 'attendance'>('courses');

  readonly hasData = computed(() => (this.report()?.courses.length ?? 0) > 0);

  constructor() {
    this.reports.student(this.userId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** El valor con su unidad, tal como debe leerse en la tarjeta. */
  kpiValue(kpi: StudentKpi): string {
    switch (kpi.unit) {
      case 'percent':
        return `${kpi.value} %`;
      case 'hours':
        return `${kpi.value} h`;
      default:
        return String(kpi.value);
    }
  }

  estado(state: CompletionState): string {
    switch (state) {
      case CompletionState.Complete:
        return 'Completada';
      case CompletionState.CompletePass:
        return 'Aprobada';
      case CompletionState.CompleteFail:
        return 'No superada';
      default:
        return 'Pendiente';
    }
  }

  resultado(passed: boolean | null): string {
    if (passed === null) return 'En curso';
    return passed ? 'Aprobado' : 'No superado';
  }

  descargarExcel(): void {
    this.descargar('excel');
  }

  /**
   * Abre la versión imprimible en una pestaña y lanza el diálogo de impresión.
   *
   * El PDF lo produce el propio navegador («Guardar como PDF»): generarlo en el
   * servidor obligaría a llevar un navegador completo en la imagen de
   * despliegue para conseguir el mismo documento.
   */
  descargarPdf(): void {
    this.descargar('pdf');
  }

  private descargar(formato: 'excel' | 'pdf'): void {
    if (this.downloading()) return;
    const nombre = slugify(this.report()?.student.fullName ?? 'alumno');
    this.downloading.set(formato);

    const peticion =
      formato === 'excel' ? this.reports.excel(this.userId) : this.reports.printable(this.userId);

    peticion.subscribe({
      next: (blob) => {
        this.downloading.set(null);
        const url = URL.createObjectURL(blob);

        if (formato === 'excel') {
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `expediente-${nombre}.xlsx`;
          enlace.click();
          URL.revokeObjectURL(url);
          return;
        }

        const ventana = window.open(url, '_blank');
        if (!ventana) {
          this.toast.error(
            'El navegador ha bloqueado la ventana',
            'Permita las ventanas emergentes de esta página para guardar el PDF.',
          );
        }
        // La dirección se libera con margen: revocarla al instante dejaría la
        // pestaña recién abierta sin nada que enseñar.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.downloading.set(null),
    });
  }
}
