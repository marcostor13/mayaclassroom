import { Pipe, PipeTransform } from '@angular/core';

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

/** «hace 3 días», «en 2 semanas»… en español. */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  private readonly formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    let duration = (new Date(value).getTime() - Date.now()) / 1000;

    for (const division of DIVISIONS) {
      if (Math.abs(duration) < division.amount) {
        return this.formatter.format(Math.round(duration), division.unit);
      }
      duration /= division.amount;
    }
    return '';
  }
}
