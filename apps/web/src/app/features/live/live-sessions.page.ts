import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CAP,
  LIVE_RECORDING_STATUS_LABEL,
  LiveRecordingDto,
  LiveSessionDto,
  LiveSessionStatus,
  SignatureUse,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { LiveService } from '../../core/services/live.service';
import { SignaturesService } from '../../core/services/signatures.service';
import { ToastService } from '../../core/services/toast.service';
import {
  EmptyStateComponent,
  FileSizePipe,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
} from '../../shared';
import { LiveSessionFormComponent } from './live-session-form.component';

type Tab = 'upcoming' | 'past' | 'recordings';

/**
 * Clases en vivo: lo convocado, lo pasado y las grabaciones.
 *
 * Es la pantalla a la que llevan el calendario y las notificaciones, así que
 * enseña el enlace de cada sala listo para copiar: compartirlo por el canal que
 * cada centro use es la mitad del trabajo de convocar.
 */
@Component({
  selector: 'maya-live-sessions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IconComponent,
    EmptyStateComponent,
    FormatDatePipe,
    FileSizePipe,
    ModalComponent,
    LiveSessionFormComponent,
  ],
  templateUrl: './live-sessions.page.html',
  styleUrl: './live-sessions.page.scss',
})
export class LiveSessionsPage {
  private readonly live = inject(LiveService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly signatures = inject(SignaturesService);

  /** Sesiones cuya asistencia ya ha firmado esta persona. */
  readonly firmadas = signal<Set<string>>(new Set());

  /**
   * Firma la asistencia a una clase.
   *
   * Requiere tener firma registrada en el perfil; si no la hay, la API lo dice
   * y aquí se traduce en un aviso que lleva a registrarla, porque el error tal
   * cual no explica qué hacer.
   */
  firmarAsistencia(session: LiveSessionDto): void {
    this.signatures
      .sign({
        use: SignatureUse.Attendance,
        courseId: session.courseId ?? undefined,
        referenceId: session.id,
        referenceLabel: session.title,
      })
      .subscribe({
        next: () => {
          this.firmadas.update((set) => new Set(set).add(session.id));
          this.toast.success(
            'Asistencia firmada',
            'Su firma queda registrada en el acta de la clase.',
          );
        },
        error: () =>
          this.toast.error(
            'Antes hay que registrar la firma',
            'Vaya a su perfil, pestaña «Mi firma», y dibújela una sola vez.',
          ),
      });
  }

  private cargarFirmas(): void {
    this.signatures.myRecords().subscribe({
      next: (records) =>
        this.firmadas.set(
          new Set(
            records
              .filter((record) => record.use === SignatureUse.Attendance && record.referenceId)
              .map((record) => record.referenceId as string),
          ),
        ),
      error: () => undefined,
    });
  }

  readonly tab = signal<Tab>('upcoming');
  readonly loading = signal(true);
  readonly upcoming = signal<LiveSessionDto[]>([]);
  readonly past = signal<LiveSessionDto[]>([]);
  readonly recordings = signal<LiveRecordingDto[]>([]);

  readonly formOpen = signal(false);
  readonly editing = signal<LiveSessionDto | null>(null);
  readonly copiedId = signal<string | null>(null);

  /** Grabación abierta en el reproductor. */
  readonly playing = signal<LiveRecordingDto | null>(null);
  readonly playingUrl = signal<string | null>(null);

  readonly canCreate = computed(() => this.auth.can(CAP.LIVE_CREATE) || this.auth.isTeacherAnywhere());
  readonly statusLabel = LIVE_RECORDING_STATUS_LABEL;

  constructor() {
    this.load();
    this.cargarFirmas();
  }

  load(): void {
    this.loading.set(true);
    this.live.sessions({ upcoming: true, limit: 50 }).subscribe({
      next: (sessions) => {
        this.upcoming.set(sessions);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.live.sessions({ status: LiveSessionStatus.Ended, limit: 50 }).subscribe({
      next: (sessions) => this.past.set(sessions),
    });
    this.live.library().subscribe({ next: (rows) => this.recordings.set(rows) });
  }

  /* ------------------------------ Convocar -------------------------------- */

  openNew(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(session: LiveSessionDto): void {
    this.editing.set(session);
    this.formOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.editing.set(null);
    this.load();
  }

  cancel(session: LiveSessionDto): void {
    this.confirm
      .ask({
        title: 'Cancelar la sesión',
        message: `Se cancelará «${session.title}» y se retirará del calendario.`,
        confirmLabel: 'Cancelar la sesión',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.live.remove(session.id).subscribe({
          next: () => {
            this.toast.success('Sesión cancelada');
            this.load();
          },
        });
      });
  }

  async copyLink(session: LiveSessionDto): Promise<void> {
    try {
      await navigator.clipboard.writeText(session.joinUrl);
      this.copiedId.set(session.id);
      setTimeout(() => this.copiedId.set(null), 2000);
    } catch {
      this.toast.info('Enlace de la sala', session.joinUrl);
    }
  }

  /* ----------------------------- Grabaciones ------------------------------ */

  /**
   * Descarga el vídeo y lo reproduce desde un objeto local. No se puede poner
   * la ruta de la API en el `src` del reproductor: la descarga exige el testigo
   * de sesión en la cabecera y una etiqueta `<video>` no la envía.
   */
  play(recording: LiveRecordingDto): void {
    this.playing.set(recording);
    this.playingUrl.set(null);
    this.live.media(recording.id).subscribe({
      next: (blob) => this.playingUrl.set(URL.createObjectURL(blob)),
      error: () => {
        this.toast.error('No se ha podido abrir la grabación');
        this.closePlayer();
      },
    });
  }

  closePlayer(): void {
    const url = this.playingUrl();
    if (url) URL.revokeObjectURL(url);
    this.playingUrl.set(null);
    this.playing.set(null);
  }

  download(recording: LiveRecordingDto): void {
    this.live.media(recording.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `${recording.title.replace(/\s+/g, '-').toLowerCase()}.webm`;
        enlace.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  togglePublished(recording: LiveRecordingDto): void {
    this.live
      .updateRecording(recording.id, { visibleToStudents: !recording.visibleToStudents })
      .subscribe({
        next: (updated) => {
          this.recordings.update((list) =>
            list.map((row) => (row.id === updated.id ? updated : row)),
          );
          this.toast.success(
            updated.visibleToStudents ? 'Grabación publicada' : 'Grabación retirada',
          );
        },
      });
  }

  removeRecording(recording: LiveRecordingDto): void {
    this.confirm
      .ask({
        title: 'Eliminar la grabación',
        message: `Se eliminará «${recording.title}» y no se podrá recuperar.`,
        confirmLabel: 'Eliminar',
        danger: true,
      })
      .subscribe((confirmado) => {
        if (!confirmado) return;
        this.live.removeRecording(recording.id).subscribe({
          next: () => {
            this.recordings.update((list) => list.filter((row) => row.id !== recording.id));
            this.toast.success('Grabación eliminada');
          },
        });
      });
  }

  /** Duración en `1 h 05 min` o `12 min`. */
  duration(seconds: number): string {
    const horas = Math.floor(seconds / 3600);
    const minutos = Math.round((seconds % 3600) / 60);
    return horas ? `${horas} h ${String(minutos).padStart(2, '0')} min` : `${minutos} min`;
  }

  /** ¿Ya se puede entrar? Abierta, o a punto de empezar. */
  joinable(session: LiveSessionDto): boolean {
    if (session.status === LiveSessionStatus.Live) return true;
    if (session.status !== LiveSessionStatus.Scheduled) return false;
    const margen = (session.settings.joinBeforeHostMinutes ?? 15) * 60_000;
    return Date.now() >= new Date(session.scheduledStart).getTime() - margen;
  }
}
