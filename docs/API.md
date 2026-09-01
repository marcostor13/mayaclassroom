# API de Maya Classroom

Base: `/api/v1`. Todas las respuestas correctas llegan envueltas:

```json
{ "success": true, "data": { }, "requestId": "…", "timestamp": "…" }
```

y los errores:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "No tiene el permiso «moodle/course:update» en este contexto.",
  "error": "ForbiddenException",
  "path": "/api/v1/courses/…",
  "timestamp": "…"
}
```

Autenticación por `Authorization: Bearer <accessToken>`; la empresa activa viaja
en la cabecera `x-maya-tenant`.

La referencia completa e interactiva está en **`/api/docs`** (OpenAPI 3).

---

## Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Acceder (admite `totp` si hay 2FA) |
| `POST` | `/auth/register` | Registro autónomo si la empresa lo permite |
| `POST` | `/auth/refresh` | Rotar el token de refresco |
| `POST` | `/auth/logout` · `/auth/logout-all` | Cerrar sesión |
| `GET` | `/auth/me` | Sesión con roles y capacidades efectivas |
| `GET`/`DELETE` | `/auth/sessions[/:id]` | Dispositivos con sesión abierta |
| `POST` | `/auth/forgot-password` · `/auth/reset-password` | Recuperación |
| `POST` | `/auth/change-password` | Cambiar la propia contraseña |
| `POST` | `/auth/2fa/setup` · `/2fa/confirm` · `/2fa/disable` | Segundo factor |

## Empresas y usuarios

| Método | Ruta | Capacidad |
|---|---|---|
| `GET` | `/tenants/public/:slug` | pública |
| `GET`/`PATCH` | `/tenants/me` | `maya/tenant:update` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/tenants[/:id]` | administrador de plataforma |
| `GET`/`POST` | `/users` | `maya/tenant:manageusers`, `moodle/user:create` |
| `GET`/`PATCH` | `/users/me[/preferences]` | autenticado |
| `PATCH`/`DELETE` | `/users/:id[/status]` | `moodle/user:update`, `:delete` |

### Alta de empresa

`POST /tenants` da de alta la empresa **y** la cuenta con la que se
administrará: un usuario con rol `manager` y una contraseña temporal. La
respuesta es `{ tenant, admin }`; la contraseña en claro viaja solo ahí y en el
correo de bienvenida, no se almacena ni se puede recuperar después. Los campos
`adminEmail`, `adminUsername`, `adminFirstName` y `adminLastName` son
opcionales: sin ellos se usa el correo de contacto de la empresa.

Si la cuenta de administración no se puede crear, el alta se deshace por
completo: una empresa sin nadie que pueda entrar dejaría su identificador
ocupado para siempre.

### Contraseñas temporales

Una cuenta creada así lleva `mustChangePassword`. Mientras esté activa, la API
responde `403` con `error: "PasswordChangeRequired"` a **todo** salvo
`GET /auth/me`, `POST /auth/change-password` y `POST /auth/logout[-all]`. El
cambio de contraseña levanta la marca y revoca todas las sesiones abiertas, de
modo que el siguiente acceso ya usa la contraseña propia.

## Roles y permisos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/rbac/capabilities` | Catálogo completo de capacidades |
| `GET`/`POST`/`PATCH`/`DELETE` | `/rbac/roles[/:id]` | Gestión de roles |
| `GET`/`PATCH` | `/rbac/roles/:id/capabilities` | Matriz de permisos |
| `GET`/`POST`/`DELETE` | `/rbac/assignments` | Asignar roles en contextos |
| `POST` | `/rbac/check` | Comprobar capacidades del usuario |

## Cursos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/courses` · `/courses/my` | Listado y cursos propios con progreso |
| `GET` | `/courses/:id` · `/courses/:id/contents` | Ficha y contenido filtrado |
| `POST`/`PATCH`/`DELETE` | `/courses[/:id]` | Gestión del curso |
| `GET`/`POST`/`PATCH`/`DELETE` | `/courses/:id/sections[/:sectionId]` | Secciones |
| `POST`/`PATCH`/`DELETE` | `/courses/:id/modules[/:moduleId]` | Actividades |
| `PATCH` | `/courses/:id/modules/:moduleId/move` | Reordenar |
| `GET` | `/courses/activity-types` | Catálogo de actividades disponibles |

## Matriculación y grupos

`/courses/:courseId/enrolments`, `/enrolments/self`, `/enrolments/methods`,
`/courses/:courseId/groups`, `/courses/:courseId/groupings`.

## Actividades

| Módulo | Rutas principales |
|---|---|
| Tarea | `/mod/assign/:moduleId`, `/submit`, `/submissions`, `/submissions/:id/grade`, `/extensions` |
| Cuestionario | `/mod/quiz/:moduleId`, `/attempts`, `/attempts/:id/questions`, `/responses`, `/finish`, `/statistics` |
| Foro | `/mod/forum/:moduleId`, `/discussions`, `/discussions/:id/posts`, `/subscription` |
| Consulta | `/mod/choice/:moduleId`, `/answer`, `/responses` |
| Encuesta | `/mod/feedback/:moduleId`, `/submit`, `/analysis` |
| Recursos | `/mod/resource/:moduleId`, `/chapters` |
| Avanzadas | `/mod/advanced/:moduleId`, `/entries`, `/entries/:id/grade` |

## Calificaciones

`/courses/:courseId/grades/items`, `/categories`, `/report`, `/me`,
`/users/:userId`, `/items/:itemId/grade`, `/letters`, `/export`.

## Comunicación

`/calendar/events`, `/calendar/upcoming`, `/calendar/export.ics`,
`/messages/conversations`, `/notifications`, `/notifications/preferences`.

## Avanzado (Fase 3)

`/cohorts`, `/competencies`, `/badges`, `/certificates`, `/custom-fields`,
`/tags`, `/web-services/tokens`, `/web-services/webhooks`, `/privacy/requests`,
`/backups`, `/analytics/courses/:courseId`, `/logs`.

---

## Códigos de estado

| Código | Significado |
|---|---|
| `200` / `201` | Correcto |
| `400` | Datos inválidos (detalle en `details`) |
| `401` | Sin sesión o token caducado |
| `403` | Capacidad insuficiente o empresa incorrecta |
| `404` | Recurso inexistente |
| `409` | Conflicto (duplicado o dependencias) |
| `429` | Límite de peticiones superado |
