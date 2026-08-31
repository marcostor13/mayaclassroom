import { Pipe, PipeTransform } from '@angular/core';
import { formatBytes } from '@maya/shared';

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatBytes(value ?? 0);
  }
}
