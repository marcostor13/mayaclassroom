import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Avatar con imagen o iniciales de respaldo. */
@Component({
  selector: 'maya-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'maya-avatar',
    '[class.maya-avatar--xs]': "size() === 'xs'",
    '[class.maya-avatar--sm]': "size() === 'sm'",
    '[class.maya-avatar--lg]': "size() === 'lg'",
    '[class.maya-avatar--xl]': "size() === 'xl'",
    '[attr.title]': 'name()',
  },
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="name()" loading="lazy" />
    } @else {
      <span aria-hidden="true">{{ initials() }}</span>
      <span class="maya-sr-only">{{ name() }}</span>
    }
  `,
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly src = input<string | null>(null);
  readonly size = input<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');

  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  });
}
