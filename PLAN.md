# Maya Classroom — Plan Maestro de Implementación

> Plataforma de aulas virtuales (LMS) multiempresa inspirada en Moodle.
> **Stack:** Angular 22 · NestJS 11 · MongoDB Atlas (Mongoose) · TypeScript strict.

---

## 0. Análisis de Moodle (base funcional)

Moodle organiza su funcionalidad alrededor de siete pilares. Este es el análisis que
sustenta el diseño de Maya Classroom:

### 0.1 Modelo de contextos y permisos (lo más importante de Moodle)

Moodle **no** usa roles planos. Usa un modelo de **capacidades sobre contextos jerárquicos**:

```
Sistema (system)
 └── Categoría de cursos (coursecat)          [anidable N niveles]
      └── Curso (course)
           └── Módulo de actividad (module)
                └── Bloque (block)
 └── Usuario (user)
```

- Una **capacidad** (`capability`) es un permiso atómico con nombre jerárquico:
  `moodle/course:update`, `mod/quiz:attempt`, `moodle/user:create`…
- Un **rol** es un conjunto de capacidades con uno de cuatro valores:
  `ALLOW (1)`, `PREVENT (-1)`, `PROHIBIT (-1000)`, `NOT SET (0)`.
- Los roles se **asignan en un contexto concreto**. Un usuario puede ser *Profesor* en
  el curso A, *Estudiante* en el curso B y *Gestor* en toda una categoría.
- La resolución es por **herencia descendente**: se acumulan las asignaciones desde el
  contexto raíz hasta el contexto pedido. `PROHIBIT` no puede ser sobrescrito nunca.

**Roles arquetípicos de Moodle** que replicamos:
`manager`, `coursecreator`, `editingteacher`, `teacher` (no editor), `student`,
`guest`, `user` (autenticado), `frontpage`.

### 0.2 Multiempresa (multi-tenant)

Moodle core es mono-sitio; la multiempresa vive en Moodle Workplace (*tenants*).
Maya Classroom la lleva al núcleo: **cada empresa (`Tenant`) es un espacio aislado**
con su propio dominio/slug, marca (logo, colores), usuarios, categorías, cursos,
roles personalizados y políticas. Un `Tenant` especial (`__system__`) alberga a los
administradores de plataforma que pueden cruzar tenants.

### 0.3 Estructura académica

`Categoría (árbol) → Curso → Sección/Tema → Módulo de curso → Actividad|Recurso`

- **Formatos de curso**: temas, semanal, actividad única, social.
- **Matriculación (`enrol`)**: manual, auto-matriculación con clave, acceso invitado,
  sincronización por cohortes.
- **Grupos y agrupamientos** (`groups` / `groupings`), modo de grupo:
  sin grupos / grupos separados / grupos visibles.
- **Restricción de acceso** (`availability`): fecha, calificación, finalización de otra
  actividad, perfil de usuario, grupo, agrupamiento — con árbol lógico AND/OR/NOT.
- **Seguimiento de finalización**: por actividad (manual / automática con condiciones) y
  finalización de curso (reglas agregadas).

### 0.4 Módulos de actividad y recursos

| Actividad | Recurso |
|---|---|
| Tarea (assign), Cuestionario (quiz), Foro, Consulta (choice), Encuesta (feedback), Lección, Glosario, Wiki, Taller (workshop), Base de datos, Chat, H5P, SCORM, LTI externo | Archivo, Carpeta, Página, URL, Libro, Etiqueta |

### 0.5 Calificaciones

Libro de calificaciones con **ítems de calificación**, **categorías de calificación**
anidadas, **agregación** (media, media ponderada, natural, suma, mediana, máx/mín),
**escalas**, **letras de calificación**, **resultados (outcomes)**, exportación e importación.

### 0.6 Comunicación y seguimiento

Calendario (eventos de sitio/categoría/curso/grupo/usuario), mensajería 1:1 y grupal,
notificaciones con preferencias por canal (web/email/móvil), foros con suscripción,
registros (logs) y reportes de participación, analíticas.

### 0.7 Avanzado

Competencias y planes de aprendizaje, insignias (badges) con criterios, cohortes,
banco de preguntas, copias de seguridad/restauración, campos personalizados,
etiquetas, comentarios, valoraciones (ratings), servicios web con tokens,
políticas del sitio y RGPD, tareas programadas (cron), auditoría.

---

## Fase 1 — Núcleo, arquitectura, identidad y diseño

**Objetivo:** cimientos productivos. Al terminar, la plataforma arranca, autentica,
resuelve permisos y tiene su lenguaje visual completo.

### 1.1 Arquitectura
- Monorepo con **npm workspaces**: `apps/api`, `apps/web`, `packages/shared`.
- `packages/shared`: contratos TypeScript (DTO, enums, catálogo de capacidades,
  constantes de roles) consumidos por API y Web — una única fuente de verdad.
- API NestJS 11 modular: `config`, `database`, `common` (guards, interceptors,
  filtros, decoradores, paginación), y módulos de dominio.
- Conexión a **MongoDB Atlas** vía `@nestjs/mongoose` con esquemas tipados,
  índices compuestos y *soft delete*.
- Versionado de API (`/api/v1`), OpenAPI/Swagger, `class-validator` global,
  filtro de excepciones unificado, interceptor de respuesta, rate limiting,
  Helmet, CORS, health checks.

### 1.2 Autenticación
- Registro / login local (Argon2id), **access token JWT + refresh token rotativo**
  persistido y revocable (familia de tokens, detección de reuso).
- Verificación de email, recuperación y cambio de contraseña, política de contraseñas.
- Sesiones y dispositivos, cierre de sesión global.
- 2FA TOTP opcional.
- Resolución de tenant por *slug* de cabecera/subdominio.

### 1.3 Empresas (multi-tenant) y RBAC
- `Tenant`: identidad, marca, plan, límites, ajustes, estado.
- `Context`: árbol de contextos (`system|tenant|category|course|module|user`) con
  `path` materializado (`/1/4/17/`) y `depth` para consultas de herencia en una query.
- `Role` + `RoleCapability` con los cuatro valores de permiso de Moodle.
- `RoleAssignment` (usuario × rol × contexto).
- Servicio `AccessService` con `hasCapability`, `requireCapability`, caché por petición.
- Guard `@RequireCapability('moodle/course:update')` + `@Roles()` + `@Public()`.
- Siembra (`seed`) de roles arquetípicos y del catálogo de capacidades.

### 1.4 Usuarios
- Perfil completo (avatar, bio, país, zona horaria, idioma, intereses),
  preferencias, campos personalizados, estado (activo/suspendido), auditoría.

### 1.5 Línea gráfica «Maya Classroom»
- Paleta: **rojo pastel elegante** (`#E4574D` primario, `#F4A8A0` pastel,
  `#8E2A22` profundo) sobre blanco/`#FFF8F7`, con neutros cálidos.
- Tipografías: *Plus Jakarta Sans* (títulos) + *Inter* (texto).
- Sistema de diseño en SCSS con *design tokens* (color, espaciado, radios, sombras,
  tipografía, z-index, breakpoints), modo claro/oscuro.
- Componentes UI propios: botón, input, select, textarea, checkbox/radio/switch,
  card, badge/chip, avatar, tabs, tabla, modal, drawer, dropdown, tooltip, toast,
  paginación, breadcrumb, progress, skeleton, empty-state, alert, file-upload.
- Layout **mobile-first**: shell con topbar, sidebar colapsable, bottom-nav en móvil,
  breadcrumbs y contenedor responsive. Accesibilidad AA, foco visible, `prefers-reduced-motion`.
- Angular 22: standalone, señales, *zoneless*, nuevo control de flujo, `httpResource`,
  rutas con `loadComponent`, interceptores funcionales, guards funcionales.

---

## Fase 2 — LMS funcional (uso real de profesores y alumnos)

**Objetivo:** ciclo completo de enseñanza-aprendizaje sin opciones avanzadas.

1. **Categorías de cursos** — árbol anidado, mover/reordenar, permisos por categoría.
2. **Cursos** — CRUD, formatos (temas/semanal/actividad única/social), visibilidad,
   fechas, resumen, imagen, autofinalización, plantillas.
3. **Secciones** — temas/semanas, reordenar, ocultar, resumen.
4. **Módulos de curso** — instanciación polimórfica de actividades/recursos,
   reordenar entre secciones, visibilidad, *stealth*.
5. **Matriculación** — manual (individual y masiva), automatricula con clave,
   acceso invitado, roles en curso, suspensión, fechas de matrícula.
6. **Grupos y agrupamientos** — creación, auto-creación, miembros, modo de grupo.
7. **Actividades núcleo**
   - **Tarea**: enunciado, fechas, entregas de archivo/texto, entregas fuera de plazo,
     calificación y retroalimentación, rúbrica simple.
   - **Cuestionario**: banco de preguntas básico (opción múltiple, V/F, respuesta corta,
     numérica, emparejamiento, ensayo), intentos, temporizador, barajado,
     calificación automática, revisión.
   - **Foro**: tipos de foro, debates, respuestas anidadas, suscripción, adjuntos.
   - **Consulta (choice)**, **Encuesta (feedback)**.
8. **Recursos** — Archivo, Carpeta, Página, URL, Etiqueta, Libro.
9. **Ficheros** — servicio de almacenamiento (local/S3), validación MIME, cuotas,
   miniaturas, descarga firmada.
10. **Libro de calificaciones** — ítems, categorías, agregación, escalas, letras,
    vista de profesor (tabla) y de alumno (informe), exportación CSV.
11. **Finalización y restricción de acceso** — condiciones y árbol lógico.
12. **Calendario** — eventos de curso/usuario/sitio, vista mes/agenda, próximos eventos.
13. **Mensajería y notificaciones** — conversaciones, no leídos, preferencias, email.
14. **Dashboard** — «Mis cursos», línea de tiempo, tareas próximas, progreso.
15. **Registros y reportes básicos** — log de eventos, participación, informe de notas.
16. **UI Web** — todas las pantallas anteriores con el sistema de diseño de la Fase 1.

---

## Fase 3 — Avanzado (sin afectar el flujo principal)

1. **Competencias** y planes de aprendizaje, marcos de competencias.
2. **Insignias (badges)** de curso y sitio con criterios y emisión automática.
3. **Certificados** con plantillas y verificación pública.
4. **Cohortes** y sincronización de matriculación por cohorte.
5. **Banco de preguntas avanzado**: categorías, importación GIFT/XML, preguntas
   *cloze*, arrastrar y soltar, penalizaciones, comportamiento de preguntas.
6. **Actividades avanzadas**: Lección, Taller (workshop, evaluación entre pares),
   Glosario, Wiki, Base de datos, Chat, SCORM, LTI 1.3, H5P.
7. **Rúbricas y guías de evaluación** avanzadas (advanced grading).
8. **Copia de seguridad / restauración / importación** de cursos (formato JSON+ficheros).
9. **Campos personalizados** para usuarios, cursos y categorías.
10. **Etiquetas, comentarios y valoraciones** transversales.
11. **Analíticas y reportes avanzados**: constructor de informes, indicadores de riesgo,
    seguimiento de progreso, exportación programada.
12. **Servicios web y API pública** con tokens, ámbitos y webhooks.
13. **RGPD**: políticas del sitio, consentimiento, exportación y eliminación de datos.
14. **Tareas programadas (cron)** y cola de tareas ad-hoc.
15. **Auditoría** completa y panel de administración del sitio.
16. **Personalización de marca por tenant**, temas y bloques del dashboard.
17. **Accesibilidad avanzada, i18n (es/en), PWA y modo offline de lectura.**

---

## Estado de implementación

| Fase | Estado |
|---|---|
| Fase 1 | ✅ Implementada |
| Fase 2 | ✅ Implementada |
| Fase 3 | ✅ Implementada (base funcional de cada capacidad) |

Ver `docs/ARCHITECTURE.md` y `docs/API.md` para el detalle técnico.
