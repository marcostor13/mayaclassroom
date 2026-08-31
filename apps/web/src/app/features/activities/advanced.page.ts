import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseModuleDto, ModuleType } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent, RelativeTimePipe, SafeHtmlPipe } from '../../shared';

interface AdvancedActivityData {
  id: string;
  kind: ModuleType;
  name: string;
  intro: string | null;
  gradeMax: number | null;
  settings: Record<string, unknown>;
  structure: AdvancedEntryData[];
}

interface AdvancedEntryData {
  id: string;
  entryType: string;
  title: string | null;
  content: string | null;
  author?: { id: string; fullName: string; avatarUrl: string | null };
  createdAt: string;
  grade: number | null;
}

/** Configuración de presentación de cada tipo de actividad avanzada. */
const KIND_CONFIG: Record<
  string,
  { icon: string; entryType: string; entryLabel: string; addLabel: string; structural: boolean }
> = {
  [ModuleType.Lesson]: {
    icon: 'route',
    entryType: 'page',
    entryLabel: 'Páginas de la lección',
    addLabel: 'Añadir página',
    structural: true,
  },
  [ModuleType.Glossary]: {
    icon: 'book-a',
    entryType: 'entry',
    entryLabel: 'Entradas del glosario',
    addLabel: 'Añadir entrada',
    structural: false,
  },
  [ModuleType.Wiki]: {
    icon: 'network',
    entryType: 'page',
    entryLabel: 'Páginas del wiki',
    addLabel: 'Crear página',
    structural: false,
  },
  [ModuleType.Workshop]: {
    icon: 'users-round',
    entryType: 'submission',
    entryLabel: 'Entregas del taller',
    addLabel: 'Enviar mi trabajo',
    structural: false,
  },
  [ModuleType.Database]: {
    icon: 'database',
    entryType: 'record',
    entryLabel: 'Registros',
    addLabel: 'Añadir registro',
    structural: false,
  },
  [ModuleType.Chat]: {
    icon: 'messages-square',
    entryType: 'message',
    entryLabel: 'Conversación',
    addLabel: 'Enviar mensaje',
    structural: false,
  },
  [ModuleType.Scorm]: {
    icon: 'package',
    entryType: 'attempt',
    entryLabel: 'Intentos SCORM',
    addLabel: 'Registrar intento',
    structural: false,
  },
  [ModuleType.Lti]: {
    icon: 'plug',
    entryType: 'launch',
    entryLabel: 'Lanzamientos',
    addLabel: 'Abrir herramienta',
    structural: false,
  },
  [ModuleType.H5p]: {
    icon: 'puzzle',
    entryType: 'attempt',
    entryLabel: 'Intentos',
    addLabel: 'Registrar intento',
    structural: false,
  },
  [ModuleType.Survey]: {
    icon: 'bar-chart-3',
    entryType: 'response',
    entryLabel: 'Respuestas',
    addLabel: 'Responder',
    structural: false,
  },
  [ModuleType.Attendance]: {
    icon: 'user-check',
    entryType: 'session',
    entryLabel: 'Sesiones',
    addLabel: 'Registrar sesión',
    structural: true,
  },
};

/** Pantalla genérica para las actividades avanzadas de la Fase 3. */
@Component({
  selector: 'maya-advanced-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, SafeHtmlPipe, RelativeTimePipe],
  templateUrl: './advanced.page.html',
  styleUrl: './activity.shared.scss',
})
export class AdvancedActivityPage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly toast = inject(ToastService);

  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly activity = signal<AdvancedActivityData | null>(null);
  readonly entries = signal<AdvancedEntryData[]>([]);
  readonly loading = signal(true);

  readonly composing = signal(false);
  readonly title = signal('');
  readonly content = signal('');

  readonly config = computed(() => {
    const kind = this.activity()?.kind;
    return kind ? (KIND_CONFIG[kind] ?? KIND_CONFIG[ModuleType.Glossary]) : null;
  });

  constructor() {
    this.activities.advanced(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.activity.set(data.activity as unknown as AdvancedActivityData);
        this.loading.set(false);
        this.loadEntries();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadEntries(): void {
    const config = this.config();
    if (!config) return;
    this.activities.advancedEntries(this.moduleId, config.entryType).subscribe({
      next: (list) => this.entries.set(list as unknown as AdvancedEntryData[]),
    });
  }

  create(): void {
    const config = this.config();
    if (!config || (!this.title().trim() && !this.content().trim())) return;

    this.activities
      .addAdvancedEntry(this.moduleId, {
        entryType: config.entryType,
        title: this.title(),
        content: this.content(),
        structural: config.structural,
      })
      .subscribe({
        next: () => {
          this.title.set('');
          this.content.set('');
          this.composing.set(false);
          this.loadEntries();
          this.toast.success('Aportación guardada');
        },
      });
  }
}
