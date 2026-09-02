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

Además del aula, cada empresa tiene su propio **escaparate público**: una página
de venta que diseña ella misma bloque a bloque, con una ficha por curso, cobro
con Mercado Pago o PayPal y matrícula automática en cuanto el pago se confirma.

| Dirección | Qué es |
|---|---|
| `/p/:empresa` | Escaparate público con el catálogo a la venta |
| `/p/:empresa/c/:curso` | Ficha de venta de un curso: temario, profesorado y compra |
| `/p/:empresa/pedido/:referencia` | Estado de la compra al volver de la pasarela |
| `/admin/storefront` | Constructor visual de la página, catálogo, pedidos y solicitudes |
| `/admin/payments` | Conexión de las pasarelas de cobro |

Con `DEMO_ENABLED=true`, la pantalla de acceso ofrece además ver el escaparate
y entrar en la empresa de demostración como administrador o como estudiante,
sin credenciales. Apagado por defecto: es para el despliegue que enseña la
plataforma, no para el de un cliente.

---

## Instalación rápida

```bash
# 1 · Requisitos: Bun ≥ 1.2 y Node ≥ 22.22.3 (los CLI de Nest y Angular se
#     invocan con shebang `node`; Angular 22 exige esa versión mínima).
bun --version
node -v

# 2 · Dependencias del monorepo
bun install

# 3 · Configuración
cp .env.example .env          # y edite MONGODB_URI con su clúster de Atlas

# 4 · Compilar los contratos compartidos
bun run build:shared

# 5 · Datos de demostración (empresa, usuarios, tres cursos con vídeo,
#     escaparate publicado, cobros configurados y pedidos de ejemplo)
bun run seed

# 6 · Arrancar API (:3000) y cliente (:4205) a la vez
bun run dev
```

Abra `http://localhost:4205` y acceda con la empresa **`demo`**:

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
| `bun run dev` | API y cliente en modo desarrollo |
| `bun run dev:api` | Solo la API (`http://localhost:3000`) |
| `bun run dev:web` | Solo el cliente (`http://localhost:4205`) |
| `bun run build` | Compila los tres paquetes |
| `bun run seed` | Siembra datos de demostración |
| `bun run test` | Pruebas de la API |
| `bun run lint` | Análisis estático de la API |

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
| **4** | Escaparate público, constructor visual de páginas, venta de cursos con Mercado Pago y PayPal, pedidos y guías interactivas | ✅ |

El detalle está en [`PLAN.md`](./PLAN.md) y la arquitectura técnica en
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Para poner el almacenamiento
de ficheros en Cloudflare R2, [`docs/R2.md`](./docs/R2.md).

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

### Manual

```bash
bun run build
NODE_ENV=production bun apps/api/dist/main.js   # API
# Sirva apps/web/dist/web/browser con cualquier CDN o servidor estático
```

También hay un `docker-compose.yml` listo para levantar API, cliente y una
instancia local de MongoDB.

### Continuo: Coolify + GitHub Actions + Cloudflare Tunnel

Cada push a `main` dispara `.github/workflows/deploy.yml`, que compila y prueba
todo y, solo si pasa, sincroniza el DNS y encola el despliegue de las dos
aplicaciones en Coolify. Un último trabajo espera a que ambos dominios
respondan 200 antes de dar el despliegue por bueno.

No hay IP pública: Cloudflare entrega el tráfico por un **túnel**, así que cada
dominio es un `CNAME` a `<tunnel>.cfargotunnel.com` con el proxy activado, y el
proxy de Coolify enruta por nombre de host.

| Dominio | Aplicación | Imagen |
|---|---|---|
| `mayaclassroom.ignia.site` | cliente Angular | `apps/web/Dockerfile` (nginx) |
| `api-mayaclassroom.ignia.site` | API NestJS | `apps/api/Dockerfile` |

> El dominio de la API es un subdominio de **un solo nivel** a propósito. El
> certificado gratuito de Cloudflare cubre `ignia.site` y `*.ignia.site`, pero
> no `*.*.ignia.site`: un host como `api.mayaclassroom.ignia.site` resuelve por
> DNS y luego falla el handshake TLS.

> El dominio `mayacrm.site` **no es de este proyecto**: es Maya CRM, que vive en
> otra máquina. No apuntarlo aquí.

El cliente y la API viven en dominios distintos, así que el navegador llama
directamente a la API. La URL se incrusta en el paquete al construir la imagen
(`ARG API_URL` en `apps/web/Dockerfile`) y el acceso lo autoriza `CORS_ORIGINS`
en la API.

#### Utilidad de despliegue

```bash
bun run deploy --list     # Inventario de Coolify: proyectos, servidores y apps
bun run deploy --dns      # Crea o ajusta los CNAME del túnel (idempotente)
bun run deploy --coolify  # Vuelca los dominios y sus variables en Coolify
bun run deploy --check    # Verifica que los UUID apuntan a este repositorio
bun run deploy            # Encola el despliegue de ambas aplicaciones
bun run deploy --api      # Solo la API
bun run deploy --web      # Solo el cliente
```

`--check` se ejecuta siempre antes de desplegar y aborta si algún UUID pertenece
a otro repositorio. La comprobación existe porque `.env.deploy` se copia entre
proyectos con facilidad y un UUID heredado publica este código encima de la
aplicación de otro.

#### Configuración en GitHub

Variables del **entorno `production`** (`Settings → Environments → production`),
no del repositorio: los tres trabajos del flujo declaran `environment:
production` y solo ahí las ven.

| Variable | Valor |
|---|---|
| `COOLIFY_URL` | URL de la instancia de Coolify |
| `FRONTEND_DOMAIN` | `mayaclassroom.ignia.site` |
| `BACKEND_DOMAIN` | `api-mayaclassroom.ignia.site` |
| `CLOUDFLARE_ZONE_NAME` | `ignia.site` (la zona, no el subdominio) |
| `WEB_URL` | `https://mayaclassroom.ignia.site` |
| `CORS_ORIGINS` | `https://mayaclassroom.ignia.site` |
| `API_URL` | `https://api-mayaclassroom.ignia.site/api/v1` |

Las tres últimas las consume `deploy --coolify`, que las vuelca en Coolify antes
de reconstruir. `API_URL` tiene que estar ahí antes del despliegue y no después:
se incrusta en el paquete del cliente al compilar.

Secretos del repositorio:

| Secreto | Origen |
|---|---|
| `COOLIFY_TOKEN` | Coolify → Keys & Tokens → API tokens |
| `COOLIFY_API_UUID` | `bun run deploy --list` |
| `COOLIFY_WEB_UUID` | `bun run deploy --list` |
| `CLOUDFLARE_API_TOKEN` | Token con permiso `Zone:DNS:Edit` |
| `CLOUDFLARE_TUNNEL_ID` | Identificador del Cloudflare Tunnel |

Los valores de runtime (`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CORS_ORIGINS`, `NODE_DNS_SERVERS`…) se configuran en las variables de entorno
de cada aplicación **dentro de Coolify**, no en GitHub: no participan en la
construcción. La plantilla completa está en `.env.deploy`, que no se versiona.

---

## Licencia

MIT.
