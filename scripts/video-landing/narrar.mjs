/* -------------------------------------------------------------------------- */
/*  Locución del vídeo de la landing, con ElevenLabs                           */
/*                                                                            */
/*  Genera un MP3 por escena a partir de `guion.json` y los deja en `audio/`,  */
/*  que es donde `montar.mjs` los busca. Si están, la duración de cada escena  */
/*  la manda la locución y no el guion, así que el vídeo se ajusta solo.       */
/*                                                                            */
/*    ELEVENLABS_API_KEY=... node scripts/video-landing/narrar.mjs             */
/*                                                                            */
/*  En PowerShell:                                                            */
/*    $env:ELEVENLABS_API_KEY = "..."; node scripts/video-landing/narrar.mjs   */
/* -------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';

const BASE = path.dirname(new URL(import.meta.url).pathname);
const guion = JSON.parse(fs.readFileSync(`${BASE}/guion.json`, 'utf8'));
const salida = `${BASE}/audio`;

const clave = process.env.ELEVENLABS_API_KEY?.trim();
if (!clave) {
  console.error(
    'Falta ELEVENLABS_API_KEY.\n' +
      '  bash:       ELEVENLABS_API_KEY=... node scripts/video-landing/narrar.mjs\n' +
      '  PowerShell: $env:ELEVENLABS_API_KEY = "..."; node scripts/video-landing/narrar.mjs',
  );
  process.exit(1);
}

/**
 * Voz de la locución.
 *
 * Por defecto va una voz latinoamericana del catálogo de ElevenLabs. Para
 * cambiarla, `ELEVENLABS_VOICE_ID` con el identificador de la que se prefiera
 * —se copia desde la biblioteca de voces de la propia ElevenLabs—.
 */
const VOZ = process.env.ELEVENLABS_VOICE_ID?.trim() || 'CwhRBWXzGAHq8TQ4Fs17';

/**
 * `eleven_multilingual_v2` es el modelo que pronuncia bien el español; los
 * monolingües leen «S/» y los nombres propios con acento inglés.
 */
const MODELO = process.env.ELEVENLABS_MODEL?.trim() || 'eleven_multilingual_v2';

fs.mkdirSync(salida, { recursive: true });

for (const escena of guion.escenas) {
  const destino = `${salida}/${escena.id}.mp3`;
  if (fs.existsSync(destino)) {
    console.log(`  ${escena.id} · ya estaba`);
    continue;
  }

  const respuesta = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}`, {
    method: 'POST',
    headers: { 'xi-api-key': clave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: escena.sub,
      model_id: MODELO,
      voice_settings: {
        // Estabilidad alta y poca variación: es una locución comercial, no una
        // interpretación. Interesa que las diez frases suenen a la misma persona.
        stability: 0.55,
        similarity_boost: 0.8,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!respuesta.ok) {
    console.error(`  ${escena.id} · ElevenLabs respondió ${respuesta.status}: ${await respuesta.text()}`);
    process.exit(1);
  }

  fs.writeFileSync(destino, Buffer.from(await respuesta.arrayBuffer()));
  console.log(`  ${escena.id} · ${escena.sub.slice(0, 58)}…`);
}

console.log(`\nLocución en ${salida}. Ahora: node scripts/video-landing/montar.mjs`);
