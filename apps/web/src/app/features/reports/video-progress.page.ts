import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CourseMediaProgressDto,
  MediaProgressReport,
  MediaProgressReportRow,
  MediaSourceKind,
} from '@maya/shared';
import { MediaProgressService } from '../../core/services/media-progress.service';
import {
  AvatarComponent,
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
  ProgressBarComponent,
} from '../../shared';

/**
 * Cumplimiento de visualización de un curso.
 *
 * Responde a dos preguntas distintas y por eso tiene dos niveles: la tabla dice
 * quién va al día, y el detalle de una persona dice en qué vídeo se quedó. Sin
 * el segundo, el informe solo sirve para señalar; con él sirve para llamar y
 * saber de qué hablar.
 */
@Component({
  selector: 'maya-video-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    IconComponent,
    AvatarComponent,
    EmptyStateComponent,
    ModalComponent,
    ProgressBarComponent,
    FormatDatePipe,
  ],
  templateUrl: './video-progress.page.html',
  styleUrl: './video-progress.page.scss',
})
export class VideoProgressPage {
  private readonly route = inject(ActivatedRoute);
  private readonly media = inject(MediaProgressService);

  readonly courseId = this.route.snapshot.paramMap.get('id')!;
  readonly report = signal<MediaProgressReport | null>(null);
  readonly loading = signal(true);
  readonly search = signal('');
  /** `pending` deja arriba a quien va más atrasado, que es a quien hay que ver. */
  readonly order = signal<'pending' | 'name' | 'recent'>('pending');

  readonly detail = signal<MediaProgressReportRow | null>(null);
  readonly detailData = signal<CourseMediaProgressDto | null>(null);
  readonly detailLoading = signal(false);

  readonly rows = computed(() => {
    const data = this.report();
    if (!data) return [];
    const term = this.search().trim().toLowerCase();
    const filtered = term
      ? data.rows.filter(
          (r) =>
            r.user.fullName.toLowerCase().includes(term) ||
            r.user.email.toLowerCase().includes(term),
        )
      : [...data.rows];

    switch (this.order()) {
      case 'name':
        return filtered.sort((a, b) => a.user.fullName.localeCompare(b.user.fullName, 'es'));
      case 'recent':
        return filtered.sort((a, b) => (b.lastPlayedAt ?? '').localeCompare(a.lastPlayedAt ?? ''));
      default:
        return filtered.sort((a, b) => a.percent - b.percent);
    }
  });

  /** Reparto en tres tramos para leer de un vistazo cómo va el grupo. */
  readonly buckets = computed(() => {
    const rows = this.report()?.rows ?? [];
    const done = rows.filter((r) => r.percent >= 90).length;
    const started = rows.filter((r) => r.percent > 0 && r.percent < 90).length;
    return { done, started, idle: rows.length - done - started, total: rows.length };
  });

  constructor() {
    this.media.courseReport(this.courseId).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(row: MediaProgressReportRow): void {
    this.detail.set(row);
    this.detailData.set(null);
    this.detailLoading.set(true);
    this.media.ofStudent(this.courseId, row.user.id).subscribe({
      next: (data) => {
        this.detailData.set(data);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  close(): void {
    this.detail.set(null);
  }

  esExterno(kind: MediaSourceKind): boolean {
    return kind === MediaSourceKind.Embed;
  }

  /** «2 h 15 min», que es como se lee el tiempo de clase. */
  duracion(seconds: number): string {
    if (!seconds) return '—';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    if (!hours) return `${minutes} min`;
    return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  }

  /** Descarga la tabla tal como se ve, para adjuntarla a un informe. */
  exportCsv(): void {
    const data = this.report();
    if (!data) return;

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      ['Alumno', 'Correo', 'Vídeos vistos', 'Total de vídeos', 'Avance %', 'Tiempo visto', 'Última reproducción']
        .map(escape)
        .join(','),
      ...data.rows.map((row) =>
        [
          row.user.fullName,
          row.user.email,
          String(row.completedVideos),
          String(row.totalVideos),
          String(row.percent),
          this.duracion(row.watchedSeconds),
          row.lastPlayedAt ? new Date(row.lastPlayedAt).toLocaleString('es-PE') : '',
        ]
          .map(escape)
          .join(','),
      ),
    ];

    // La marca de orden de bytes hace que Excel abra el CSV en UTF-8; sin ella
    // las tildes salen rotas, que es lo primero que se ve en español.
    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `visualizacion-${this.courseId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
