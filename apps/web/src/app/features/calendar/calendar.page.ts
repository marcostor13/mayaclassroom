import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CAP, CalendarEventDto, CalendarEventType, CourseSummary } from '@maya/shared';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CommunicationService } from '../../core/services/communication.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { CoursesService } from '../../core/services/courses.service';
import { ToastService } from '../../core/services/toast.service';
import {
  EmptyStateComponent,
  FormatDatePipe,
  IconComponent,
  ModalComponent,
} from '../../shared';

interface CalendarCell {
  date: Date;
  inMonth: boolean;
  today: boolean;
  events: CalendarEventDto[];
}

/** Color por defecto de un evento nuevo, dentro de la paleta de la marca. */
const COLOR_POR_DEFECTO = '#E4574D';

@Component({
  selector: 'maya-calendar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    IconComponent,
    EmptyStateComponent,
    FormatDatePipe,
    ModalComponent,
  ],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPage {
  private readonly comms = inject(CommunicationService);
  private readonly courses = inject(CoursesService);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  readonly cursor = signal(new Date());
  readonly events = signal<CalendarEventDto[]>([]);
  readonly loading = signal(true);
  readonly selected = signal<Date | null>(null);
  readonly weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /** Evento en edición; `null` cuando el diálogo está cerrado. */
  readonly editing = signal<CalendarEventDto | null>(null);
  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly myCourses = signal<CourseSummary[]>([]);

  /** Quien puede gestionar el calendario del curso ve el selector de ámbito. */
  readonly canManageCourse = computed(() => this.auth.can(CAP.CALENDAR_MANAGE_COURSE));

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    eventType: [CalendarEventType.User as CalendarEventType],
    courseId: [''],
    startAt: ['', [Validators.required]],
    endAt: [''],
    allDay: [false],
    location: [''],
    color: [COLOR_POR_DEFECTO],
  });

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
    this.courses.myCourses({ limit: 100 }).subscribe({
      next: (result) => this.myCourses.set(result.items),
    });
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

  /* ------------------------------ Edición ------------------------------- */

  /** Abre el formulario en blanco, a las 9:00 del día seleccionado. */
  openNew(): void {
    const day = this.selected() ?? new Date();
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);

    this.editing.set(null);
    this.form.reset({
      name: '',
      description: '',
      eventType: CalendarEventType.User,
      courseId: '',
      startAt: toLocalInput(start),
      endAt: '',
      allDay: false,
      location: '',
      color: COLOR_POR_DEFECTO,
    });
    this.formOpen.set(true);
  }

  openEdit(event: CalendarEventDto): void {
    this.editing.set(event);
    this.form.reset({
      name: event.name,
      description: event.description ?? '',
      eventType: event.eventType,
      courseId: event.courseId ?? '',
      startAt: toLocalInput(new Date(event.startAt)),
      endAt: event.endAt ? toLocalInput(new Date(event.endAt)) : '',
      allDay: event.allDay,
      location: event.location ?? '',
      color: event.color ?? COLOR_POR_DEFECTO,
    });
    this.formOpen.set(true);
  }

  close(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const esDeCurso = value.eventType === CalendarEventType.Course;

    if (esDeCurso && !value.courseId) {
      this.toast.warning('Falta el curso', 'Elija a qué curso pertenece el evento.');
      return;
    }

    const payload: Partial<CalendarEventDto> = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      eventType: value.eventType,
      courseId: esDeCurso ? value.courseId : null,
      startAt: new Date(value.startAt).toISOString(),
      endAt: value.endAt ? new Date(value.endAt).toISOString() : null,
      allDay: value.allDay,
      location: value.location.trim() || null,
      color: value.color,
    };

    const current = this.editing();
    const request = current
      ? this.comms.updateEvent(current.id, payload)
      : this.comms.createEvent(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Evento actualizado' : 'Evento creado');
        this.close();
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(event: CalendarEventDto): void {
    this.confirm
      .ask({
        title: 'Eliminar evento',
        message: `Se eliminará «${event.name}» del calendario.`,
        confirmLabel: 'Eliminar',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.comms.deleteEvent(event.id).subscribe({
          next: () => {
            this.events.update((list) => list.filter((item) => item.id !== event.id));
            this.toast.success('Evento eliminado');
            this.close();
          },
        });
      });
  }

  /**
   * Los eventos generados por una actividad (entregas, cierres de cuestionario)
   * se editan desde la actividad, no desde aquí.
   */
  isEditable(event: CalendarEventDto): boolean {
    if (event.moduleId) return false;
    if (event.eventType === CalendarEventType.User) return true;
    return this.canManageCourse();
  }

  /**
   * La exportación va por `ApiService` y no por un enlace directo: el token de
   * sesión viaja en la cabecera `Authorization`, que un `href` no envía.
   */
  exportIcs(): void {
    this.api.download('/calendar/export.ics').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'maya-classroom.ics';
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }
}

/** Fecha en el formato que espera `<input type="datetime-local">` (hora local). */
function toLocalInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
