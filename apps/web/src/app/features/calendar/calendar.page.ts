import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarEventDto } from '@maya/shared';
import { CommunicationService } from '../../core/services/communication.service';
import { EmptyStateComponent, FormatDatePipe, IconComponent } from '../../shared';

interface CalendarCell {
  date: Date;
  inMonth: boolean;
  today: boolean;
  events: CalendarEventDto[];
}

@Component({
  selector: 'maya-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, EmptyStateComponent, FormatDatePipe],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPage {
  private readonly comms = inject(CommunicationService);

  readonly cursor = signal(new Date());
  readonly events = signal<CalendarEventDto[]>([]);
  readonly loading = signal(true);
  readonly selected = signal<Date | null>(null);
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(this.cursor()),
  );

  /** Rejilla de 6 semanas comenzando en lunes. */
  readonly grid = computed<CalendarCell[]>(() => {
    const cursor = this.cursor();
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);

    const today = new Date();
    const cells: CalendarCell[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      cells.push({
        date,
        inMonth: date.getMonth() === cursor.getMonth(),
        today: date.toDateString() === today.toDateString(),
        events: this.events().filter(
          (event) => new Date(event.startAt).toDateString() === date.toDateString(),
        ),
      });
    }
    return cells;
  });

  readonly selectedEvents = computed(() => {
    const day = this.selected();
    if (!day) return this.events().slice(0, 12);
    return this.events().filter(
      (event) => new Date(event.startAt).toDateString() === day.toDateString(),
    );
  });

  constructor() {
    this.load();
  }

  private load(): void {
    const cursor = this.cursor();
    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1).toISOString();
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0).toISOString();
    this.loading.set(true);
    this.comms.events(from, to).subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  shift(months: number): void {
    const cursor = this.cursor();
    this.cursor.set(new Date(cursor.getFullYear(), cursor.getMonth() + months, 1));
    this.load();
  }

  today(): void {
    this.cursor.set(new Date());
    this.selected.set(new Date());
    this.load();
  }

  select(cell: CalendarCell): void {
    this.selected.set(cell.date);
  }
}
