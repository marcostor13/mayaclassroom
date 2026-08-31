<div align="center">

# Maya Classroom

**Plataforma de aulas virtuales multiempresa inspirada en Moodle.**

Angular 22 · NestJS 11 · MongoDB Atlas · TypeScript estricto

</div>

---

## ¿Qué es Maya Classroom?

Maya Classroom es un LMS (*Learning Management System*) completo y multiempresa.
Reproduce el modelo funcional de Moodle —contextos jerárquicos, capacidades,
roles, categorías, cursos, actividades, libro de calificaciones, finalización y
restricción de acceso— sobre una arquitectura moderna: una API NestJS 11 con
MongoDB Atlas y un cliente Angular 22 sin zonas, basado en señales.

Cada **empresa** (*tenant*) es un espacio completamente aislado, con su propia
marca, sus usuarios, sus roles y su oferta formativa.

---

## Instalación rápida

```bash
# 1 · Requisitos: Node ≥ 22.22.3 (el CLI de Angular 22 lo exige) y npm ≥ 10
node -v

# 2 · Dependencias del monorepo
npm install

# 3 · Configuración
cp .env.example .env          # y edite MONGODB_URI con su clúster de Atlas

# 4 · Compilar los contratos compartidos
npm run build:shared

# 5 · Datos de demostración (crea empresa, usuarios y cursos de ejemplo)
npm run seed

# 6 · Arrancar API (:3000) y cliente (:4200) a la vez
npm run dev
```

Abra `http://localhost:4200` y acceda con la empresa **`demo`**:

| Perfil | Usuario | Contraseña |
|---|---|---|
| Administrador de plataforma | `admin@mayaclassroom.app` | `Maya2026!` |
| Gestora de la empresa | `gestora@academiamaya.example` | `Maya2026!` |
| Profesor | `profesor@academiamaya.example` | `Maya2026!` |
| Alumna | `ana.ruiz@academiamaya.example` | `Maya2026!` |

La documentación interactiva de la API queda en `http://localhost:3000/api/docs`.

---

## Estructura del monorepo

```
maya-classroom/
├── apps/
│   ├── api/                 # API NestJS 11
│   │   └── src/
│   │       ├── common/      # guards, filtros, interceptores, DTO base
│   │       ├── config/      # configuración tipada por secciones
│   │       ├── database/    # conexión a Atlas y siembra de datos
│   │       └── modules/     # dominio, un módulo por área funcional
│   └── web/                 # Cliente Angular 22
│       └── src/
│           ├── styles/      # design tokens y biblioteca de componentes
│           └── app/
│               ├── core/    # servicios, guards, interceptores
│               ├── layout/  # armazón (topbar, sidebar, bottom-nav)
│               ├── shared/  # componentes y pipes reutilizables
│               └── features/# una carpeta por pantalla
└── packages/
    └── shared/              # contratos TypeScript compartidos (DTO, enums,
                             # catálogo de capacidades y roles)
```

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | API y cliente en modo desarrollo |
| `npm run dev:api` | Solo la API (`http://localhost:3000`) |
| `npm run dev:web` | Solo el cliente (`http://localhost:4200`) |
| `npm run build` | Compila los tres paquetes |
| `npm run seed` | Siembra datos de demostración |
| `npm run test` | Pruebas de la API |
| `npm run lint` | Análisis estático de la API |

---

## Modelo de permisos

Maya Classroom no usa roles planos: replica el modelo de **capacidades sobre
contextos** de Moodle.

```
Sistema
 └── Empresa (tenant)
      ├── Categoría de cursos (anidable)
      │    └── Curso
      │         └── Módulo de actividad
      └── Usuario
```

- Una **capacidad** es un permiso atómico (`moodle/course:update`).
- Un **rol** asigna a cada capacidad uno de cuatro valores:
  `ALLOW`, `PREVENT`, `PROHIBIT` o `NOT SET`.
- Los roles se **asignan en un contexto**: se puede ser profesor en un curso y
  alumno en otro.
- La resolución acumula desde la raíz hasta la hoja; gana el contexto más
  profundo y `PROHIBIT` es absoluto.

En el código, un endpoint se protege así:

```ts
@Patch(':id')
@RequireCapability(CAP.COURSE_UPDATE, {
  contextLevel: ContextLevel.Course,
  param: 'id',
})
update(@Param('id') id: string, @Body() dto: UpdateCourseDto) { … }
```

---

## Fases del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| **1** | Arquitectura, autenticación, multiempresa, RBAC, usuarios, sistema de diseño | ✅ |
| **2** | Categorías, cursos, secciones, actividades, matriculación, grupos, calificaciones, finalización, calendario, mensajería, panel | ✅ |
| **3** | Competencias, insignias, certificados, cohortes, actividades avanzadas, analíticas, copias de seguridad, RGPD, servicios web, tareas programadas | ✅ |

El detalle está en [`PLAN.md`](./PLAN.md) y la arquitectura técnica en
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Identidad visual

La línea gráfica parte de un **rojo elegante** (`#E4574D`) con apoyos en
**rojo pastel** (`#F4A8A0`) sobre blanco cálido (`#FFF8F7`), tipografías
*Plus Jakarta Sans* e *Inter*, y un sistema de tokens CSS que permite:

- tema claro y oscuro automáticos o forzados,
- personalización de marca por empresa (color, logotipo y CSS propio),
- diseño **mobile-first** con barra inferior en móvil y menú lateral colapsable
  en escritorio,
- accesibilidad AA: foco visible, `aria-live`, navegación por teclado y respeto
  a `prefers-reduced-motion`.

---

## Despliegue

```bash
npm run build
NODE_ENV=production node apps/api/dist/main.js   # API
# Sirva apps/web/dist/web/browser con cualquier CDN o servidor estático
```

También hay un `docker-compose.yml` listo para levantar API, cliente y una
instancia local de MongoDB.

---

## Licencia

MIT.
