# Aulas en vivo

Cómo funciona la videoconferencia de Maya Classroom, qué hay que configurar para
que funcione fuera de una red doméstica y hasta dónde llega.

---

## Qué se decidió y por qué

La conferencia es **WebRTC nativo en malla**, con un servidor de señalización
propio dentro de la API. No hay iframe de Zoom, Meet ni Jitsi, y tampoco hay un
servidor de medios.

Las tres alternativas que se valoraron:

| Opción | Qué implica | Por qué no |
|---|---|---|
| Incrustar un servicio de terceros | Un `<iframe>` y poco más | No es «nativo»: el vídeo, la grabación y los datos de asistencia se van a otra empresa, y la marca de la empresa desaparece de la pantalla |
| SFU (mediasoup, LiveKit, Janus) | Un proceso aparte con rangos de puertos UDP abiertos, módulo nativo compilado y su propio escalado | Es lo correcto a partir de cierto tamaño, pero exige infraestructura que este despliegue no tiene: Coolify sirve HTTP, no rangos UDP |
| **Malla WebRTC + señalización propia** | Nada que este despliegue no tenga ya | Elegida |

En malla, cada quien emite envía una copia de su vídeo a cada asistente. Eso
pone el techo del formato «reunión» —todos con cámara— en torno a 8-12
personas, según la subida de cada cual. Por eso las sesiones tienen dos modos:

- **Clase**: solo publican quienes presentan. Con un emisor, el coste de la sala
  es el mismo que con un SFU, y aguanta grupos grandes.
- **Reunión**: todos publican. Pensado para claustros y tutorías.

La parte de medios del cliente vive detrás de una fachada (`LiveRoomService`) y
los mensajes de señalización están tipados en `@maya/shared`. Sustituir la malla
por un SFU el día que haga falta no toca ni la interfaz ni el protocolo.

---

## Piezas

| Dónde | Qué hace |
|---|---|
| `apps/api/src/modules/live/live.gateway.ts` | Centralita: reparte SDP y candidatos ICE, presencia, chat, pizarra y moderación |
| `apps/api/src/modules/live/live.service.ts` | Sesiones, permisos, asistencia y credenciales TURN |
| `apps/api/src/modules/live/live-recordings.service.ts` | Recibe los trozos de grabación, los une y los guarda |
| `apps/api/src/modules/live/live-board.service.ts` | Estado persistente de la pizarra |
| `apps/web/src/app/core/services/live-room.service.ts` | La malla WebRTC en el navegador |
| `apps/web/src/app/core/services/live-recorder.service.ts` | Compone y codifica la grabación |
| `apps/web/src/app/features/live/` | Antesala, sala, pizarra y listado |

El socket no cuelga de `/socket.io` sino de **`/api/live-socket`**, dentro del
prefijo de la API. Es a propósito: el proxy de desarrollo y el nginx del
despliegue solo reenvían `/api`, y en la ruta por defecto la señalización moría
con un 404 del servidor de estáticos sin llegar nunca a la API.

---

## Configuración

### STUN — obligatorio, ya viene puesto

```bash
LIVE_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

Con esto basta cuando quienes participan están en redes domésticas normales.

### TURN — necesario en redes corporativas

Sin TURN, una red con NAT simétrico o con el UDP cerrado **no llega a conectar**.
El síntoma es característico y despista: los participantes aparecen en la lista,
el chat funciona y la pizarra también —todo eso va por el socket— pero no se ven
ni se oyen.

Lo habitual es [coturn](https://github.com/coturn/coturn):

```bash
# /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
realm=aula.suempresa.com
use-auth-secret
static-auth-secret=UN_SECRETO_LARGO_Y_ALEATORIO
# 5349 sobre TLS es el que atraviesa los cortafuegos más cerrados, porque
# viaja por el puerto que esas redes sí dejan pasar.
```

Y en el `.env` de Maya Classroom:

```bash
LIVE_TURN_URLS=turn:turn.suempresa.com:3478,turns:turn.suempresa.com:5349
LIVE_TURN_SECRET=UN_SECRETO_LARGO_Y_ALEATORIO
LIVE_TURN_TTL=28800
```

Con `LIVE_TURN_SECRET`, la API emite credenciales **temporales y por persona**
(el mecanismo REST que documenta coturn): el usuario es `caducidad:identificador`
y la contraseña su HMAC. Es lo recomendable, porque un usuario y una contraseña
fijos acaban en el portapapeles de cualquiera que abra las herramientas del
navegador. Si su TURN no admite ese mecanismo, use `LIVE_TURN_USERNAME` y
`LIVE_TURN_PASSWORD`.

Para comprobar que el TURN está bien puesto:

```bash
LIVE_FORCE_RELAY=true
```

Obliga a que todo el tráfico pase por TURN. Si la sala sigue funcionando, el
TURN está bien. Se ignora si no hay ningún TURN configurado, porque forzar un
relevo inexistente dejaría la sala sin ninguna ruta posible en lugar de con una
peor.

### Aforo

```bash
LIVE_MAX_PARTICIPANTS=25
```

Es el tope por sala; cada sesión puede bajarlo en sus ajustes. Léalo junto a lo
dicho más arriba sobre la malla: veinticinco personas en modo «clase» van bien,
y veinticinco en modo «reunión» no.

### Grabación

```bash
LIVE_RECORDING_CHUNK_SIZE=8388608
LIVE_RECORDING_MAX_SIZE=1073741824
LIVE_RECORDING_STAGING_PATH=./storage/.live-chunks
```

La graba el navegador de quien presenta: dibuja la sala en un lienzo —la
pantalla compartida al frente y las cámaras como fichas—, mezcla todos los
audios en una pista y la entrega a `MediaRecorder`, que la trocea. Cada trozo
sube en cuanto está listo, así que un corte pierde los últimos segundos y no la
clase entera.

Dos consecuencias que conviene tener presentes:

- **La pestaña tiene que seguir abierta hasta el final.** La interfaz avisa
  antes de cerrarla mientras se graba.
- **El ensamblado carga el fichero en memoria una vez** para entregárselo al
  almacenamiento. Subir `LIVE_RECORDING_MAX_SIZE` exige subir también la memoria
  del contenedor.

`LIVE_RECORDING_STAGING_PATH` debe ser escribible y sobrevivir a la duración de
una clase. Con almacenamiento en R2 o S3, solo los trozos pasan por ahí; el
fichero final se va al bucket.

---

## Permisos

| Capacidad | Quién la trae de serie |
|---|---|
| `maya/live:join` | Todo usuario autenticado |
| `maya/live:viewrecordings` | Alumnado |
| `maya/live:create` | Profesorado (con y sin edición) |
| `maya/live:host` | Profesorado |
| `maya/live:record` | Profesorado |
| `maya/live:managerecordings` | Profesorado |
| `maya/live:manageany` | Gestor de la empresa |

Convocar una clase **de un curso** se autoriza en el contexto del curso
(`POST /live/courses/:courseId/sessions`) y una reunión suelta en el de la
empresa (`POST /live/sessions`). Son dos rutas y no una porque el profesorado
tiene su rol asignado en el curso, no en la empresa: con una sola ruta evaluada
a nivel de empresa, un profesor no podría convocar sus propias clases.

Quien entra a una sala restringida a un curso tiene que estar matriculado en él.
Una sesión sin curso es de la empresa y entra cualquiera con el enlace.

---

## Escalado

Hoy la presencia de cada sala vive en memoria del proceso. Con **una sola
réplica** de la API no hay nada que hacer. Para varias réplicas hacen falta dos
cosas, y las dos a la vez:

1. Un adaptador de Socket.IO con Redis, para que los mensajes lleguen a las
   conexiones que atiende otro proceso.
2. Mover `LivePresenceService` a ese mismo Redis.

Mientras eso no esté, configure el balanceador con sesión pegajosa por sala o
mantenga una sola réplica: dos procesos con la misma sala se comportan como dos
salas distintas con el mismo nombre.
