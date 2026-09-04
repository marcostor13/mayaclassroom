# El acceso de demostración

Qué puede hacer quien pulsa «ver la demostración», qué no, y por qué la línea
está donde está.

---

## 1 · Qué es una sesión de demostración

Con `DEMO_ENABLED=true`, `POST /auth/demo/:role` entrega una sesión sin pedir
credenciales. El papel —`student`, `teacher` o `admin`— se traduce a una cuenta
de la empresa de demostración (`DEMO_TENANT_SLUG`), y `admin` es una cuenta de
**gestión con todas las capacidades de un cliente de verdad**.

Eso es lo que hace buena la demostración y lo que la vuelve peligrosa: la
empresa la comparten todos los visitantes a la vez.

## 2 · Lo que ya estaba bien

La plataforma nunca estuvo expuesta *entre* empresas:

- `findDemoUser` descarta las cuentas con `isPlatformAdmin`, así que la
  demostración no entrega nunca el control del despliegue.
- El alta de empresas, su estado y su borrado son `@PlatformAdminOnly()`.
- `RolesService.findForTenant` niega editar un rol global —cuya edición se
  propagaría a todas las empresas— y devuelve «no encontrado» para el rol de
  otra empresa.
- `TenantGuard` rechaza una petición que declare una empresa distinta a la de
  la sesión.
- `USER_LOGIN_AS` es una capacidad declarada pero **sin implementar**: no hay
  suplantación.
- `POST /auth/demo/:role` está limitado a 10 intentos por minuto.

## 3 · Lo que no estaba bien

Dentro de la empresa de demostración, la cuenta de gestión podía:

| Podía | Consecuencia |
|---|---|
| Borrar usuarios | Dejar sin cuenta a los otros papeles de la demostración |
| Vaciar roles y capacidades | Dejar la demostración inservible |
| Dar de alta un **webhook** | Hacer que el servidor de la plataforma envíe peticiones HTTP a cualquier dirección |
| Emitir **tokens** de servicio web | Credenciales persistentes que sobreviven a la sesión |
| Reservar un **dominio propio** | Servir la demostración en un dominio ajeno |
| Descargar y **restaurar copias** | Meter contenido arbitrario |
| Cambiar la contraseña o activar el doble factor | Cerrar la cuenta compartida para todo el mundo |
| Cambiar las credenciales de cobro | Desviar la configuración de la pasarela |

De casi nada de eso se vuelve con `bun run seed`.

## 4 · La línea: enseñar sí, administrar no

`DemoGuard` (`common/guards/demo.guard.ts`) **deniega toda escritura** de una
sesión de demostración salvo lo que lleve `@AllowInDemo()`.

Se deniega por omisión a propósito. Con una lista de lo prohibido, cada
endpoint nuevo nacería abierto sin que nadie lo hubiera pensado, y nadie se
enteraría hasta que un visitante lo usara. Así, un endpoint nuevo nace cerrado
y abrirlo es una línea visible en la revisión.

**Abierto** (contenido docente, y lo peor que deja es una demostración
desordenada que la siembra rehace): cursos, categorías, matrículas,
calificaciones, grupos, preguntas, finalización, calendario, aulas en vivo,
mensajería, la página pública, insignias, certificados, cohortes,
competencias, notificaciones y guías. Más, por método: las preferencias del
propio visitante, los comentarios, la resolución de un pedido y las subidas de
ficheros.

**Cerrado**: usuarios, roles y asignaciones, la empresa y su dominio propio,
tokens, webhooks, copias de seguridad, peticiones de datos personales, las
credenciales de cobro, el borrado de ficheros ajenos, y en `auth` todo lo que
no sea salir —cambio de contraseña, doble factor, cerrar las sesiones de los
demás—.

La superficie abierta está fijada en `common/guards/demo-superficie.spec.ts`:
cambiarla hace fallar las pruebas, que es exactamente lo que debe pasar.

## 5 · La marca viaja con la sesión, no con la cuenta

`demo` es una propiedad de la **sesión**: la misma cuenta de gestión puede
usarla una persona con su contraseña, y esa sesión no está limitada.

La marca va en el testigo de acceso firmado **y en el documento del testigo de
refresco**. Lo segundo no es un detalle: `refresh()` emite el testigo nuevo a
partir de ese documento, así que sin guardarla ahí bastaba con esperar quince
minutos a que caducara el acceso para que la renovación devolviese una sesión
de gestión sin restricciones. Era la forma más silenciosa de saltarse el
guard, y está cubierta por `auth.demo-session.spec.ts`.

## 6 · Lo que sigue siendo posible, y por qué se acepta

Un visitante todavía puede desordenar el contenido de la demostración: borrar
un curso, cambiar las notas, editar la página pública de Dulce Lima. Es
deliberado —sin eso la demostración no enseña el producto en marcha— y se
arregla con `bun run seed`.

Si en algún momento se prefiere una demostración intocable, el cambio es
retirar los `@AllowInDemo()`; el guard ya deniega por omisión.
