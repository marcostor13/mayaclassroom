---
name: pantalla
description: Añade una pantalla al cliente Angular 22 de Maya Classroom — componente standalone con señales y OnPush, ruta perezosa con guard, servicio de datos, entrada de menú con capacidades y estilos mobile-first del sistema de diseño. Úsalo siempre que haya que crear una vista, página o sección nueva de la interfaz, cuando el usuario pida "añade una pantalla", "crea la página de X", "quiero una vista para…", "añádelo al menú", o describa una funcionalidad de interfaz que hoy no existe. Úsalo también al crear un componente nuevo bajo apps/web/src/app/features.
argument-hint: "[nombre de la pantalla]"
allowed-tools: Bash Read Grep Glob Edit Write
---

# Añadir una pantalla

El cliente arranca **sin zonas** (`provideZonelessChangeDetection()`). No hay
Zone.js: la detección de cambios la disparan las señales, así que un campo
corriente mutado no repinta nada. Casi todo lo que sale mal en una pantalla
nueva viene de ahí.

## 1 · Copiar una pantalla parecida

`features/courses/courses.page.ts` es una referencia completa: señales, estado
derivado, filtros, estado de carga y estado vacío. Encajar con lo que ya hay
importa más que cualquier plantilla en abstracto.

## 2 · El componente

En `features/<área>/<nombre>.page.ts`, con su `.html` y, si hace falta, su
`.scss`:

```ts
@Component({
  selector: 'maya-<nombre>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, EmptyStateComponent],
  templateUrl: './<nombre>.page.html',
  styleUrl: './<nombre>.page.scss',
})
export class <Nombre>Page {
  private readonly api = inject(<X>Service);
  readonly auth = inject(AuthService);

  readonly items = signal<X[]>([]);
  readonly loading = signal(true);
  readonly search = signal('');

  readonly visible = computed(() => { /* deriva de items() y search() */ });
  readonly canCreate = computed(() => this.auth.can(CAP.X_CREATE));
}
```

- Estado propio en `signal()`, derivado en `computed()`. Un *getter* parece
  equivalente pero se reevalúa en cada repintado y no entra en el grafo de
  dependencias.
- Dependencias con `inject()`, no por constructor.
- `effect()` solo para sincronizar con el exterior (DOM, almacenamiento,
  título). Si estás derivando datos dentro de un efecto, querías un `computed`.

## 3 · Plantilla

Control de flujo integrado, nunca las directivas antiguas:

```html
@if (loading()) {
  <div class="maya-skeleton" style="height: 120px"></div>
} @else if (visible().length) {
  @for (item of visible(); track item.id) { … }
} @else {
  <maya-empty-state icon="inbox" title="…" />
}
```

`track` con una clave estable: con `$index` Angular recrea los nodos al
reordenar y se pierde el estado de los hijos.

## 4 · Datos

Ampliar o crear el servicio en `core/services/` sobre `ApiService`, que ya
desenvuelve el sobre `{ success, data }`. Los tipos de la respuesta vienen de
`@maya/shared`; no redeclararlos aquí. Si el endpoint todavía no existe,
crearlo antes con `/endpoint`.

## 5 · Ruta

En `app.routes.ts`, siempre perezosa para que la pantalla sea un fragmento
aparte, y con el guard que corresponda:

```ts
{
  path: 'mi-pantalla',
  loadComponent: () => import('./features/…/mi.page').then((m) => m.MiPage),
  canActivate: [authGuard],
}
```

## 6 · Menú

Si va en la navegación, añadir la entrada a `layout/nav-items.ts`:

```ts
{
  label: 'Mi pantalla',
  shortLabel: 'Mía',        // para la barra inferior; caben ~10 caracteres
  icon: 'layers',           // del conjunto de icon.component.ts
  route: '/mi-pantalla',
  group: 'principal',
  capabilities: [CAP.X_VIEW],
  mobile: true,             // candidata a la barra inferior
}
```

La barra inferior solo tiene cuatro ranuras: la quinta es «Más», y todo lo que
no cabe pasa a esa hoja automáticamente. Marcar `mobile: true` no garantiza
sitio, y el orden del array decide.

## 7 · Estilos

Mobile-first: escribir el caso móvil y ampliarlo con los mixins `from()`,
`app-only()` y `desktop-only()`. Reutilizar las clases del sistema
(`maya-card`, `maya-btn`, `maya-chips`, `maya-icon-tile`, `maya-row-item`,
`maya-page-header`) antes de escribir CSS nuevo, y no introducir colores en
crudo: solo variables `--maya-*`. Los detalles están en
`.claude/rules/design-system.md`, que se carga solo al abrir un `.scss`.

## 8 · Verificar

`/revisar-ui` para ver el resultado sin necesidad de base de datos, y
`/verificar` para la cadena completa.
