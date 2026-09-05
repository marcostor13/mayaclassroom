# La oferta: benchmark, marco y precios

Documento de trabajo detrás de la página de venta (`/`). Explica de dónde
salen los precios y por qué la página está montada como está, para que
cambiarlos sea una decisión y no una corazonada.

---

## 0 · A quién le hablamos

**El producto que se vende es el aula virtual, no la tienda de cursos.**

La primera versión de la página se dirigía solo a quien ya vende cursos en un
marketplace y paga comisión. El argumento —«la plataforma no es tuya»— es
bueno, pero describe a una minoría del mercado peruano y deja fuera a quien
constituye la mayor parte de la demanda real:

- Academias e institutos que ya dan clase y la dan por Zoom, con el material en
  Drive y el grupo en WhatsApp.
- Centros de capacitación y colegios que necesitan constancia: avance,
  asistencia, notas y certificados.
- Empresas que forman a su propia gente y no venden nada.
- Profesores por su cuenta que sí venden, y que además necesitan un aula.

Para todos ellos el dolor no es la comisión: es que **su curso vive en cinco
sitios a la vez y nadie sabe quién aprendió**. Ese es el gancho de la página, y
la venta —catálogo público, cobros, cero comisión— entra después, como una
capacidad más que se enciende si hace falta.

Consecuencias en la página:

| | Antes | Ahora |
|---|---|---|
| Titular | «Vendes tus cursos, pero la plataforma no es tuya» | «Tus alumnos merecen un aula, no un grupo de WhatsApp» |
| Dolores | Comisión, marca, lista de alumnos, reglas | Curso disperso, nadie sabe quién avanzó, sin constancia, marca ajena |
| Sección central | Comparativa de precios | **El aula por dentro**: seis bloques para el alumno y seis para el docente |
| Comparativa | Precio y comisión contra marketplaces | Tres caminos: Zoom+Drive+WhatsApp / marketplace / Maya |
| Demostración | «Mira el catálogo» | «Entra como alumna», con credenciales a la vista |
| Comisión | El argumento entero | Una fila de la tabla y una nota al pie |

No se ha perdido nada del argumento de propiedad: sigue en los dolores, en la
tabla y en las preguntas. Solo ha dejado de ser lo primero.

### Las clases en vivo

La videoconferencia es **nativa** y eso es un argumento de venta, no un detalle
de arquitectura. La página lo cuenta como la consecuencia natural de su propia
tesis: si la clase vive en Zoom, la grabación, la asistencia y los treinta
minutos en los que más se mira la pantalla son de Zoom; si vive en tu aula, son
tuyos. El razonamiento técnico y sus límites están en
[`LIVE.md`](LIVE.md).

Lo que la página **no** debe prometer, por si se retoca:

- Que sustituye a un SFU. La malla pone el techo del formato «reunión» en 8-12
  cámaras; el modo «clase» aguanta grupos grandes porque solo emite quien
  presenta. La página dice «hasta 25 por sala», que es el tope por defecto.
- Que funciona en cualquier red sin configurar nada. Sin TURN, una red
  corporativa con NAT simétrico no conecta. Eso es cosa de la implementación,
  no del cliente, y por eso no sale en la página; pero no se promete lo
  contrario.
- Que graba sola sin nadie delante. Graba el navegador de quien presenta y la
  pestaña tiene que seguir abierta.

Una versión anterior de esta página anunciaba una integración con Zoom y Meet
como «en camino». Se retiró al entregarse la videoconferencia propia: además de
haber quedado falsa, contaba una historia más débil que la real.

---

## 1 · Qué cobra el mercado

Precios de referencia consultados en **septiembre de 2026**. Las cifras en
soles son conversión aproximada de los precios en dólares.

| Plataforma | Mensualidad | Comisión por venta | ¿La plataforma es del vendedor? |
|---|---|---|---|
| **Hotmart** | US$ 0 | **9,9 % + US$ 0,50** por venta | No |
| **Teachable** | US$ 29 – 309 | 7,5 % en el plan de entrada; 0 % arriba | No |
| **Thinkific** | US$ 49 – 199 | 0 % | No |
| **Kajabi** | US$ 89 – 399 | 0 % | No |
| **Sabionet** (LatAm) | US$ 0 – 49+ | 9,9 % en el gratuito; 0 % de pago | No |
| LMS corporativo en Perú | US$ 150 – 240 | — | No |
| **Maya Classroom** | **S/ 47 – 99** | **0 %** | **Sí** |

### La cuenta que decide

El precio de lista engaña. Lo que importa es qué se lleva cada camino de
alguien que factura **S/ 10 000 al mes**:

| | Se lleva al mes | Al año |
|---|---|---|
| Hotmart | ≈ S/ 990 | ≈ S/ 11 900 |
| Teachable (entrada) | ≈ S/ 860 | ≈ S/ 10 300 |
| Thinkific | ≈ S/ 185 – 750 | ≈ S/ 2 200 – 9 000 |
| Kajabi | ≈ S/ 335 – 1 500 | ≈ S/ 4 000 – 18 000 |
| **Maya Classroom (plan Crece)** | **S/ 99** | **S/ 1 188** |

La comisión no se nota en la primera venta; se nota al año. Ese es el argumento
central de la página, y por eso la comparativa va con números y no con
adjetivos.

### Dónde no competimos

No competimos en precio de entrada: Hotmart es gratis y siempre lo será, y
Google Classroom también. Se compite en dos cosas.

**Contra los marketplaces, en propiedad.** Quien vende ahí no tiene la marca, ni
el dominio, ni la lista de sus alumnos, y las reglas se las cambian sin avisar.
Es la diferencia entre alquilar y comprar.

**Contra el montaje suelto (Zoom + Drive + WhatsApp) y contra Classroom, en
constancia.** Repartir tareas no es tener un aula: no hay avance por alumno, ni
libro de calificaciones con pesos, ni certificados verificables, ni
itinerarios, ni marca propia. Cuando a alguien le basta con repartir tareas, se
le dice de frente —está escrito así en las preguntas de la página—, porque
discutirlo se pierde y decirlo gana credibilidad para el resto.

---

## 2 · El marco: Hormozi aplicado

De *$100M Offers* y *$100M Leads*, lo que se ha usado y dónde.

### La ecuación de valor

> valor = (resultado soñado × probabilidad percibida) ÷ (tiempo × esfuerzo)

| Palanca | Cómo se sube o se baja | Dónde se ve en la página |
|---|---|---|
| Resultado soñado ↑ | «Tu propia aula virtual», no «un LMS» | Titular y sección «El aula, por dentro» |
| Probabilidad percibida ↑ | Una demostración real y clicable, no capturas | Sección oscura, con dos botones a la demo |
| Tiempo ↓ | 7 días hábiles, con fecha | «Siete días hábiles, cuatro pasos» |
| Esfuerzo ↓ | Lo montamos nosotros: dominio, marca, cursos y roles | Desglose de la implementación |

### La oferta irresistible

- **Oferta central**: aula virtual propia + implementación llave en mano.
- **Desglose de valor**: la implementación se descompone en ocho conceptos con
  su precio suelto (S/ 4 700 en total) frente al precio real (S/ 347).
  «Implementación» no dice nada; ocho líneas con precio, sí.
- **Garantía**: funcionando en 7 días o se devuelve la implementación completa. Es
  una garantía condicional sobre algo que depende de nosotros, no del cliente,
  que es lo que la hace creíble y sostenible.
- **Anclaje**: la comparativa de los tres caminos se lee antes que los precios,
  y la nota al pie deja el 9,9 % de comisión (≈ S/ 12 000 al año sobre
  S/ 10 000 al mes) en la cabeza justo antes de enseñar S/ 99.
- **Tres planes**: el del medio destacado y con más contenido por sol. El de
  arriba va a cotización, sin precio de lista: además de que su alcance cambia
  en cada caso, un «a cotizar» arriba hace que los dos de abajo se lean como
  precio cerrado y sin sorpresas.

### Lo que se ha dejado fuera a propósito

- **Escasez y urgencia.** Hormozi las recomienda, y funcionan, pero solo si son
  verdad. «Quedan 3 plazas» en una página que nadie audita es mentira, y en un
  negocio que vende por WhatsApp la mentira se descubre en la primera llamada.
  Si de verdad hay un tope de implementaciones al mes, se añade y se cumple.
- **Testimonios.** No hay ninguno inventado. Cuando haya clientes reales, van
  entre la garantía y las preguntas, con nombre y negocio.
- **Cifras de resultados.** Nada de «+300 academias». Cuando existan, se ponen.

---

## 3 · Los precios

| | Inicia | **Crece** | Escala |
|---|---|---|---|
| Implementación | S/ 347 | **S/ 347** | A cotizar |
| Mensualidad | S/ 47 | **S/ 99** | A cotizar |
| Alumnado | 300 | 2 000 | Ilimitado |

Los tres están en `apps/web/src/app/features/landing/landing.data.ts`. Cambiar
un precio es cambiar un número ahí; la implementación vive además en la
constante `IMPLEMENTACION_DESDE`, porque la página la enseña en dos sitios.

### Por qué esta horquilla

- **S/ 47 y S/ 99 al mes** no compiten con Hotmart, Teachable o Kajabi: los
  dejan fuera de la conversación. Quien factura S/ 10 000 al mes está pagando
  ≈ S/ 990 de comisión; ver S/ 99 al lado convierte la comparación en una
  decisión obvia y quita cualquier objeción de precio antes de que aparezca.
- **Una sola implementación, S/ 347 en los dos planes**, porque el trabajo de
  montar la academia no cambia por vender más: montar, conectar el dominio,
  aplicar la marca, cargar cursos y probar el cobro son las mismas horas. Un
  solo importe se recuerda, dos hay que compararlos.
- **S/ 347 frente a S/ 4 700** de valor desglosado: el ancla es agresiva, y solo
  se sostiene mientras los ocho conceptos sueltos sigan siendo precios de
  mercado defendibles uno a uno. Si alguna vez hay que justificarlo en una
  llamada, el argumento es que la implementación es captación, no margen: se
  cobra para filtrar a quien va en serio, y el negocio está en la mensualidad
  recurrente.
- **El plan de arriba no lleva precio.** Varias sedes, integraciones a medida y
  acuerdos de nivel de servicio no se cotizan igual dos veces, y un «a cotizar»
  arriba refuerza que los dos de abajo sí son precio cerrado.

### El riesgo de este tramo

Una mensualidad de S/ 47 tiene que cubrir infraestructura y soporte de cada
academia. Es el punto que hay que vigilar antes que ningún otro: si el coste
real de operar una instalación se acerca a esa cifra, el plan Inicia deja de
tener margen y hay que subirlo o recortar lo que incluye.

Ese coste está calculado en [`COSTES.md`](COSTES.md), y el resultado obliga a
matizar cómo se enuncian los planes: el coste no lo hace el alumnado sino las
horas grabadas, así que un tope de asientos no protege el margen. Un alumno
cuesta S/ 0,10 al mes y un docente que graba seis horas, S/ 7,72. Los topes que
sí sirven son gigas, horas grabadas y meses de retención.

### Qué revisar cada cierto tiempo

1. El tipo de cambio, que mueve toda la columna de la competencia.
2. Los precios de Teachable, Thinkific y Kajabi, que cambian cada año.
3. La comisión de Hotmart: si sube, el argumento se refuerza solo.
4. El coste real de operar cada academia (infraestructura y soporte), que es
   el suelo por debajo del cual la mensualidad no puede bajar.
