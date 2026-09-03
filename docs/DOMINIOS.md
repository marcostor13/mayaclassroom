# Dominios propios de las empresas

Cómo una empresa sirve su página pública en su propia dirección
—`cursos.dulcelima.pe`— en lugar de en la de la plataforma
—`mayaclassroom.pe/p/dulcelima`—, y por qué está resuelto así y no de otra
manera.

---

## 1 · El problema, que no es el que parece

La aplicación ya sabe servir cualquier empresa: le basta con el identificador.
Lo difícil no es pintar la página, es **llegar hasta ella**.

Esta infraestructura no expone ninguna IP pública. Cloudflare recibe el
tráfico y lo entrega por un **túnel** (`cloudflared`), y el túnel enruta por
nombre de host a un puerto de la máquina de Coolify. Para que un nombre llegue
al túnel tiene que existir un `CNAME` que apunte a
`<id-del-túnel>.cfargotunnel.com`.

Y ahí está el nudo: **`cfargotunnel.com` solo acepta registros de la propia
cuenta de Cloudflare**. El dominio de un cliente está en su cuenta y en su
proveedor, no en la nuestra. Un cliente no puede apuntar su CNAME al túnel
aunque quiera.

## 2 · Las tres salidas, y por qué se eligió la tercera

| Opción | Qué exigiría | Por qué no |
|---|---|---|
| **IP pública + Let's Encrypt** | Sacar el proxy de Coolify a internet con una IP fija y emitir un certificado por cada dominio | Deshace la razón por la que hay un túnel: deja de haber una sola puerta de entrada, y hay que gestionar renovaciones y rate limits de ACME por cliente |
| **Un dominio por despliegue** | Añadir el nombre del cliente al FQDN de la aplicación en Coolify y una regla al túnel | Solo funciona si el dominio está en nuestra cuenta de Cloudflare, que es justo lo que no pasa. Además, un redespliegue por cada alta |
| **Cloudflare for SaaS** ✅ | Dar de alta el nombre del cliente como *custom hostname* de una zona nuestra | El cliente apunta a un nombre **nuestro**, Cloudflare emite el certificado de **su** nombre y entrega por el túnel de siempre. Cero infraestructura nueva, cero despliegues por alta, certificados automáticos |

El coste de la elegida: Cloudflare for SaaS incluye 100 nombres gratis por
cuenta y cobra por encima de eso. A cambio no hay ni un proceso más que
mantener.

## 3 · Cómo queda el camino

```
Navegador
  │  https://cursos.dulcelima.pe
  ▼
DNS del cliente ── CNAME ──▶ dominios.mayaclassroom.pe   (CUSTOM_DOMAIN_TARGET)
  │
  ▼
Cloudflare  ── custom hostname: emite y renueva el certificado de
  │             cursos.dulcelima.pe (Cloudflare for SaaS)
  ▼
Túnel cloudflared ──▶ Coolify ──▶ contenedor del cliente Angular
  │
  ▼
El cliente pregunta a la API «¿de quién es este anfitrión?»
  GET /api/v1/tenants/resolve?host=cursos.dulcelima.pe  →  { tenantSlug: "dulcelima" }
  │
  ▼
La raíz «/» sirve la página pública de Dulce Lima, sin prefijo
```

`dominios.mayaclassroom.pe` es un nombre corriente de la zona de la
plataforma: su CNAME apunta al túnel como cualquier otro y lo publica
`bun run deploy --dns`. Todos los dominios de todos los clientes entran por
ahí.

## 4 · Configuración del despliegue

| Variable | Para qué |
|---|---|
| `CUSTOM_DOMAIN_TARGET` | Nombre al que apuntan los clientes. **Vacío apaga la función entera** |
| `CUSTOM_DOMAIN_RESOLVER` | Resolutor DNS-over-HTTPS de la comprobación |
| `CUSTOM_DOMAIN_RESERVED` | Nombres que nadie puede reclamar, además de los propios |
| `CLOUDFLARE_SAAS_ZONE_ID` | Zona donde se dan de alta los nombres de cliente |
| `CLOUDFLARE_API_TOKEN` | El mismo del despliegue, con permiso `SSL and Certificates: Edit` |

Pasos una sola vez, del lado de la plataforma:

1. En Cloudflare, **SSL/TLS → Custom Hostnames**, activar Cloudflare for SaaS
   en la zona de la plataforma.
2. Declarar el **fallback origin**: `dominios.mayaclassroom.pe`.
3. Publicar ese nombre como CNAME al túnel y como regla de entrada, igual que
   el resto: `bun run deploy --dns && bun run deploy --tunel`.
4. Poner las variables de arriba y volver a desplegar la API.

Con `CUSTOM_DOMAIN_TARGET` puesto pero sin `CLOUDFLARE_SAAS_ZONE_ID`, la
comprobación de DNS funciona igual y **el certificado no se emite**: el dominio
resuelve y el navegador corta la conexión. Sirve para desarrollo, no para
producción.

## 5 · Lo que hace la empresa

En **Configuración de la empresa → Dominio propio**, quien tenga la capacidad
`maya/tenant:update`:

1. Escribe su dominio y pulsa **Reservar dominio**.
2. La pantalla le entrega dos registros para su proveedor de DNS:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | `CNAME` | `cursos.dulcelima.pe` | `dominios.mayaclassroom.pe` |
   | `TXT` | `_maya-verificacion.cursos.dulcelima.pe` | `maya-verificacion=…` |

3. Pulsa **Comprobar ahora**. Si falta algo, la propia pantalla dice qué.
4. Al pasar la comprobación el dominio queda **Activo** y sirve la página.

### Por qué dos registros y no uno

El `CNAME` dice **a dónde va** el tráfico; el `TXT` dice **quién manda** en ese
nombre. Sin la prueba de propiedad, una empresa podría reservar el dominio de
otra: mientras nadie apunte el DNS no pasaría nada, pero el día que apuntase
estaríamos sirviendo la página de una empresa en el nombre de otra. El testigo
se renueva con cada dominio que se pide, para que la prueba de uno no valga
para el siguiente.

### La raíz de un dominio

En la raíz (`dulcelima.pe`, sin subdominio) el `CNAME` no es legal y los
proveedores lo resuelven con ALIAS o aplanándolo. La comprobación lo admite:
da por bueno el dominio si el CNAME apunta al destino **o** si sus direcciones
coinciden con las del destino.

## 6 · Reglas que aplica la API

- **Un dominio no sirve hasta que se verifica.** El nombre se guarda desde que
  se pide, pero `findByDomain` y `/tenants/resolve` solo responden por los que
  están en `active`.
- **El dominio no se puede colar en el parche de la empresa.** `PATCH
  /tenants/me` descarta `domain` igual que descarta `slug`: pasa por
  `PUT /tenants/me/domain` y su comprobación, o no pasa.
- **Los nombres de la plataforma están reservados**, junto con los de
  `API_URL`, `WEB_URL` y el propio destino, y con sus subdominios.
- **Un dominio ya activo no se apaga al primer tropiezo del DNS.** Se marca el
  error y se sigue sirviendo: apagarlo dejaría a la empresa sin página por una
  consulta que falló una vez.
- **Una empresa suspendida no sirve ni en su propio dominio.** Sería una puerta
  trasera al cierre de una cuenta.

## 7 · Cuando algo no va

| Síntoma | Causa casi siempre |
|---|---|
| «Falta el registro TXT» recién creado | Propagación. El TTL del proveedor manda; suele bastar con esperar unos minutos |
| «No apunta a…» con el CNAME puesto | El proveedor añadió el dominio al nombre: quedó `cursos.dulcelima.pe.dulcelima.pe`. En muchos paneles el nombre va sin el dominio |
| El dominio resuelve y el navegador corta el TLS | Falta el alta en Cloudflare for SaaS: revise `CLOUDFLARE_SAAS_ZONE_ID` y el permiso del token |
| Responde un 404 con el cuerpo vacío | El destino no está publicado como regla del túnel. `bun run deploy --tunel` |
| Sirve la portada de Maya en vez de la de la empresa | El dominio no está en `active`, o `/tenants/resolve` no contesta. Es el respaldo deliberado: mejor la portada que una pantalla en blanco |
