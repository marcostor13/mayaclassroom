import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  CourseSummary,
  DEFAULT_LIVE_SETTINGS,
  LiveSessionDto,
  LiveSessionMode,
} from '../../core/models';
import { CoursesService } from '../../core/services/courses.service';
import { LiveService } from '../../core/services/live.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, ModalComponent } from '../../shared';

/**
 * Formulario de convocatoria de una reunión o clase en vivo.
 *
 * Es un diálogo aparte y no parte de una pantalla porque se abre desde dos
 * sitios —el calendario y la lista de clases— y convocar desde el calendario es
 * justo lo que se espera de un calendario: tenerlo duplicado garantizaba que
 * los dos formularios se separasen al primer cambio.
 */
@Component({
  selector: 'maya-live-session-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent, IconComponent],
  template: `
    <maya-modal [title]="editing() ? 'Editar la sesión' : 'Nueva clase en vivo'" (dismissed)="cancelled.emit()">
      <form [formGroup]="form" class="maya-stack" (ngSubmit)="save()">
        <div class="maya-field">
          <label class="maya-label" for="live-title">Título</label>
          <input
            id="live-title"
            class="maya-input"
            formControlName="title"
            placeholder="Clase 3 · Señales y detección de cambios"
            required
          />
        </div>

        <div class="maya-field">
          <label class="maya-label" for="live-desc">Descripción</label>
          <textarea id="live-desc" class="maya-textarea" rows="2" formControlName="description"></textarea>
        </div>

        <div class="maya-row" style="gap: var(--maya-space-3); flex-wrap: wrap">
          <div class="maya-field" style="flex: 1; min-width: 200px">
            <label class="maya-label" for="live-start">Comienza</label>
            <input id="live-start" type="datetime-local" class="maya-input" formControlName="scheduledStart" required />
          </div>
          <div class="maya-field" style="flex: 1; min-width: 200px">
            <label class="maya-label" for="live-end">Termina</label>
            <input id="live-end" type="datetime-local" class="maya-input" formControlName="scheduledEnd" />
          </div>
        </div>

        <div class="maya-row" style="gap: var(--maya-space-3); flex-wrap: wrap">
          <div class="maya-field" style="flex: 1; min-width: 200px">
            <label class="maya-label" for="live-course">Curso</label>
            <select id="live-course" class="maya-select" formControlName="courseId">
              <option value="">Reunión de empresa (sin curso)</option>
              @for (course of courses(); track course.id) {
                <option [value]="course.id">{{ course.fullName }}</option>
              }
            </select>
          </div>
          <div class="maya-field" style="flex: 1; min-width: 200px">
            <label class="maya-label" for="live-mode">Formato</label>
            <select id="live-mode" class="maya-select" formControlName="mode">
              <option value="class">Clase — solo presenta el profesorado</option>
              <option value="meeting">Reunión — todos con cámara y micro</option>
            </select>
          </div>
        </div>

        <details class="ajustes">
          <summary>
            <maya-icon name="sliders" [size]="15" />
            Ajustes de la sala
          </summary>
          <div class="ajustes__cuerpo">
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="lobby" />
              <span>Sala de espera: admitir a mano a quien llega</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="muteOnJoin" />
              <span>Entrar con el micrófono cerrado</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="allowChat" />
              <span>Permitir el chat</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="allowWhiteboard" />
              <span>El alumnado puede dibujar en la pizarra</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="allowAttendeeScreenShare" />
              <span>El alumnado puede compartir su pantalla</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="allowAttendeeCamera" />
              <span>El alumnado puede encender su cámara</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="autoRecord" />
              <span>Empezar a grabar al abrir la sala</span>
            </label>
            <label class="maya-checkbox">
              <input type="checkbox" formControlName="recordingVisibleToStudents" />
              <span>Publicar las grabaciones al alumnado</span>
            </label>
            @if (form.controls.courseId.value) {
              <label class="maya-checkbox">
                <input type="checkbox" formControlName="openToTenant" />
                <span>Abierta a toda la empresa, no solo al curso</span>
              </label>
            }

            <div class="maya-row" style="gap: var(--maya-space-3); flex-wrap: wrap">
              <div class="maya-field" style="flex: 1; min-width: 150px">
                <label class="maya-label" for="live-max">Aforo</label>
                <input id="live-max" type="number" class="maya-input" min="2" max="100" formControlName="maxParticipants" />
              </div>
              <div class="maya-field" style="flex: 1; min-width: 150px">
                <label class="maya-label" for="live-remind">Recordatorio (min)</label>
                <input id="live-remind" type="number" class="maya-input" min="0" max="1440" formControlName="reminderMinutes" />
              </div>
            </div>
            <p class="ajustes__nota">
              El vídeo va de navegador a navegador, así que el aforo cómodo depende de la conexión
              de cada cual. En formato «clase», donde solo emite quien presenta, aguanta mucho más.
            </p>
          </div>
        </details>
      </form>

      <ng-container footer>
        <button type="button" class="maya-btn maya-btn--ghost" (click)="cancelled.emit()">Cancelar</button>
        <button type="button" class="maya-btn maya-btn--primary" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Guardando…' : editing() ? 'Guardar' : 'Convocar' }}
        </button>
      </ng-container>
    </maya-modal>
  `,
  styles: [
    `
      .ajustes {
        border: 1px solid var(--maya-border);
        border-radius: var(--maya-radius-md);
        padding: var(--maya-space-3);

        summary {
          display: flex;
          align-items: center;
          gap: var(--maya-space-2);
          cursor: pointer;
          font-size: var(--maya-text-sm);
          font-weight: 600;
        }

        &__cuerpo {
          display: flex;
          flex-direction: column;
          gap: var(--maya-space-3);
          margin-top: var(--maya-space-3);
        }

        &__nota {
          margin: 0;
          font-size: var(--maya-text-xs);
          color: var(--maya-text-subtle);
          line-height: var(--maya-leading-normal);
        }
      }
    `,
  ],
})
export class LiveSessionFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly live = inject(LiveService);
  private readonly coursesService = inject(CoursesService);
  private readonly toast = inject(ToastService);

  /** Sesión a editar; `null` para convocar una nueva. */
  readonly session = input<LiveSessionDto | null>(null);
  /** Fecha sugerida al abrir desde el calendario. */
  readonly startAt = input<Date | null>(null);
  /** Curso preseleccionado al abrir desde un curso. */
  readonly courseId = input<string | null>(null);

  readonly saved = output<LiveSessionDto>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  private readonly courseList = signal<CourseSummary[]>([]);
  readonly courses = this.courseList.asReadonly();
  readonly editing = computed(() => Boolean(this.session()));

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    description: [''],
    mode: [LiveSessionMode.Class as string],
    courseId: [''],
    scheduledStart: ['', [Validators.required]],
    scheduledEnd: [''],
    openToTenant: [false],
    lobby: [DEFAULT_LIVE_SETTINGS.lobby],
    muteOnJoin: [DEFAULT_LIVE_SETTINGS.muteOnJoin],
    allowChat: [DEFAULT_LIVE_SETTINGS.allowChat],
    allowWhiteboard: [DEFAULT_LIVE_SETTINGS.allowWhiteboard],
    allowAttendeeScreenShare: [DEFAULT_LIVE_SETTINGS.allowAttendeeScreenShare],
    allowAttendeeCamera: [DEFAULT_LIVE_SETTINGS.allowAttendeeCamera],
    autoRecord: [DEFAULT_LIVE_SETTINGS.autoRecord],
    recordingVisibleToStudents: [DEFAULT_LIVE_SETTINGS.recordingVisibleToStudents],
    maxParticipants: [DEFAULT_LIVE_SETTINGS.maxParticipants],
    reminderMinutes: [15],
  });

  constructor() {
    this.coursesService.myCourses({ limit: 100 }).subscribe({
      next: (result) => this.courseList.set(result.items),
    });

    queueMicrotask(() => this.prefill());
  }

  private prefill(): void {
    const session = this.session();
    if (session) {
      this.form.patchValue({
        title: session.title,
        description: session.description ?? '',
        mode: session.mode,
        courseId: session.courseId ?? '',
        scheduledStart: aEntradaLocal(new Date(session.scheduledStart)),
        scheduledEnd: session.scheduledEnd ? aEntradaLocal(new Date(session.scheduledEnd)) : '',
        openToTenant: session.openToTenant,
        ...session.settings,
      });
      return;
    }

    // Por defecto, la próxima hora en punto: convocar «ahora mismo» es lo raro.
    const inicio = this.startAt() ?? new Date();
    const arranque = new Date(inicio);
    if (!this.startAt()) arranque.setHours(arranque.getHours() + 1);
    arranque.setMinutes(0, 0, 0);
    const fin = new Date(arranque.getTime() + 60 * 60 * 1000);

    this.form.patchValue({
      scheduledStart: aEntradaLocal(arranque),
      scheduledEnd: aEntradaLocal(fin),
      courseId: this.courseId() ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      title: value.title.trim(),
      description: value.description.trim() || null,
      mode: value.mode,
      courseId: value.courseId || null,
      scheduledStart: new Date(value.scheduledStart).toISOString(),
      scheduledEnd: value.scheduledEnd ? new Date(value.scheduledEnd).toISOString() : null,
      openToTenant: value.courseId ? value.openToTenant : true,
      reminderMinutes: Number(value.reminderMinutes) || 0,
      settings: {
        lobby: value.lobby,
        muteOnJoin: value.muteOnJoin,
        allowChat: value.allowChat,
        allowWhiteboard: value.allowWhiteboard,
        allowAttendeeScreenShare: value.allowAttendeeScreenShare,
        allowAttendeeCamera: value.allowAttendeeCamera,
        autoRecord: value.autoRecord,
        recordingVisibleToStudents: value.recordingVisibleToStudents,
        maxParticipants: Number(value.maxParticipants) || DEFAULT_LIVE_SETTINGS.maxParticipants,
      },
    };

    const current = this.session();
    // Al editar no se manda `courseId` si no ha cambiado: cambiar de curso
    // reevalúa permisos y no es lo que se pretende al retocar una hora.
    const request = current
      ? this.live.update(current.id, payload)
      : this.live.create(payload);

    this.saving.set(true);
    request.subscribe({
      next: (session) => {
        this.saving.set(false);
        this.toast.success(current ? 'Sesión actualizada' : 'Sesión convocada');
        this.saved.emit(session);
      },
      error: () => this.saving.set(false),
    });
  }
}

/** Fecha en el formato que espera `<input type="datetime-local">`. */
function aEntradaLocal(date: Date): string {
  const desfase = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - desfase).toISOString().slice(0, 16);
}
