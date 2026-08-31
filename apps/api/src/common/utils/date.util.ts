import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.locale('es');

export { dayjs };

export const startOfDay = (d: Date | string = new Date()): Date => dayjs(d).startOf('day').toDate();
export const endOfDay = (d: Date | string = new Date()): Date => dayjs(d).endOf('day').toDate();
export const addDays = (d: Date | string, days: number): Date => dayjs(d).add(days, 'day').toDate();
export const addWeeks = (d: Date | string, weeks: number): Date =>
  dayjs(d).add(weeks, 'week').toDate();
export const addMinutes = (d: Date | string, minutes: number): Date =>
  dayjs(d).add(minutes, 'minute').toDate();

/** Diferencia en días completos (positiva si `a` es posterior a `b`). */
export const diffDays = (a: Date | string, b: Date | string): number => dayjs(a).diff(dayjs(b), 'day');

/** Etiqueta legible para una semana de curso en formato semanal. */
export const weekLabel = (start: Date, week: number): string => {
  const from = dayjs(start).add(week, 'week');
  return `${from.format('D MMM')} – ${from.add(6, 'day').format('D MMM')}`;
};
