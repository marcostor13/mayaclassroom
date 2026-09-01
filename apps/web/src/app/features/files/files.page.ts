import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FileRef } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import {
  EmptyStateComponent,
  FileSizePipe,
  FormatDatePipe,
  IconComponent,
} from '../../shared';

/** Ficheros privados de la persona: subida, descarga y borrado. */
@Component({
  selector: 'maya-files',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, EmptyStateComponent, FileSizePipe, FormatDatePipe],
  templateUrl: './files.page.html',
})
export class FilesPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly files = signal<FileRef[]>([]);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly dragging = signal(false);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<FileRef[]>('/files/mine').subscribe({
      next: (list) => {
        this.files.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) this.upload(Array.from(input.files));
    // Se limpia para poder volver a elegir el mismo fichero.
    input.value = '';
  }

  drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const dropped = event.dataTransfer?.files;
    if (dropped?.length) this.upload(Array.from(dropped));
  }

  private upload(files: File[]): void {
    const form = new FormData();
    for (const file of files) form.append('files', file);

    this.uploading.set(true);
    this.api
      .upload<FileRef[]>('/files/upload-many', form, { component: 'user', fileArea: 'private' })
      .subscribe({
        next: (uploaded) => {
          this.uploading.set(false);
          this.toast.success(
            uploaded.length === 1 ? 'Fichero subido' : `${uploaded.length} ficheros subidos`,
          );
          this.load();
        },
        error: () => this.uploading.set(false),
      });
  }

  /** La descarga pasa por `ApiService` para que viaje el token de sesión. */
  download(file: FileRef): void {
    this.api.download(`/files/${file.id}/download`).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  remove(file: FileRef): void {
    this.confirm
      .ask({
        title: 'Eliminar fichero',
        message: `Se eliminará «${file.filename}» de forma permanente.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.api.delete(`/files/${file.id}`).subscribe({
          next: () => {
            this.files.update((list) => list.filter((item) => item.id !== file.id));
            this.toast.success('Fichero eliminado');
          },
        });
      });
  }

  icon(file: FileRef): string {
    if (file.mimeType.startsWith('image/')) return 'eye';
    if (file.mimeType.startsWith('video/')) return 'play-circle';
    if (file.mimeType.includes('pdf')) return 'file-text';
    if (file.mimeType.includes('zip') || file.mimeType.includes('compressed')) return 'package';
    return 'file';
  }
}
