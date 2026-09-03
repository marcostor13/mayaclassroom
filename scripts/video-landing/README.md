# Vídeo de la página de venta

Produce `apps/web/public/landing/maya-classroom.mp4`: el vídeo de la primera
sección de la landing. Son cuatro pasos y cada uno se puede repetir por su
cuenta.

```bash
node scripts/video-landing/capturar.mjs      # 1 · capturas de la plataforma
node scripts/video-landing/diapositivas.mjs  # 2 · dibuja cada escena
node scripts/video-landing/narrar.mjs        # 3 · locución (opcional)
node scripts/video-landing/montar.mjs        # 4 · monta el MP4
```

## El guion

Todo el texto está en `guion.json`: una escena por objeto, con su titular, su
subtítulo —que es lo que se locuta— y su duración mínima. Retocar el vídeo es
retocar ese fichero y volver a lanzar los pasos 2 a 4.

## La locución

El paso 3 necesita una clave de ElevenLabs:

```bash
ELEVENLABS_API_KEY=... node scripts/video-landing/narrar.mjs
```

```powershell
$env:ELEVENLABS_API_KEY = "..."; node scripts/video-landing/narrar.mjs
```

Deja un MP3 por escena en `audio/`. El paso 4 los detecta solo: cuando están,
**la duración de cada escena pasa a mandarla la locución**, no el guion, así
que la imagen y la voz no se desincronizan aunque una frase salga más larga de
lo previsto. Sin `audio/`, el vídeo se monta mudo y subtitulado, que es como se
reproduce en la landing de todos modos.

Para cambiar de voz, `ELEVENLABS_VOICE_ID` con el identificador que se copia de
la biblioteca de voces de ElevenLabs.

## Requisitos

- `ffmpeg` **7 o superior**: el montaje usa el filtro `xfade` para encadenar
  las escenas, y ese filtro no existe antes de la versión 4.3. Si no está en el
  sistema, `npm i ffmpeg-static` y `FFMPEG=./node_modules/ffmpeg-static/ffmpeg`.
- Las capturas del paso 1 salen de la aplicación construida servida en el
  puerto 4310, con la API simulada. Es a propósito: lo que se enseña en el
  vídeo es la plataforma de verdad, no una maqueta.
