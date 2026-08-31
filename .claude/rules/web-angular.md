---
paths:
  - "apps/web/src/**/*.ts"
  - "apps/web/src/**/*.html"
---

# Cliente · Angular 22 sin zonas

La aplicación arranca con `provideZonelessChangeDetection()`. No hay Zone.js:
la detección de cambios la disparan las **señales**. Mutar un campo corriente
de una clase no repinta nada.

## Componentes

Standalone (no hay `NgModule`), `ChangeDetectionStrategy.OnPush`, y las
dependencias con `inject()` en lugar de constructor:

```ts
@Component({
  selector: 'maya-cursos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './courses.page.html',
  styleUrl: './courses.page.scss',
})
export class CoursesPage {
  private readonly courses = inject(CoursesService);
  readonly items = signal<CourseSummary[]>([]);
  readonly loading = signal(true);
}
```

- Estado propio → `signal()`.
- Estado derivado → `computed()`, nunca un getter: el getter se reevalúa en
  cada repintado y no participa en el grafo de dependencias.
- Entradas y salidas → `input()` / `input.required()` / `output()`, no los
  decoradores `@Input`/`@Output`.
- Efectos → `effect()`, y solo para sincronizar con el mundo exterior (DOM,
  almacenamiento, título de la página). Derivar datos dentro de un efecto es
  la señal de que hacía falta un `computed`.

## Plantillas

Sintaxis de control de flujo integrada: `@if`, `@for` (siempre con `track`),
`@switch`, `@defer`. No usar `*ngIf` ni `*ngFor`.

`@for (item of items(); track item.id)` — invocar la señal, y elegir como
`track` una clave estable; con `$index` Angular recrea nodos al reordenar.

## Servicios y datos

`ApiService` desenvuelve el sobre `{ success, data }` de la API: los servicios
de dominio devuelven ya el dato. Los tipos de las respuestas vienen de
`@maya/shared`; no redeclararlos en el cliente.

Los servicios son `@Injectable({ providedIn: 'root' })`.

## Rutas

En `app.routes.ts`, siempre con `loadComponent`/`loadChildren` para que cada
pantalla sea un fragmento aparte. Protegidas con los guards de
`core/guards`. Una pantalla nueva que deba aparecer en el menú se añade a
`layout/nav-items.ts`, con `capabilities` si su acceso está restringido.

## Capacidades en la interfaz

`auth.can(CAP.X)` y `auth.canAny([...])` deciden qué se muestra. Ocultar un
botón no es una medida de seguridad: la API vuelve a comprobar la capacidad.

## Interfaz

Mobile-first: el estilo base es el del móvil y crece con los mixins `from()`,
`app-only()` y `desktop-only()` de `styles/_tokens.scss`. Detalles del sistema
visual en `.claude/rules/design-system.md`.
