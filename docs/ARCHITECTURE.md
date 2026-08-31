# Arquitectura de Maya Classroom

Documento técnico de referencia: cómo está organizado el sistema, por qué se ha
diseñado así y dónde tocar cada cosa.

---

## 1. Visión general

```
┌───────────────────────┐        HTTPS/JSON        ┌────────────────────────┐
│  Angular 22 (web)     │ ───────────────────────► │  NestJS 11 (api)       │
│  · señales, zoneless  │ ◄─────────────────────── │  · guards por capacidad│
│  · design tokens SCSS │      sobre uniforme      │  · Mongoose + Atlas    │
└───────────┬───────────┘                          └───────────┬────────────┘
            │                                                  │
            └──────────────  @maya/shared  ────────────────────┘
                    contratos, enums, capacidades y roles
```

`@maya/shared` es la pieza clave: publica los DTO, los *enums* de dominio, el
catálogo completo de capacidades y la definición de los roles arquetípicos. La
API y el cliente compilan contra el mismo contrato, de modo que cualquier
cambio incompatible se detecta en tiempo de compilación.

Se distribuye en doble formato (CJS para NestJS, ESM para el empaquetador de
Angular) para no provocar *bailouts* de optimización en el cliente.

---

## 2. Modelo de datos

### 2.1 Contextos

`contexts` materializa el árbol de contextos con una **ruta** (`path`) del tipo
`/<system>/<tenant>/<category>/<course>/`. Con eso, resolver la herencia de
permisos es una sola consulta: se parte la ruta en identificadores y se buscan
las asignaciones de rol cuyo contexto esté en esa lista.

| Nivel | Instancia | Padre |
|---|---|---|
| `system` | — | — |
| `tenant` | `Tenant` | `system` |
| `category` | `Category` | `tenant` o `category` |
| `course` | `Course` | `category` |
| `module` | `CourseModule` | `course` |
| `user` | `User` | `tenant` |

### 2.2 Permisos

- `roles` — rol de la empresa (o global si `tenant` es `null`).
- `role_capabilities` — valor de cada capacidad para un rol; si `context` no es
  `null`, se trata de una **anulación** (*override*) en ese contexto.
- `role_assignments` — usuario × rol × contexto, con copia desnormalizada de la
  ruta para acelerar la resolución.

`AccessService.resolvePermission()` implementa el algoritmo:

1. Recoger las asignaciones del usuario en la rama del contexto pedido.
2. Buscar el valor de la capacidad para esos roles (base + anulaciones).
3. `PROHIBIT` gana siempre; si no, gana el valor definido en el contexto más
   profundo, y las anulaciones pesan más que la definición base del rol.

### 2.3 Estructura académica

```
Category (árbol) → Course → CourseSection → CourseModule → instancia de actividad
```

`CourseModule` es la pieza polimórfica: guarda `moduleType` + `instance`. Cada
tipo de actividad implementa `ActivityHandler` y se registra en
`ActivityRegistry` al arrancar. Añadir una actividad nueva no requiere tocar el
módulo de cursos.

### 2.4 Aislamiento multiempresa

Toda colección de dominio hereda de `TenantScopedDocument` (campo `tenant` con
índice) o está colgada de un curso que sí lo tiene. El `TenantGuard` rechaza
cualquier petición cuya cabecera `x-maya-tenant` no coincida con la del usuario,
salvo administradores de plataforma.

---

## 3. API

### 3.1 Cadena de una petición

```
Helmet → CORS → compresión
  → ThrottlerGuard        (límite de peticiones)
  → JwtAuthGuard          (salvo @Public)
  → TenantGuard           (aislamiento entre empresas)
  → CapabilityGuard       (@RequireCapability / @PlatformAdminOnly)
  → ValidationPipe        (class-validator, whitelist)
  → Controlador
  → TransformInterceptor  ({ success, data, requestId, timestamp })
  → AuditInterceptor      (@Audit → log de eventos)
  → AllExceptionsFilter   (errores normalizados)
```

### 3.2 Autenticación

- Contraseñas con **Argon2id**.
- **Access token** JWT de corta vida + **refresh token** opaco de 384 bits,
  almacenado solo como hash SHA-256.
- **Rotación con detección de reuso**: cada refresco revoca el token anterior;
  si llega uno ya revocado se invalida toda la familia.
- 2FA TOTP opcional con códigos de recuperación de un solo uso.
- Verificación de correo y recuperación de contraseña con enlaces caducables.

### 3.3 Módulos

| Fase | Módulos |
|---|---|
| 1 | `contexts`, `rbac`, `tenants`, `users`, `auth`, `mail`, `files`, `logs`, `health` |
| 2 | `categories`, `courses`, `enrolments`, `groups`, `completion`, `availability`, `grades`, `questions`, `activities/*`, `calendar`, `notifications`, `messaging`, `dashboard` |
| 3 | `cohorts`, `competencies`, `badges`, `certificates`, `platform` (campos personalizados, etiquetas, comentarios, servicios web, RGPD, copias de seguridad, analíticas, tareas programadas) |

### 3.4 Subsistemas destacados

**Libro de calificaciones.** `GradesService` implementa las estrategias de
agregación de Moodle (media, media ponderada, natural, mediana, mínimo, máximo,
moda, suma), categorías anidadas, escalas, letras y descarte de las peores notas.

**Restricción de acceso.** `AvailabilityService` evalúa el árbol JSON de
condiciones con los operadores `&`, `|`, `!&` y `!|`, admitiendo condiciones de
fecha, calificación, finalización, grupo, agrupamiento y perfil, y devuelve el
texto explicativo que ve el alumnado.

**Finalización.** `CompletionService` gestiona la finalización manual y
automática (ver, entregar, intentar, calificar, aprobar, número de mensajes) y
recalcula el progreso del curso, emitiendo `course.completed` para que otros
módulos —como las insignias— reaccionen.

**Ficheros.** Réplica simplificada de la *Files API*: cada fichero pertenece a un
contexto, un componente y un área, lo que permite adjuntar archivos a cualquier
entidad sin acoplar colecciones. Controladores `local` y `s3` intercambiables.

---

## 4. Cliente Angular

### 4.1 Decisiones

- **Zoneless** (`provideZonelessChangeDetection`) y estado con **señales**.
- Componentes **standalone** y rutas con `loadComponent` (carga diferida real:
  el paquete inicial ronda los 95 kB comprimidos).
- Interceptores funcionales: `authInterceptor` (token, empresa y refresco
  automático con cola de espera) y `errorInterceptor` (mensajes legibles).
- `provideAppInitializer` restaura la sesión y la marca de la empresa **antes**
  de que se evalúen los guards.

### 4.2 Sistema de diseño

`src/styles/` contiene tres capas:

1. `_tokens.scss` — variables CSS de color, espaciado, radios, sombras,
   tipografía, capas y movimiento, con el bloque de tema oscuro.
2. `_base.scss` — reinicio, tipografía, accesibilidad y utilidades de
   composición.
3. `_components.scss` — biblioteca de clases (`maya-btn`, `maya-card`,
   `maya-input`, `maya-table`, `maya-modal`, `maya-toast`…).

La marca de cada empresa se aplica en caliente desde `ThemeService`, que deriva
los tonos de apoyo del color principal (aclarado y oscurecido programáticos).

### 4.3 Armazón

`ShellComponent` monta la barra superior, el menú lateral colapsable y —en
móvil— la barra inferior. Los elementos de menú se filtran por las capacidades
efectivas del usuario, obtenidas en `/auth/me`.

---

## 5. Seguridad

- Cabeceras con Helmet y CSP en producción.
- Límite de peticiones global y estricto en los endpoints de acceso.
- Bloqueo temporal de cuentas tras varios intentos fallidos.
- Saneado del HTML de usuario **en la API y en el cliente** con la misma función
  compartida.
- Lista negra de extensiones ejecutables en la subida de ficheros y validación
  de tipo MIME.
- Auditoría de acciones sensibles mediante el decorador `@Audit`.
- RGPD: exportación y eliminación de datos personales con flujo de aprobación.

---

## 6. Extender la plataforma

**Añadir un tipo de actividad**

1. Crear el esquema y el servicio del módulo.
2. Implementar `ActivityHandler` (`create`, `update`, `remove`, `get`, y
   opcionalmente `duplicate` y `exportInstance`).
3. Registrarlo en `onModuleInit` con `ActivityRegistry.register(this)`.
4. Añadir el valor a `ModuleType` en `@maya/shared` y la ruta del cliente.

**Añadir una capacidad**

1. Declararla en `CAP` y en `CAPABILITY_CATALOG` (`packages/shared`).
2. Incluirla en los arquetipos de rol pertinentes en `ROLE_PRESETS`.
3. Ejecutar `bun run seed` para reprovisionar los roles del sistema.
4. Protegerla con `@RequireCapability(...)` en el controlador.
