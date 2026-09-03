# La oferta: benchmark, marco y precios

Documento de trabajo detrás de la página de venta (`/`). Explica de dónde
salen los precios y por qué la página está montada como está, para que
cambiarlos sea una decisión y no una corazonada.

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
| **Maya Classroom** | S/ 179 – 749 | **0 %** | **Sí** |

### La cuenta que decide

El precio de lista engaña. Lo que importa es qué se lleva cada camino de
alguien que factura **S/ 10 000 al mes**:

| | Se lleva al mes | Al año |
|---|---|---|
| Hotmart | ≈ S/ 990 | ≈ S/ 11 900 |
| Teachable (entrada) | ≈ S/ 860 | ≈ S/ 10 300 |
| Thinkific | ≈ S/ 185 – 750 | ≈ S/ 2 200 – 9 000 |
| Kajabi | ≈ S/ 335 – 1 500 | ≈ S/ 4 000 – 18 000 |
| **Maya Classroom (plan Crece)** | **S/ 349** | **S/ 4 190** |

La comisión no se nota en la primera venta; se nota al año. Ese es el argumento
central de la página, y por eso la comparativa va con números y no con
adjetivos.

### Dónde no competimos

No competimos en precio de entrada: Hotmart es gratis y siempre lo será. Se
compite en **propiedad**. Quien vende en un marketplace no tiene la marca, ni el
dominio, ni la lista de sus alumnos, y las reglas se las cambian sin avisar. Es
la diferencia entre alquilar y comprar, y hay que decirlo en esos términos.

---

## 2 · El marco: Hormozi aplicado

De *$100M Offers* y *$100M Leads*, lo que se ha usado y dónde.

### La ecuación de valor

> valor = (resultado soñado × probabilidad percibida) ÷ (tiempo × esfuerzo)

| Palanca | Cómo se sube o se baja | Dónde se ve en la página |
|---|---|---|
| Resultado soñado ↑ | «Tu propia academia», no «un LMS» | Titular y sección de la demostración |
| Probabilidad percibida ↑ | Una demostración real y clicable, no capturas | Sección oscura, con dos botones a la demo |
| Tiempo ↓ | 7 días hábiles, con fecha | «Siete días hábiles, cuatro pasos» |
| Esfuerzo ↓ | Lo montamos nosotros: dominio, marca, cursos y cobros | Desglose de la implementación |

### La oferta irresistible

- **Oferta central**: plataforma propia + implementación llave en mano.
- **Desglose de valor**: la implementación se descompone en ocho conceptos con
  su precio suelto (S/ 4 700 en total) frente al precio real (desde S/ 1 490).
  «Implementación» no dice nada; ocho líneas con precio, sí.
- **Garantía**: publicada en 7 días o se devuelve la implementación completa. Es
  una garantía condicional sobre algo que depende de nosotros, no del cliente,
  que es lo que la hace creíble y sostenible.
- **Anclaje**: la comparativa se lee antes que los precios. Cuando se llega a
  S/ 349 al mes, el número con el que se compara ya es S/ 990.
- **Tres planes**: el del medio destacado y con más contenido por sol. El de
  arriba (S/ 4 900 + S/ 749) existe sobre todo para que el del medio parezca
  razonable.

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
| Implementación | S/ 1 490 | **S/ 2 490** | S/ 4 900 |
| Mensualidad | S/ 179 | **S/ 349** | S/ 749 |
| Alumnado | 300 | 2 000 | Ilimitado |

Los tres están en `apps/web/src/app/features/landing/landing.data.ts`. Cambiar
un precio es cambiar un número ahí.

### Por qué esta horquilla

- **S/ 349 al mes** deja el plan intermedio por debajo de lo que se lleva
  Hotmart de quien factura S/ 10 000, que es el cliente objetivo. Por debajo de
  esa cifra el argumento se sostiene solo.
- **La implementación existe** porque el trabajo existe: montar, conectar el
  dominio, aplicar la marca, cargar cursos y probar el cobro son horas
  nuestras. Cobrarlas aparte permite además una mensualidad baja, que es lo que
  quita el miedo a empezar.
- **S/ 2 490 frente a S/ 4 700** de valor desglosado: un 47 % de descuento
  aparente sin regalar nada, porque los conceptos sueltos son precios de
  mercado defendibles uno a uno.

### Qué revisar cada cierto tiempo

1. El tipo de cambio, que mueve toda la columna de la competencia.
2. Los precios de Teachable, Thinkific y Kajabi, que cambian cada año.
3. La comisión de Hotmart: si sube, el argumento se refuerza solo.
4. El coste real de operar cada academia (infraestructura y soporte), que es
   el suelo por debajo del cual la mensualidad no puede bajar.
