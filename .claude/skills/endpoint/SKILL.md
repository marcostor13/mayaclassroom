---
name: endpoint
description: Añade un endpoint a la API NestJS de Maya Classroom de punta a punta — esquema Mongoose, DTO validado, servicio con filtro por empresa, controlador con capacidad y Swagger, contrato en @maya/shared y, si hace falta, el servicio del cliente Angular. Úsalo siempre que haya que crear, ampliar o exponer una ruta de la API, cuando el usuario pida "añade un endpoint", "crea el CRUD de X", "expón esto en la API", "hace falta una ruta para…" o describa una funcionalidad del backend que hoy no existe. Úsalo también al añadir un módulo nuevo a apps/api/src/modules.
argument-hint: "[recurso] [método y ruta]"
allowed-tools: Bash Read Grep Glob Edit Write
---

# Añadir un endpoint

La API es multiempresa y con permisos por contexto. Los dos errores que más
caros salen son olvidar el filtro por `tenant` (fuga de datos entre empresas) y
proteger la ruta comprobando el rol a mano en lugar de declarar la capacidad.
Este procedimiento existe para que ninguno de los dos se cuele.

## 1 · Partir de un módulo existente

Antes de escribir nada, leer el módulo más parecido al que vas a tocar y
copiar su estructura. `apps/api/src/modules/courses/` es una referencia
completa (esquemas, DTO, servicio, controlador, capacidades). Encajar con lo
que ya hay vale más que cualquier plantilla.

## 2 · Contrato compartido

Si el cliente va a consumir la respuesta, su tipo va en `packages/shared` y no
se redeclara en ninguno de los dos lados. Exportarlo desde `src/index.ts` y
recompilar:

```bash
bun run build:shared
```

Una capacidad nueva se añade a `constants/capabilities.ts` y se usa siempre
como `CAP.NOMBRE`.

## 3 · Esquema

En `schemas/`, heredando de `TenantScopedDocument` si el documento pertenece a
una empresa (casi siempre). Indexar `tenant` y todo campo por el que se vaya a
filtrar u ordenar. La serialización a `id` la resuelve el complemento global de
`DatabaseModule`; no repetir las opciones `toJSON` en el esquema.

## 4 · DTO

En `dto/`, con `class-validator` y `@ApiProperty`/`@ApiPropertyOptional`. El
`ValidationPipe` global usa `whitelist` y `forbidNonWhitelisted`: **un campo sin
decorador de validación nunca llega al servicio**, y si el cliente lo envía la
petición entera se rechaza. Para la actualización, `PartialType(CreateXDto)`.

## 5 · Servicio

Recibe `tenantId` y lo aplica en toda consulta, también en las de actualizar y
borrar:

```ts
async findOne(tenant: Types.ObjectId, id: string) {
  const doc = await this.model.findOne({ _id: id, tenant, deletedAt: null });
  if (!doc) throw new NotFoundException('…');
  return doc;
}
```

Un `findById(id)` a secas permite que una empresa lea documentos de otra
adivinando un identificador. Es el fallo más grave que se puede cometer aquí.

## 6 · Controlador

```ts
@Get(':id')
@ApiOperation({ summary: 'Obtener …' })
@RequireCapability(CAP.X_VIEW, { contextLevel: ContextLevel.Course, param: 'id' })
async findOne(@CurrentUser() user: RequestUser, @Param('id') id: string) {
  return this.service.findOne(user.tenantId, id);
}
```

- `contextLevel` marca dónde se evalúa la capacidad y `param` el parámetro de
  ruta que identifica la instancia; sin `param` se evalúa en el contexto de la
  empresa.
- Devolver el dato pelado: `TransformInterceptor` añade el sobre
  `{ success, data }`.
- Las acciones que deban quedar registradas llevan además `@Audit(LogAction.X)`.
- Solo el ámbito de plataforma usa el indicador `platformAdmin` en lugar de una
  capacidad, porque el RBAC por contexto daría verdadero a cualquier gestor.

## 7 · Registrar el módulo

En `<nombre>.module.ts`: `MongooseModule.forFeature` con los esquemas,
declarar controlador y servicios, y exportar lo que otros módulos necesiten
(incluido `MongooseModule` si van a usar el modelo). Añadirlo a `app.module.ts`
si es nuevo.

## 8 · Cliente

Si la pantalla ya existe, ampliar el servicio de `apps/web/src/app/core/services/`
usando `ApiService`, que ya desenvuelve el sobre. Si hay que crear la pantalla,
seguir con `/pantalla`.

## 9 · Verificar

Una prueba de servicio en `<nombre>.service.spec.ts` siguiendo el patrón de las
existentes (dobles de los modelos de Mongoose, sin levantar un módulo Nest
completo), y después `/verificar`.

La documentación interactiva queda en `http://localhost:3000/api/docs`.
