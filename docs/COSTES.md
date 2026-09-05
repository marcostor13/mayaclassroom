# Qué cuesta operar la plataforma

Cuánto cuesta al mes servir a 100 y a 1000 usuarios, de dónde sale ese coste,
qué se puede recortar y dónde hay que poner los topes. Es el suelo que
[`OFERTA.md`](OFERTA.md) señala como pendiente: «el coste real de operar cada
academia, que es el suelo por debajo del cual la mensualidad no puede bajar».

Las cifras técnicas (bitrate, tamaños, topes) están **medidas en el código** y
se citan con su fichero. Las cifras de precio son de **septiembre de 2026** y
hay que volver a mirarlas antes de tomar una decisión: cambian solas.

Tipo de cambio usado: **US$ 1 = S/ 3,75** y **€ 1 = S/ 4,05**.

---

## 1 · Las cuatro vías del vídeo, y por qué solo dos cuestan

La plataforma mueve vídeo por cuatro caminos distintos, y el coste de cada uno
no tiene nada que ver con el de los demás. Confundirlos es el error que hace
que un presupuesto de LMS se quede corto por diez veces.

| Camino | Por dónde va | Qué cuesta |
|---|---|---|
| **Clase en vivo** | WebRTC en malla entre navegadores; el servidor solo señaliza | Casi nada: unos KB de SDP y candidatos ICE por persona |
| **Clase en vivo tras TURN** | Relevada por coturn cuando la red no deja pasar el UDP | Tráfico del VPS: ~0,31 GB por hora y por flujo relevado |
| **Vídeo de curso** | Se sube como medio público → R2 → se sirve desde el bucket | Solo almacenamiento. **La salida de R2 no se cobra nunca** |
| **Grabación de clase** | Se compone en el navegador → API → R2, y se sirve **por la API** | Almacenamiento **y** tráfico del VPS **y** memoria del contenedor |

La decisión de arquitectura de [`LIVE.md`](LIVE.md) —malla WebRTC, sin servidor
de medios— es la que hace que las clases en vivo, que parecen lo caro, sean lo
barato. No hay SFU que pagar ni tráfico de medios que atraviese la
infraestructura salvo cuando entra el relevo.

Lo caro es **la grabación**, y por dos motivos a la vez: lo que ocupa y por
dónde sale.

### Lo que ocupa una grabación

`live-recorder.service.ts` graba a 1280×720, 24 fps, 1 800 000 bps de vídeo y
128 000 bps de audio. Eso es:

| | |
|---|---|
| Caudal | 1,93 Mbps |
| **Por hora grabada** | **868 MB** (0,847 GB) |
| Coste de guardarla un mes | S/ 0,048 |
| Coste de guardarla tres años | S/ 1,72 |
| Duración máxima antes de fallar | **74 minutos** (`LIVE_RECORDING_MAX_SIZE` = 1 GiB) |

Ese último dato no es de coste pero se paga igual: una clase de dos horas
supera el tope a los 74 minutos, `appendChunk` llama a `fail()` y **se pierde
la grabación entera**, no el exceso. Subir el tope obliga a subir la memoria
del contenedor, porque el ensamblado carga el fichero completo en RAM.

### Por dónde sale una grabación

`files.service.ts` enlaza al bucket lo público y deja lo privado saliendo por
la API, que es donde se comprueban permisos. Las grabaciones son privadas, así
que cada visionado pasa por `GET /live/recordings/:id/media` — y ese endpoint,
como `GET /files/:id/download`, hace `storage.get()` a un `Buffer` y
`res.send(data)`. Sin flujo y sin `Range`.

Consecuencias, en orden de gravedad:

1. **Una hora de grabación vista = 868 MB de RAM** en el proceso de la API,
   durante toda la descarga. Cuatro visionados simultáneos de una clase de una
   hora son 3,5 GB: un contenedor de 8 GB se cae.
2. **No hay barra de progreso utilizable.** Sin `Range`, el navegador no puede
   saltar al minuto 40; se traga el fichero entero.
3. **El tráfico sale por el VPS**, no por R2. Es lo de menos en dinero
   (S/ 0,004/GB) pero es lo que satura la máquina.

Esto es lo primero que hay que arreglar, y no cuesta casi nada arreglarlo:
[§6, medida 1](#6--estrategias-de-ahorro-por-retorno).

---

## 2 · Perfil de uso

Todo lo que sigue depende de estos supuestos. Si no se parecen a la realidad,
cámbielos aquí y el resto se recalcula solo.

| Al mes, por persona | Alumno | Docente |
|---|---|---|
| Horas en clase en vivo | 4 | 10 |
| Horas grabadas | — | 6 |
| Horas de grabación vistas | 2 | 1 |
| Horas de vídeo de curso vistas | 5 | 2 |
| Material subido | 50 MB | 300 MB + 250 MB de vídeo nuevo |

Mezcla: **8 % de docentes**. Conexiones que necesitan TURN: **20 %** (móvil
peruano y redes de oficina). Vídeo de curso a 1,5 Mbps.

---

## 3 · Coste con 100 y con 1000 usuarios

Al **mes 12**, es decir, con un año de material ya acumulado. Dos columnas por
escenario: con MongoDB Atlas gestionado y con Mongo en el propio VPS.

### 100 usuarios (≈ 4 academias)

| Partida | Con Atlas M10 | Mongo propio |
|---|---:|---:|
| VPS 4 vCPU / 8 GB (API, cliente, coturn, Coolify) | S/ 55 | S/ 55 |
| MongoDB | S/ 214 | S/ 0 |
| R2 · almacenamiento (593 GB acumulados) | S/ 33 | S/ 33 |
| R2 · operaciones | S/ 0,08 | S/ 0,08 |
| Tráfico excedente (221 GB de 20 TB incluidos) | S/ 0 | S/ 0 |
| Correo (Brevo/SES en tramo gratuito) | S/ 0 | S/ 0 |
| Dominios, copias y vigilancia | S/ 45 | S/ 30 |
| **Total** | **S/ 347** | **S/ 119** |
| **Por usuario** | **S/ 3,47** | **S/ 1,19** |

### 1000 usuarios (≈ 35 academias)

| Partida | Con Atlas M20 | Con Atlas M10 |
|---|---:|---:|
| VPS (uno de 8 vCPU / 16 GB + otro de 4/8) | S/ 160 | S/ 160 |
| MongoDB | S/ 548 | S/ 214 |
| R2 · almacenamiento (5,8 TB acumulados) | S/ 334 | S/ 334 |
| R2 · operaciones | S/ 0,75 | S/ 0,75 |
| Tráfico excedente (2,2 TB de 20 TB incluidos) | S/ 0 | S/ 0 |
| Correo | S/ 75 | S/ 34 |
| Dominios, copias y vigilancia | S/ 94 | S/ 75 |
| **Total** | **S/ 1 211** | **S/ 817** |
| **Por usuario** | **S/ 1,21** | **S/ 0,82** |

### Lo que dicen estas tablas

- **A 100 usuarios manda el coste fijo.** Atlas M10 solo es el 62 % de la
  factura. Con 100 usuarios no hay volumen que justifique un clúster
  gestionado: Mongo en el VPS con copias a R2 baja el coste por usuario de
  S/ 3,47 a S/ 1,19 sin tocar nada más. El precio de eso es que las copias y
  la recuperación pasan a ser trabajo propio, y conviene volver a Atlas
  **antes** de que la base pase de un par de GB, no después.
- **A 1000 usuarios manda el almacenamiento**, y no deja de crecer.
- **El tráfico no aparece en ninguna de las dos**, porque los 20 TB incluidos
  de un VPS europeo no se rozan siquiera. La restricción del tráfico no es
  económica, es de memoria del contenedor (§1).

---

## 4 · El coste por usuario es un promedio que engaña

S/ 0,82 por usuario es cierto y no sirve para decidir nada, porque el coste no
lo hace el alumno: lo hace el docente que graba. En régimen estacionario, con
tres años de retención:

| Perfil | Almacén acumulado | **Coste marginal al mes** |
|---|---:|---:|
| Alumno típico | 1,2 GB | **S/ 0,10** |
| Alumno intenso (8 GB descargados/mes) | 7,2 GB | **S/ 0,51** |
| Docente típico (6 h grabadas/mes) | 134 GB | **S/ 7,72** |
| Docente intensivo (20 h grabadas/mes) | 413 GB | **S/ 23,51** |

Un docente que graba cuesta **77 veces** lo que un alumno. La consecuencia
práctica es que **contar asientos no protege de nada**: el tope de 300 o 2000
alumnos de los planes de [`OFERTA.md`](OFERTA.md) no dice absolutamente nada
sobre lo que va a costar esa academia. Dos academias de 200 alumnos pueden
costar S/ 20 y S/ 400 según cuántas clases graben sus profesores.

---

## 5 · El almacenamiento es un trinquete

Es el punto que hunde los presupuestos de LMS, porque no se ve el primer año.
Hoy nada borra nada: no hay caducidad de grabaciones, ni de registros de
auditoría, ni poda de material huérfano. Con 1000 usuarios entran **495 GB al
mes** y no sale ninguno:

| | Acumulado | Solo almacén |
|---|---:|---:|
| Mes 12 | 5,8 TB | S/ 334/mes |
| Mes 24 | 11,6 TB | S/ 668/mes |
| Mes 36 | 17,4 TB | S/ 1 002/mes |

La factura de almacenamiento **triplica en tres años con exactamente los
mismos clientes**. Y el reparto de esos 495 GB nuevos deja claro dónde actuar:

| Grabaciones de clase | Entregas y material | Vídeo de curso |
|---:|---:|---:|
| **82 %** | 14 % | 4 % |

### Tres huecos concretos en el código

| Hueco | Dónde | Qué pasa |
|---|---|---|
| ~~La cuota de disco por empresa no se aplica~~ | **Resuelto**: `PLAN_LIMITS` fija el tope por plan y `FilesService.upload` lo comprueba antes de escribir nada | — |
| El tope de cursos **no se aplica** | `limits.maxCourses` solo vive en el esquema | A propósito: la página promete cursos ilimitados desde el primer plan, y un curso vacío no cuesta nada. Lo que cuesta son sus gigas, y esos ya se miden |
| Los trozos huérfanos **no se podan** | `scheduled-tasks.service.ts` no tiene tarea para ello | Una pestaña que se cierra sin llamar a `abort` deja sus `.part` en el disco del VPS para siempre |
| Los registros **no caducan** | Solo `RefreshToken` tiene índice TTL | La colección de auditoría crece sin fin dentro del clúster, que es el GB más caro de todos |

El tope de usuarios sí se aplica (`users.service.ts:268`), que es justamente
el que menos falta hacía.

### Lo que ya está puesto

Los topes de §7 están aplicados: `PLAN_LIMITS` en `@maya/shared` es la única
tabla de lo que permite cada plan, la comprobación vive en `FilesService.upload`
—por donde pasan **todas** las subidas, grabaciones incluidas— y la grabación de
una clase comprueba el hueco **antes de empezar**, porque enterarse al guardar
significaría perder la clase entera. Las empresas que ya existían suben a los
topes de su plan al arrancar la API (`TenantsService.onApplicationBootstrap`),
que solo sube topes y nunca los baja.

**Falta la caducidad de las grabaciones**, que es la otra mitad. Sin ella el
tope no es un límite de gasto sino una fecha: el día que la academia lo alcance
dejará de poder grabar, y la única salida será borrar a mano o subir de plan.

---

## 6 · Estrategias de ahorro, por retorno

Ordenadas por lo que devuelven frente a lo que cuesta hacerlas.

### 1. Servir las grabaciones con URL firmada de R2 · **el mayor retorno**

Hoy el fichero entero pasa por la memoria de la API. En su lugar: comprobar el
permiso, emitir una URL de R2 firmada y caducable (10 minutos) y redirigir.

- La RAM por visionado pasa de 868 MB a cero.
- El tráfico sale de R2, que **no cobra salida**, en vez del VPS.
- El navegador recupera el `Range`: se puede saltar dentro del vídeo.
- El permiso se sigue comprobando, porque se comprueba al firmar.

Es un cambio pequeño y localizado (`storage.service.ts` más los dos endpoints)
y es lo que permite atender más de cuatro visionados a la vez sin comprar
máquina. Mientras no se haga, el mínimo aceptable es transmitir en flujo con
soporte de `Range` en lugar de bufferizar.

### 2. Bajar el caudal de grabación · **−40 % del almacén**

1,8 Mbps es generoso para 720p a 24 fps de una clase, que es casi siempre una
pantalla compartida con poco movimiento. A 900 kbps con VP9 el resultado se
sigue leyendo bien:

| | Hoy | A 0,9 Mbps |
|---|---:|---:|
| Por hora grabada | 868 MB | 449 MB |
| Duración máxima con el tope de 1 GiB | 74 min | 143 min |

Arregla de paso el corte a los 74 minutos. Es cambiar dos constantes en
`live-recorder.service.ts` y probar cómo se lee el texto de una diapositiva.

### 3. Podar las grabaciones · **−55 % del almacén**

Caducidad por plan (12 meses en Inicia, 24 en Crece, configurable en Escala),
con aviso por correo un mes antes y opción de descargar. Es una tarea
programada más en `scheduled-tasks.service.ts`.

### 4. Clase de acceso infrecuente para lo viejo · **−5 % más**

R2 Infrequent Access cuesta US$ 0,010/GB-mes en vez de 0,015 y cobra US$ 0,01
por GB recuperado. Una grabación de más de 30 días casi no se ve: sale a
cuenta. Regla de ciclo de vida en el bucket, sin código.

### 5. Grabación solo de audio cuando no hay pantalla · **−3 % más**

Una tutoría de voz a 128 kbps ocupa 57 MB/hora en vez de 868. Un interruptor
en los ajustes de la sesión.

### Lo que suman

Con 1000 usuarios, sobre el almacén en régimen estacionario:

| Escenario | Almacén estable | Al mes | Ahorro |
|---|---:|---:|---:|
| Hoy (sin poda, 36 meses) | 17,4 TB | S/ 1 002 | — |
| A · caudal a 0,9 Mbps | 10,5 TB | S/ 603 | 40 % |
| B · poda a 12 meses | 7,9 TB | S/ 452 | 55 % |
| C · A + B | 5,6 TB | S/ 320 | **68 %** |
| D · C + acceso infrecuente | 5,6 TB | S/ 273 | 73 % |
| E · D + audio cuando procede | 4,7 TB | S/ 238 | **76 %** |

Con C aplicado, el escenario de 1000 usuarios baja de S/ 1 211 a **S/ 880** con
Atlas, y el coste por usuario de S/ 1,21 a **S/ 0,88**. Y, más importante que la
cifra, **el trinquete se para**: el almacén deja de crecer sin fin y se estabiliza.

### Otras dos, fuera del vídeo

- **Índice TTL en la colección de registros** (12 meses) y en las
  notificaciones leídas (6 meses). Es una línea por esquema y libera el GB más
  caro de la infraestructura.
- **Mongo en el VPS mientras haya menos de ~500 usuarios**, con volcado diario
  cifrado a R2. Ahorra S/ 214/mes desde el primer día. La condición para que
  sea una decisión y no una imprudencia es tener probada la **restauración**,
  no solo la copia.

---

## 7 · Cuándo hay que limitar a alguien, y qué

La pregunta era a partir de qué punto un usuario cuesta S/ 20 al mes. La
respuesta corta: **un alumno no llega ahí jamás** —tendría que acumular 356 GB
permanentes— y **un docente que graba llega solo, sin proponérselo**.

### Qué cabe en un presupuesto de S/ 20 por usuario y mes

| Retención | Almacén sostenible | Aporte mensual | Horas grabadas/mes |
|---|---:|---:|---:|
| 12 meses | 356 GB | 29,6 GB | 35 h (75 h a 0,9 Mbps) |
| 24 meses | 356 GB | 14,8 GB | **17,5 h** (37 h a 0,9 Mbps) |
| 36 meses | 356 GB | 9,9 GB | 11,7 h (25 h a 0,9 Mbps) |

Es decir: **el umbral de los S/ 20 se cruza cuando alguien graba unas 17 horas
al mes y se guardan dos años**. Menos de una hora al día lectivo. Un instituto
con seis profesores que graben todas sus clases lo cruza el primer mes.

### Pero S/ 20 de coste es el número equivocado

Si S/ 20 es lo que se **cobra** —un plan individual para un profesor por su
cuenta—, el coste no puede ser S/ 20: hay que dejar margen para soporte,
impuestos, captación y beneficio. Con el coste de infraestructura en el 25 %
del precio, el presupuesto real es **S/ 5 por usuario y mes**:

| Retención | Almacén | Horas grabadas/mes |
|---|---:|---:|
| 12 meses | 89 GB | 8,7 h (19 h a 0,9 Mbps) |
| 24 meses | 89 GB | 4,4 h (9 h a 0,9 Mbps) |

**Un plan individual de S/ 20 al mes se sostiene con 89 GB de almacén y unas 9
horas grabadas al mes a caudal reducido.** Ese es el número que hay que
publicar, no el asiento.

### Y lo mismo, aplicado a los planes que ya existen

Asignando el 40 % de la mensualidad a infraestructura y con retención de 24
meses:

| Plan | Presupuesto de infra | Almacén | Horas grabadas/mes (a 0,9 Mbps) |
|---|---:|---:|---:|
| Inicia · S/ 47 | S/ 18,80 | 334 GB | 16 h (**35 h**) |
| Crece · S/ 99 | S/ 39,60 | 704 GB | 35 h (**74 h**) |

### Qué limitar, en este orden

1. **Gigas por empresa.** ✅ Puesto: **300 GB en Inicia, 700 GB en Crece**,
   2 TB de partida en Escala y 20 GB en la prueba. La subida que no cabe se
   rechaza con un 413 que dice cuánto queda y de cuánto. Es el único tope que
   ataca el 82 % del coste.
2. **Horas grabadas al mes por empresa.** Un contador que se reinicia cada mes
   y bloquea el botón de grabar con un aviso, no un fallo a mitad de clase.
   **16 h en Inicia, 35 h en Crece** a caudal actual; el doble si se baja a
   0,9 Mbps.
3. **Retención de las grabaciones.** 12 meses en Inicia, 24 en Crece. Es la
   palanca que convierte un coste creciente en uno estable, y la única que
   sigue funcionando cuando el cliente crece.
4. **Duración de una sesión grabada.** Hoy son 74 minutos y el fallo es
   silencioso y destructivo. Con el caudal bajado son 143; conviene además
   avisar en pantalla al acercarse y cerrar limpiamente en lugar de fallar.
5. **Salas simultáneas por empresa.** No por coste —la malla casi no cuesta—
   sino porque la presencia vive en memoria de un solo proceso (véase el
   apartado de escalado de [`LIVE.md`](LIVE.md)).

Lo que **no** conviene limitar: el número de alumnos. Es lo único que hoy se
comprueba, es lo que menos cuesta y es lo que más frena la venta.

---

## 8 · El caso de un tope de 500 GB por usuario

Vale la pena hacer el número entero, porque es la cifra que primero viene a la
cabeza y se comporta de forma poco intuitiva. El supuesto es un tope **no
reservado**: nadie paga 500 GB, simplemente puede llegar hasta ahí.

### Qué caben en 500 GB

| Caudal | Por hora | Horas de clase |
|---|---:|---:|
| Hoy · 1,93 Mbps (720p, 24 fps) | 868 MB | **590 h** |
| Reducido · 1,0 Mbps | 448 MB | 1 142 h |
| Solo audio · 128 kbps | 58 MB | 8 889 h |

590 horas son unas **tres horas de clase al día durante un año lectivo
entero**, guardadas para siempre. Como tope por persona es enorme.

### Cuánto tarda cada quien en llegar

Sin poda, y por tanto acumulando desde el primer día:

| Perfil | Aporte mensual | Llega al tope en |
|---|---:|---:|
| Alumno típico | 0,05 GB | nunca (833 años) |
| Alumno intenso | 0,30 GB | nunca (139 años) |
| Docente · 6 h grabadas/mes | 5,62 GB | **7,4 años** |
| Docente · 20 h grabadas/mes | 17,49 GB | 2,4 años |
| Docente · 40 h grabadas/mes | 34,43 GB | 1,2 años |

### Qué costaría

Si alguien **llena** su tope, cuesta **S/ 28,12 al mes**, y lo sigue costando
mientras conserve el material. Ese es el número que hay que mirar si el tope se
publica como promesa, porque es lo que se ha prometido poder gastar.

| Llenado | Almacén | Coste/usuario-mes |
|---:|---:|---:|
| 1 % | 5 GB | S/ 0,28 |
| 5 % | 25 GB | S/ 1,41 |
| 10 % | 50 GB | S/ 2,81 |
| 25 % | 125 GB | S/ 7,03 |
| 50 % | 250 GB | S/ 14,06 |
| **100 %** | **500 GB** | **S/ 28,12** |

Con la mezcla real de este documento (8 % de docentes, grabando 6 h al mes) el
llenado medio y su coste evolucionan así:

| | Almacén medio por usuario | Coste/usuario-mes |
|---|---:|---:|
| Año 1 | 6,0 GB | S/ 0,33 |
| Año 2 | 11,9 GB | S/ 0,67 |
| Año 3 | 17,9 GB | S/ 1,00 |
| Año 5 | 29,8 GB | S/ 1,67 |
| Año 7,4 (docentes en el tope) | 44,1 GB | S/ 2,48 |
| Asíntota | 95 GB | **S/ 5,35** |

### La conclusión, que es incómoda

**El tope de 500 GB por usuario no limita nada donde está el dinero.** Un
alumno no lo roza jamás y un docente normal tarda siete años en tocarlo: la
factura crece exactamente igual que sin tope durante todo el periodo en el que
hay que decidir precios. Lo único que hace el tope es fijar el techo del
desastre, y ese techo es altísimo:

| | Si todos llegaran al tope |
|---|---:|
| 100 usuarios | 49 TB → S/ 2 812/mes |
| 1000 usuarios | 488 TB → **S/ 28 125/mes** |

Contra lo que dan de sí los planes actuales, el desajuste es de dos órdenes de
magnitud:

| Plan | Presupuesto de infra | Almacén que permite | Lo que permitiría el tope de 500 GB |
|---|---:|---:|---:|
| Inicia · S/ 47 (~60 activos) | S/ 18,80 | 334 GB en toda la academia | 29 TB · **90× de más** |
| Crece · S/ 99 (~250 activos) | S/ 39,60 | 704 GB en toda la academia | 122 TB · **178× de más** |

### La misma cifra, bien puesta

500 GB es un buen número; el error es la unidad. **Por empresa** en vez de por
usuario, encaja casi exactamente en el presupuesto:

| | Por usuario | Por empresa |
|---|---:|---:|
| Coste si se llena | S/ 28,12 por cada usuario | S/ 28,12 en total |
| Sobre el plan Crece (S/ 99) | insostenible | 28 % del precio |
| Horas de clase que caben | 590 h por persona | 590 h para toda la academia |

Un tope de **300 GB en Inicia y 700 GB en Crece** —los números de §7— deja el
almacenamiento entre el 40 % y el 20 % de la mensualidad, y una academia con
seis profesores que graben 6 h al mes lo alcanza en unos dos años. Es entonces
cuando la caducidad de §6.3 tiene que estar puesta: sin ella, el tope no es un
límite de gasto sino una fecha en la que el producto deja de funcionar.

Y si de todos modos se quiere anunciar «500 GB» en la página, la forma honesta
de hacerlo es como bolsa compartida de la academia, que es además la que ya
existe en el código (`limits.maxStorageBytes` es por empresa, no por usuario).

---

## 9 · Qué revisar cada cierto tiempo

1. El caudal real de las grabaciones frente a los 868 MB/hora de este
   documento, midiéndolo sobre grabaciones de verdad.
2. La proporción de docentes sobre el total: es el multiplicador de todo el
   modelo y aquí va supuesto en el 8 %.
3. Los precios de R2 y de Atlas, y el tipo de cambio.
4. El almacén acumulado por empresa, que es el aviso temprano de que un
   cliente se ha vuelto caro. Conviene enseñarlo en el panel de administración
   de la plataforma antes de que aparezca en la factura.
5. El llenado real del tope de almacenamiento por empresa frente a la
   trayectoria de §8: es la comprobación de si el modelo de este documento se
   parece a la realidad.
