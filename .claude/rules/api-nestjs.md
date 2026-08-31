---
paths:
  - "apps/api/**/*.ts"
---

# API · NestJS 11 + Mongoose

## Forma de un módulo

Cada módulo de `apps/api/src/modules/<nombre>/` reúne:

```
<nombre>.module.ts       @Module con MongooseModule.forFeature y exports
<nombre>.controller.ts   rutas, Swagger y capacidades
<nombre>.service.ts      lógica y acceso a datos
dto/<nombre>.dto.ts      clases con class-validator + @ApiProperty
schemas/<nombre>.schema.ts  @Schema de Mongoose
```

Los módulos que otros consumen se declaran `@Global()` y exportan también
`MongooseModule`, para que los modelos estén disponibles sin volver a
registrarlos.

## Esquemas

Heredar de `TenantScopedDocument` (en `common/schemas/base.schema.ts`) todo lo
que pertenezca a una empresa; de `BaseDocument` solo lo verdaderamente global.
La base aporta `tenant`, `deletedAt`, `createdBy`/`updatedBy` y `timestamps`.

La serialización a `id` (en lugar de `_id`) la garantiza el complemento global
registrado en `DatabaseModule`, no el decorador de la clase base:
`SchemaFactory.createForClass` solo lee el decorador de la clase concreta. No
duplicar esas opciones en cada esquema.

Indexar `tenant` y todo campo por el que se filtre o se ordene.

## Aislamiento multiempresa

Es el invariante más importante de la API: **toda** consulta sobre una
colección con `tenant` filtra por él, incluidas las de actualización y borrado.
Un `findById` sin `tenant` deja que una empresa lea documentos de otra con solo
adivinar un identificador.

```ts
// Correcto
const curso = await this.model.findOne({ _id: id, tenant, deletedAt: null });
```

## Autorización

Las rutas se protegen con `@RequireCapability(CAP.X, { contextLevel, param })`,
nunca comprobando el rol a mano. `contextLevel` indica dónde se evalúa la
capacidad y `param` el parámetro de ruta que identifica el contexto:

```ts
@RequireCapability(CAP.COURSE_UPDATE, { contextLevel: ContextLevel.Course, param: 'courseId' })
```

`platformAdmin` es la excepción: es un indicador del usuario, no una capacidad,
porque el RBAC por contexto daría verdadero a cualquier gestor de empresa.

## DTO

Toda entrada se valida con `class-validator` y se documenta con
`@ApiProperty`/`@ApiPropertyOptional`. El `ValidationPipe` global usa
`whitelist` y `forbidNonWhitelisted`: un campo sin decorador de validación no
llega al servicio, y si el cliente lo envía la petición se rechaza. Para las
actualizaciones, `PartialType(CreateXDto)` en lugar de reescribir el DTO.

## Respuestas

`TransformInterceptor` envuelve todo en `{ success, data }`. Los servicios y
controladores devuelven el dato pelado; no construir el sobre a mano.

## TypeScript

`import type` para cualquier importación de solo tipo (lo exige el
transpilador de Bun, ver CLAUDE.md). `any` está prohibido por ESLint: usar
`unknown` y estrechar.

## Pruebas

`bun test` desde `apps/api`. Las pruebas existentes son de servicio, con dobles
de los modelos de Mongoose; seguir ese patrón antes que levantar un módulo Nest
completo.
