import { Pipe, PipeTransform } from '@angular/core';
import { DEFAULT_LOCALE } from '@maya/shared';

type Preset = 'short' | 'long' | 'time' | 'datetime' | 'day' | 'month';

const OPTIONS: Record<Preset, Intl.DateTimeFormatOptions> = {
  short: { day: '2-digit', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  time: { hour: '2-digit', minute: '2-digit' },
  datetime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  day: { weekday: 'short', day: 'numeric' },
  month: { month: 'long', year: 'numeric' },
};

/** Formatea fechas en español con presets legibles. */
@Pipe({ name: 'mayaDate' })
export class FormatDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, preset: Preset = 'short'): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, OPTIONS[preset]).format(new Date(value));
  }
}
