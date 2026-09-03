# Vídeo de la página de venta

Produce `apps/web/public/landing/maya-classroom.mp4` (y su `.webm`): el vídeo
de la primera sección de la landing.

## Antes de empezar

| | Para qué | Cómo se comprueba |
|---|---|---|
| **Node 22 o superior** | Ejecuta los cuatro guiones | `node --version` |
| **ffmpeg 7 o superior** | Monta el vídeo | `ffmpeg -version` |
| **El cliente construido** | Las capturas salen de la aplicación real | `bun run build:web` |
| Clave de ElevenLabs | Solo para la locución (paso 3) | `ELEVENLABS_API_KEY` en el `.env` |

**ffmpeg tiene que ser 7 o superior.** El montaje encadena las escenas con el
filtro `xfade`, que no existe antes de la versión 4.3, y el error que da es
`No such filter: 'xfade'`. En Windows:

```powershell
winget install Gyan.FFmpeg
```

Si prefiere no instalarlo en el sistema, vale un binario suelto:

```powershell
npm i ffmpeg-static
$env:FFMPEG = ".\node_modules\ffmpeg-static\ffmpeg.exe"
```

Playwright (pasos 1 y 2) se instala solo la primera vez si no está.

## Los cuatro pasos

```powershell
bun run build:web                            # el cliente, del que salen las capturas

node scripts/video-landing/capturar.mjs      # 1 · capturas de la plataforma
node scripts/video-landing/diapositivas.mjs  # 2 · dibuja cada escena
node scripts/video-landing/narrar.mjs        # 3 · locución (opcional)
node scripts/video-landing/montar.mjs        # 4 · monta el MP4 y el WebM
```

Cada paso se puede repetir por su cuenta. Si solo cambia el texto, basta con
2, 3 y 4; si solo cambia la voz, con 3 y 4.

El paso 1 levanta él mismo un servidor en el 4310 con el cliente construido, lo
recorre con un navegador y una API simulada, y lo cierra al terminar. No hay
que arrancar nada aparte.

## La locución con ElevenLabs

La clave sale de `ELEVENLABS_API_KEY` en el `.env` de la raíz; no hay que
exportarla a mano. Si prefiere pasarla por entorno, tiene preferencia sobre el
fichero.

```powershell
node scripts/video-landing/narrar.mjs
node scripts/video-landing/montar.mjs
```

Deja un MP3 por escena en `audio/`. El paso 4 los detecta solo, y entonces
**la duración de cada escena la manda la locución**, no el guion: si una frase
sale más larga de lo previsto, la escena se estira para que la voz no se corte.
Sin `audio/`, el vídeo se monta mudo y subtitulado, que es como se reproduce en
la landing de todos modos.

Los MP3 ya generados no se rehacen. Para cambiar una frase, borre ese MP3
concreto y vuelva a lanzar el paso 3: solo se pedirá esa. Para rehacer la
locución entera —al cambiar de voz, por ejemplo—, borre la carpeta `audio/`.

### La voz

El guion **elige solo** la mejor voz en español de la cuenta, prefiriendo el
acento peruano y, si no lo hay, el latinoamericano; las de España restan
cercanía en Perú y se dejan las últimas. No hay ningún identificador escrito a
fuego, porque el catálogo cambia de una cuenta a otra y una voz que no existe
da un 400 que no explica nada.

Para ver qué hay y con qué puntuación:

```powershell
node scripts/video-landing/narrar.mjs --voces
```

Para forzar una concreta:

```powershell
$env:ELEVENLABS_VOICE_ID = "..."   # se copia de la biblioteca de voces
$env:ELEVENLABS_MODEL = "eleven_multilingual_v2"
```

El modelo por defecto ya es `eleven_multilingual_v2`, que es el que pronuncia
bien el español; los monolingües leen los nombres propios con acento inglés.

Si la cuenta no tiene ninguna voz en español, añádala antes desde la biblioteca
de voces de ElevenLabs buscando **Spanish · Latin American**.

> **Ojo con el plan gratuito.** Las voces de la biblioteca compartida —que son
> las únicas nativas en español— **no se pueden usar por API sin plan de pago**,
> y ElevenLabs solo lo dice al sintetizar, con un `402 paid_plan_required`. El
> guion lo detecta y baja solo a la mejor voz `premade` verificada en español,
> avisando por pantalla: sale un español neutro correcto, pero no peruano.
>
> No sirve de nada añadir la voz a la cuenta ni fiarse del campo
> `free_users_allowed` de `/v1/shared-voices`: ese campo se refiere a usarla
> **desde la web de ElevenLabs**, no por API. Comprobado una a una con las
> candidatas latinoamericanas, incluida `Giancarlos`, que es peruana: todas
> devuelven 402 con la cuenta en plan gratuito.
>
> **La salida barata es una voz clonada.** Las clonadas de la propia cuenta sí
> funcionan por API en plan gratuito, y el guion las pone las primeras: son la
> voz de quien vende, que para un vídeo de venta es justo lo que se quiere. El
> vídeo actual está locutado con una de ellas.
>
> Para una voz nativa de biblioteca hay que subir de plan, borrar `audio/` y
> repetir los pasos 3 y 4. El guion elegirá la mejor solo, sin tocar nada.

## El guion

Todo el texto vive en `guion.json`. Cada escena tiene:

| Campo | Qué es |
|---|---|
| `kicker` | La línea pequeña en mayúsculas |
| `titular` | El texto grande; `\n` parte la línea |
| `sub` | El subtítulo, y **lo que se locuta** |
| `dur` | Duración mínima en segundos |
| `captura` | Qué captura enseña, si enseña alguna |

Cambiar el vídeo es cambiar ese fichero y volver a lanzar los pasos 2 a 4.

## Qué se versiona y qué no

Se versiona el resultado —el MP4, el WebM y el cartel de
`apps/web/public/landing`— y las fuentes: el guion, los guiones y las
tipografías. `capturas/`, `diapositivas/` y `audio/` están en `.gitignore`
porque los rehacen los pasos 1, 2 y 3.

## Por si algo falla

| Síntoma | Causa |
|---|---|
| `No such filter: 'xfade'` | ffmpeg anterior a la 4.3. Instale la 7. |
| `No encuentro el cliente construido` | Falta `bun run build:web`. |
| `401 · Invalid API key` en el paso 3 | La clave de `ELEVENLABS_API_KEY` caducó o fue revocada. Genere otra en ElevenLabs → Perfil → API Keys. |
| Diez capturas en blanco | El cliente construido es viejo; reconstruya. |
| La voz se corta al final de una escena | Estaba usando un montaje anterior al arreglo de la lectura de duración: rehaga el paso 4. |
| El vídeo se ve negro en el navegador | Chromium sin códecs propietarios. Por eso se genera también el `.webm`, que la landing sirve como respaldo. |
