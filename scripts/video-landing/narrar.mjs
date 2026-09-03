/* -------------------------------------------------------------------------- */
/*  Locución del vídeo de la landing, con ElevenLabs                           */
/*                                                                            */
/*  Genera un MP3 por escena a partir de `guion.json` y los deja en `audio/`,  */
/*  que es donde `montar.mjs` los busca. Si están, la duración de cada escena  */
/*  la manda la locución y no el guion, así que el vídeo se ajusta solo.       */
/*                                                                            */
/*    node scripts/video-landing/narrar.mjs                                    */
/*    node scripts/video-landing/narrar.mjs --voces   (qué voces hay)          */
/*                                                                            */
/*  La clave sale del `.env` de la raíz; no hace falta exportarla a mano.      */
/* -------------------------------------------------------------------------- */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` y no `.pathname`: en Windows el pathname de una URL
// `file:` conserva la barra inicial delante de la letra de unidad
// (`/C:/…`), y todo lo que se construya sobre eso acaba en `C:\C:\…`.
const BASE = path.dirname(fileURLToPath(import.meta.url));
const guion = JSON.parse(fs.readFileSync(`${BASE}/guion.json`, 'utf8'));
const salida = `${BASE}/audio`;
const soloListar = process.argv.includes('--voces');

/* --------------------------------- Clave --------------------------------- */

/**
 * La clave, del entorno o del `.env` de la raíz.
 *
 * Antes solo se miraba el entorno, y como la clave vive en el `.env` del
 * proyecto había que exportarla a mano antes de cada ejecución —con una forma
 * distinta en bash y en PowerShell—. Leer el fichero quita ese paso y el error
 * de escribirlo mal.
 */
function claveElevenLabs() {
  const delEntorno = process.env.ELEVENLABS_API_KEY?.trim();
  if (delEntorno) return delEntorno;

  const env = path.resolve(BASE, '../../.env');
  if (!fs.existsSync(env)) return null;
  const linea = fs
    .readFileSync(env, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('ELEVENLABS_API_KEY='));

  return linea?.slice('ELEVENLABS_API_KEY='.length).trim().replace(/^["']|["']$/g, '') || null;
}

const clave = claveElevenLabs();
if (!clave) {
  console.error(
    'Falta ELEVENLABS_API_KEY.\n' +
      '  Póngala en el .env de la raíz:  ELEVENLABS_API_KEY=sk_…\n' +
      '  O en el entorno:\n' +
      '    bash:       ELEVENLABS_API_KEY=... node scripts/video-landing/narrar.mjs\n' +
      '    PowerShell: $env:ELEVENLABS_API_KEY = "..."; node scripts/video-landing/narrar.mjs',
  );
  process.exit(1);
}

const cabeceras = { 'xi-api-key': clave, 'Content-Type': 'application/json' };

/* ---------------------------------- Voz ---------------------------------- */

/**
 * `eleven_multilingual_v2` es el modelo que pronuncia bien el español; los
 * monolingües leen los nombres propios con acento inglés.
 */
const MODELO = process.env.ELEVENLABS_MODEL?.trim() || 'eleven_multilingual_v2';

/**
 * Qué acento se prefiere, de mejor a peor, para el mercado peruano.
 *
 * No se fija un identificador de voz a fuego porque el catálogo de cada cuenta
 * de ElevenLabs es distinto: una voz escrita aquí puede no existir allí, y el
 * error que da entonces es un 400 que no explica nada. Se elige la mejor voz
 * de las que la cuenta tenga de verdad, y solo si no hay ninguna en español se
 * dice qué había.
 */
const ACENTOS = ['peruvian', 'peru', 'latin american', 'latam', 'mexican', 'colombian', 'spanish'];

/** Puntúa una voz: cuanto más peruana y más de locución comercial, mejor. */
function puntuar(voz) {
  const etiquetas = voz.labels ?? {};
  const texto = [
    etiquetas.language,
    etiquetas.accent,
    etiquetas.descriptive,
    etiquetas.use_case,
    voz.name,
    voz.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Nativa en español, o solo capaz de hablarlo. La diferencia importa: media
  // biblioteca de ElevenLabs son voces inglesas que el modelo multilingüe hace
  // leer en español, y se les nota el acento en cuanto sale un nombre propio.
  // Las inglesas quedan como último recurso, nunca por delante de una nativa.
  const nativa = etiquetas.language === 'es' || /\bspanish\b|español|castellano/.test(texto);
  const capaz = voz.verified_languages?.some((l) => l.language === 'es');
  if (!nativa && !capaz) return 0;

  // La base la da ser nativa; el acento decide entre las candidatas.
  const acento = ACENTOS.findIndex((a) => texto.includes(a));
  let punto = (nativa ? 300 : 100) + (acento === -1 ? 0 : (ACENTOS.length - acento) * 10);

  // Entre las inglesas, las que ElevenLabs ha verificado en español van muy por
  // delante: las demás pronuncian el español de oído y se nota en la primera
  // palabra con tilde.
  if (!nativa && capaz) punto += 40;

  // Las de España se entienden, pero en Perú restan cercanía.
  if (/\bcastilian\b|\bspain\b|peninsular/.test(texto)) punto -= 60;

  // El registro: esto es una locución didáctica y comercial. Una voz de
  // telebasura o de redes suena a otra cosa aunque pronuncie perfecto, y el
  // empate entre candidatas se decide aquí y no por el orden del catálogo.
  if (/informative|educational|advertis/.test(texto)) punto += 25;
  else if (/narration|narrative|professional/.test(texto)) punto += 10;
  if (/social media|entertainment/.test(texto)) punto -= 20;
  // Los personajes de animación quedan fuera: esto no es un dibujo animado.
  if (/characters|animation/.test(texto)) punto -= 80;

  return punto;
}

/**
 * Las voces de la cuenta, ya ordenadas por lo bien que le vienen al vídeo.
 *
 * Devuelve `null` —y no aborta— cuando la clave no puede leerlas: los permisos
 * de ElevenLabs son por operación, y una clave que solo puede sintetizar sigue
 * sirviendo para todo esto si se le dice qué voz usar. Abortar ahí obligaría a
 * ampliar permisos para algo que en el fondo es una comodidad.
 */
async function vocesDeLaCuenta() {
  const respuesta = await fetch('https://api.elevenlabs.io/v2/voices?page_size=100', {
    headers: cabeceras,
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    const sinPermiso = respuesta.status === 401 && cuerpo.includes('voices_read');

    if (sinPermiso) {
      console.warn(
        'Aviso: la clave no tiene el permiso `voices_read`, así que no puedo\n' +
          '       elegir la voz sola. Dos salidas:\n' +
          '         · Marcar «Voices → Read» en la clave (ElevenLabs → Perfil →\n' +
          '           API Keys) y volver a lanzar esto.\n' +
          '         · Pasar la voz a mano con ELEVENLABS_VOICE_ID.\n',
      );
      return null;
    }

    console.error(
      `ElevenLabs respondió ${respuesta.status} al pedir las voces.\n` +
        (respuesta.status === 401
          ? '  La clave de ELEVENLABS_API_KEY no es válida o fue revocada.\n' +
            '  Genere una nueva en https://elevenlabs.io → Perfil → API Keys.\n'
          : '') +
        `  ${cuerpo.slice(0, 300)}`,
    );
    process.exit(1);
  }

  const { voices } = await respuesta.json();
  return voices.map((v) => ({ ...v, punto: puntuar(v) })).sort((a, b) => b.punto - a.punto);
}

const vozPedida = process.env.ELEVENLABS_VOICE_ID?.trim();
// Con la voz ya elegida a mano no hace falta el catálogo, y así una clave sin
// `voices_read` sirve igual.
const voces = vozPedida && !soloListar ? null : await vocesDeLaCuenta();

if (soloListar) {
  if (!voces) process.exit(1);
  console.log('Voces de la cuenta (las de arriba son las que este guion elegiría):\n');
  for (const v of voces.slice(0, 40)) {
    const e = v.labels ?? {};
    console.log(
      `  ${String(v.punto).padStart(3)}  ${v.voice_id}  ${v.name}` +
        `  · ${[e.language, e.accent, e.gender, e.use_case].filter(Boolean).join(', ')}`,
    );
  }
  process.exit(0);
}

/**
 * La voz: la que se pida por entorno, o la mejor en español de la cuenta.
 */
const VOZ = vozPedida || (voces?.[0]?.punto > 0 ? voces[0].voice_id : null);
if (!VOZ) {
  console.error(
    voces
      ? 'La cuenta de ElevenLabs no tiene ninguna voz en español.\n' +
          '  Añada una desde la biblioteca de voces (busque «Spanish · Latin American»)\n' +
          '  o pase una con ELEVENLABS_VOICE_ID.\n' +
          '  Para ver las que hay: node scripts/video-landing/narrar.mjs --voces'
      : 'Sin `voices_read` hay que decir qué voz usar:\n' +
          '  PowerShell: $env:ELEVENLABS_VOICE_ID = "..."; node scripts/video-landing/narrar.mjs\n' +
          '  bash:       ELEVENLABS_VOICE_ID=... node scripts/video-landing/narrar.mjs',
  );
  process.exit(1);
}

/** Cómo se anuncia una voz por pantalla. */
const nombrar = (id) => {
  const v = voces?.find((x) => x.voice_id === id);
  if (!v) return id;
  const etiquetas = [v.labels?.language, v.labels?.accent].filter(Boolean).join(', ');
  return etiquetas ? `${v.name} (${etiquetas})` : v.name;
};

let vozActiva = VOZ;
console.log(`voz: ${nombrar(vozActiva)} · modelo: ${MODELO}\n`);

/**
 * Baja a la mejor voz que el plan de la cuenta sí permita usar.
 *
 * Las voces de la biblioteca compartida —las únicas nativas en español— están
 * cerradas por API en el plan gratuito, y ElevenLabs solo lo dice al intentar
 * sintetizar, con un 402. Antes de dejar el vídeo mudo por eso, se cae a la
 * mejor `premade` verificada en español, que suena a español neutro y no a
 * inglés leyendo español. No es lo ideal, y por eso se avisa a gritos.
 */
function vozDeRespaldo() {
  const respaldo = voces?.find((v) => v.category === 'premade' && v.punto > 0);
  if (!respaldo) return null;

  console.warn(
    `\nAviso: «${nombrar(vozActiva)}» es una voz de biblioteca y el plan gratuito de\n` +
      '       ElevenLabs no deja usarlas por API. Sigo con la mejor voz disponible.\n' +
      `       Para una voz nativa de verdad hace falta plan de pago:\n` +
      '       elevenlabs.io → Subscription. Luego borre `audio/` y repita el paso 3.\n' +
      `       Voz de respaldo: ${nombrar(respaldo.voice_id)}\n`,
  );
  return respaldo.voice_id;
}

/* -------------------------------- Locución -------------------------------- */

fs.mkdirSync(salida, { recursive: true });

for (const escena of guion.escenas) {
  const destino = `${salida}/${escena.id}.mp3`;
  if (fs.existsSync(destino)) {
    console.log(`  ${escena.id} · ya estaba`);
    continue;
  }

  const sintetizar = (voz) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        text: escena.sub,
        model_id: MODELO,
        // El español de Perú no es un ajuste de la API: sale de la voz. Se marca
        // igualmente el idioma para que el modelo no dude con las frases cortas.
        language_code: 'es',
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

  let respuesta = await sintetizar(vozActiva);

  // El plan gratuito no deja usar voces de biblioteca, y solo lo dice aquí.
  if (respuesta.status === 402 && !process.env.ELEVENLABS_VOICE_ID) {
    const respaldo = vozDeRespaldo();
    if (respaldo) {
      vozActiva = respaldo;
      respuesta = await sintetizar(vozActiva);
    }
  }

  if (!respuesta.ok) {
    console.error(`  ${escena.id} · ElevenLabs respondió ${respuesta.status}: ${await respuesta.text()}`);
    process.exit(1);
  }

  fs.writeFileSync(destino, Buffer.from(await respuesta.arrayBuffer()));
  console.log(`  ${escena.id} · ${escena.sub.slice(0, 58)}…`);
}

console.log(`\nLocución en ${salida}. Ahora: node scripts/video-landing/montar.mjs`);
