import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CourseModuleDto, FileRef, ModuleType } from '@maya/shared';
import { ActivitiesService } from '../../core/services/activities.service';
import { FileSizePipe, IconComponent, SafeHtmlPipe } from '../../shared';

interface ResourceData {
  id: string;
  kind: ModuleType;
  name: string;
  intro: string | null;
  content: string | null;
  externalUrl: string | null;
  display: string;
  files: FileRef[];
  chapters?: { id: string; title: string; content: string; subChapter: boolean }[];
}

/** Visor unificado de recursos: archivo, carpeta, página, URL, libro y etiqueta. */
@Component({
  selector: 'maya-resource',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, SafeHtmlPipe, FileSizePipe],
  templateUrl: './resource.page.html',
  styleUrl: './activity.shared.scss',
})
export class ResourcePage {
  private readonly route = inject(ActivatedRoute);
  private readonly activities = inject(ActivitiesService);

  readonly ModuleType = ModuleType;
  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly module = signal<CourseModuleDto | null>(null);
  readonly resource = signal<ResourceData | null>(null);
  readonly loading = signal(true);
  readonly chapter = signal(0);

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
