import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CAP,
  CourseModuleDto,
  FileRef,
  LessonBlock,
  LessonBlockType,
  ModuleType,
} from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import {
  FileAttachmentsComponent,
  IconComponent,
  LessonEditorComponent,
  LessonViewComponent,
  SafeHtmlPipe,
} from '../../shared';

interface ResourceData {
  id: string;
  kind: ModuleType;
  name: string;
  intro: string | null;
  content: string | null;
  /** Lección por bloques. Vacía en las páginas escritas antes de existir. */
  blocks?: LessonBlock[];
  externalUrl: string | null;
  display: string;
  files: FileRef[];
  chapters?: { id: string; title: string; content: string; subChapter: boolean }[];
}

/**
 * Recursos: archivo, carpeta, página, URL, libro y etiqueta.
 *
 * La misma pantalla ve y edita. Separarlas en dos rutas obligaría a ir y venir
 * para comprobar cómo queda lo escrito, que es justo lo que más se repite al
 * montar un curso; aquí se alterna con un botón y el contenido no se mueve de
 * sitio.
 */
@Component({
  selector: 'maya-resource',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    FileAttachmentsComponent,
    LessonEditorComponent,
    LessonViewComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './resource.page.html',
  styleUrl: './activity.shared.scss',
})
export class ResourcePage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly ModuleType = ModuleType;
  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly resource = signal<ResourceData | null>(null);
  readonly loading = signal(true);
  readonly chapter = signal(0);

  /** Solo quien puede gestionar actividades ve el botón de editar. */
  readonly canEdit = computed(() => this.auth.can(CAP.COURSE_MANAGE_ACTIVITIES));

  readonly editing = signal(false);
  readonly saving = signal(false);

  /** Borrador: se trabaja sobre una copia para poder descartar los cambios. */
  readonly draftName = signal('');
  readonly draftIntro = signal('');
  readonly draftContent = signal('');
  readonly draftUrl = signal('');
  readonly draftFiles = signal<FileRef[]>([]);
  readonly draftBlocks = signal<LessonBlock[]>([]);

  constructor() {
    this.activities.resource(this.moduleId).subscribe({
      next: (data) => {
        this.module.set(data.module);
        this.resource.set(data.resource as unknown as ResourceData);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  startEditing(): void {
    const resource = this.resource();
    if (!resource) return;
    this.draftName.set(resource.name);
    this.draftIntro.set(resource.intro ?? '');
    this.draftContent.set(resource.content ?? '');
    this.draftUrl.set(resource.externalUrl ?? '');
    this.draftFiles.set(resource.files ?? []);

    // Una página escrita antes de existir los bloques se convierte al abrirla:
    // su HTML pasa a ser el primer bloque de texto, y a partir de ahí se edita
    // como cualquier otra. Así no hay dos formas de editar conviviendo ni se
    // pierde nada de lo ya escrito.
    const bloques = resource.blocks ?? [];
    this.draftBlocks.set(
      bloques.length
        ? bloques
        : resource.content
          ? [
              {
                id: `b${Date.now().toString(36)}`,
                type: LessonBlockType.Text,
                content: resource.content,
              },
            ]
          : [],
    );
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
  }

  save(): void {
    const resource = this.resource();
    if (!resource || this.saving()) return;

    this.saving.set(true);
    this.activities
      .updateResource(this.moduleId, {
        name: this.draftName().trim() || resource.name,
        intro: this.draftIntro(),
        blocks: this.draftBlocks(),
        externalUrl: this.draftUrl() || undefined,
        fileIds: this.draftFiles().map((file) => file.id),
      })
      .subscribe({
        next: (updated) => {
          this.resource.set(updated as unknown as ResourceData);
          this.saving.set(false);
          this.editing.set(false);
          this.toast.success('Contenido guardado');
        },
        error: () => this.saving.set(false),
      });
  }

  /** ¿Este tipo de recurso tiene cuerpo de texto? */
  hasBody(kind: ModuleType): boolean {
    return kind === ModuleType.Page || kind === ModuleType.Label || kind === ModuleType.Book;
  }

  icon(kind: ModuleType): string {
    const map: Record<string, string> = {
      [ModuleType.Resource]: 'file',
      [ModuleType.Folder]: 'folder',
      [ModuleType.Page]: 'file-text',
      [ModuleType.Url]: 'link',
      [ModuleType.Book]: 'book-open',
      [ModuleType.Label]: 'tag',
    };
    return map[kind] ?? 'file';
  }
}
