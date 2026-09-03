/* Monta el vídeo a partir de las diapositivas.
 *
 * Cada escena lleva un movimiento de cámara suave y se encadena con la
 * siguiente por fundido. Las diapositivas están en 4K y el movimiento se hace
 * a 1440p antes de bajar a 1080p: así toda la cadena reduce y nunca amplía,
 * que es lo que dejaría el texto pastoso.
 *
 * Si hay locución (carpeta `audio/` con un mp3 por escena), la duración de
 * cada escena la manda el audio y no el guion.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = path.dirname(new URL(import.meta.url).pathname);
/** `FFMPEG` para apuntar a un binario concreto; si no, el del sistema. */
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const guion = JSON.parse(fs.readFileSync(`${BASE}/guion.json`, 'utf8'));
/** El vídeo va directo a los ficheros públicos del cliente. */
const SALIDA = path.resolve(BASE, '../../apps/web/public/landing/maya-classroom.mp4');
/**
 * Además del MP4 se saca un WebM.
 *
 * El H.264 lo reproduce todo el mundo… salvo las compilaciones de Chromium sin
 * códecs propietarios, que son las de varias distribuciones de Linux y las que
 * usan algunos navegadores derivados. Ahí el vídeo de la portada aparecería
 * como un rectángulo negro. Dos ficheros y un `<source>` de respaldo cuestan
 * poco y quitan ese agujero.
 */
const SALIDA_WEBM = SALIDA.replace(/\.mp4$/, '.webm');
fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
const FPS = 30;
const FUNDIDO = 0.6;

const ffprobeDur = (fichero) => {
  // El binario estático trae ffprobe al lado; si no, se deduce con ffmpeg.
  const salida = execFileSync(FFMPEG, ['-hide_banner', '-i', fichero], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .toString();
  const m = salida.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
};

const dirAudio = `${BASE}/audio`;
const hayAudio = fs.existsSync(dirAudio) && fs.readdirSync(dirAudio).some((f) => f.endsWith('.mp3'));

const escenas = guion.escenas.map((e) => {
  const mp3 = `${dirAudio}/${e.id}.mp3`;
  if (hayAudio && fs.existsSync(mp3)) {
    let dur = null;
    try { dur = ffprobeDur(mp3); } catch { /* se usa la del guion */ }
    // Un respiro antes y después de la frase: encadenar locuciones sin aire
    // hace que se pisen y se entienda peor.
    if (dur) return { ...e, dur: Math.max(e.dur, dur + 1.2), mp3 };
  }
  return { ...e, mp3: null };
});

const total = escenas.reduce((s, e) => s + e.dur, 0) - FUNDIDO * (escenas.length - 1);
console.log(`escenas: ${escenas.length} · locución: ${hayAudio ? 'sí' : 'no'} · duración: ${total.toFixed(1)} s`);

/* ------------------------------ Vídeo ------------------------------------ */

/*
 * Se monta en dos pasadas y no en una.
 *
 * Con una sola orden, las diez escenas se calculan a la vez para alimentar la
 * cadena de fundidos, y ffmpeg se atasca moviendo diez imágenes grandes en
 * paralelo. Rindiendo antes cada escena por separado, la segunda pasada solo
 * tiene que mezclar diez vídeos ya hechos, que es barato.
 */

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'maya-video-'));
const clips = [];

escenas.forEach((e, i) => {
  const reducida = path.join(temporal, `${e.id}.png`);
  const destino = path.join(temporal, `${e.id}.mp4`);

  // La diapositiva se reduce UNA vez a fichero, no dentro de la cadena.
  //
  // Con `-loop 1` la imagen se decodifica en cada fotograma, así que un
  // `scale` en el filtro reescala los 4K treinta veces por segundo: la escena
  // de cinco segundos tardaba dos minutos. Reducida antes, el movimiento de
  // cámara trabaja sobre una imagen pequeña y la escena sale en segundos.
  //
  // 1,1 veces la salida deja margen de sobra para encuadrar, y como el
  // recorte parte de una imagen mayor que 1080p la cadena siempre reduce y el
  // texto no se ensucia.
  execFileSync(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', `${BASE}/diapositivas/${e.id}.png`,
    '-vf', 'scale=2112:1188:flags=lanczos', reducida,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Movimiento de cámara: un desplazamiento lento, no un zoom.
  //
  // `zoompan` reescala la imagen completa en CADA fotograma, y en una máquina
  // modesta eso sale a casi medio segundo por fotograma: una escena de cinco
  // segundos tardaba un minuto entero. Un `crop` de tamaño fijo que se mueve
  // cuesta apenas un desplazamiento de puntero y da el mismo efecto de cámara
  // viva.
  //
  // La imagen reducida mide 2112×1188 y el recorte 1920×1080, así que hay 192
  // px de recorrido horizontal y 108 verticales. Repartidos en la duración de
  // la escena queda una deriva suave, no un barrido.
  const rumbos = [
    { x: `(iw-ow)*t/${e.dur}`, y: '(ih-oh)/2' },
    { x: `(iw-ow)*(1-t/${e.dur})`, y: '(ih-oh)/2' },
    { x: '(iw-ow)/2', y: `(ih-oh)*t/${e.dur}` },
    { x: `(iw-ow)*t/${e.dur}`, y: `(ih-oh)*(1-t/${e.dur})` },
  ];
  const rumbo = rumbos[i % rumbos.length];

  execFileSync(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-loop', '1', '-t', String(e.dur), '-i', reducida,
    '-vf', `crop=1920:1080:x='${rumbo.x}':y='${rumbo.y}',fps=${FPS},setsar=1,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-tune', 'stillimage',
    '-r', String(FPS), destino,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  clips.push(destino);
  console.log(`  escena ${e.id} rendida`);
});

/* ------------------------- Fundidos y locución ---------------------------- */

const args = ['-y', '-hide_banner', '-loglevel', 'error'];
for (const clip of clips) args.push('-i', clip);

const filtros = [];
let cadena = '[0:v]';
let desplazamiento = 0;
for (let i = 1; i < escenas.length; i += 1) {
  desplazamiento += escenas[i - 1].dur - FUNDIDO;
  const destino = i === escenas.length - 1 ? '[vfinal]' : `[x${i}]`;
  filtros.push(`${cadena}[${i}:v]xfade=transition=fade:duration=${FUNDIDO}:offset=${desplazamiento.toFixed(3)}${destino}`);
  cadena = `[x${i}]`;
}

let mapaAudio;
if (hayAudio) {
  // Cada locución entra retrasada hasta donde empieza su escena.
  let t = 0;
  const partes = [];
  escenas.forEach((e, i) => {
    if (e.mp3) {
      args.push('-i', e.mp3);
      const idx = escenas.length + partes.length;
      // 0,6 s de aire antes de que empiece a hablar.
      const ms = Math.round((t + 0.6) * 1000);
      filtros.push(`[${idx}:a]adelay=${ms}|${ms}[a${i}]`);
      partes.push(`[a${i}]`);
    }
    t += e.dur - (i < escenas.length - 1 ? FUNDIDO : 0);
  });
  filtros.push(`${partes.join('')}amix=inputs=${partes.length}:normalize=0,alimiter=limit=0.95[afinal]`);
  mapaAudio = ['-map', '[afinal]', '-c:a', 'aac', '-b:a', '192k'];
} else {
  // Pista muda: sin ella, algunos reproductores tratan el fichero como raro.
  args.push('-f', 'lavfi', '-t', String(total.toFixed(2)), '-i', 'anullsrc=r=48000:cl=stereo');
  mapaAudio = ['-map', `${escenas.length}:a`, '-c:a', 'aac', '-b:a', '128k'];
}

args.push(
  '-filter_complex', filtros.join(';'),
  '-map', '[vfinal]',
  ...mapaAudio,
  // `stillimage` está pensado para planos casi fijos con texto: baja mucho el
  // peso sin que las letras se ensucien, que es justo este caso.
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-tune', 'stillimage',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS),
  SALIDA,
);

console.log('encadenando…');
try {
  execFileSync(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (error) {
  const salida = error.stderr?.toString() ?? String(error);
  console.error(salida.split('\n').filter((l) => /error|invalid|no such|failed/i.test(l)).slice(-8).join('\n') || salida.slice(-1500));
  process.exit(1);
}

fs.rmSync(temporal, { recursive: true, force: true });

console.log('convirtiendo a WebM…');
try {
  execFileSync(
    FFMPEG,
    [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', SALIDA,
      // `cpu-used 4` y `deadline good`: con planos casi fijos, apurar más la
      // compresión cuesta minutos y no se nota.
      '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4',
      '-row-mt', '1', '-pix_fmt', 'yuv420p',
      '-c:a', 'libopus', '-b:a', '96k',
      SALIDA_WEBM,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
} catch (error) {
  console.warn('  no se pudo generar el WebM; el MP4 sirve para casi todo.');
}

const mb = (f) => (fs.existsSync(f) ? `${(fs.statSync(f).size / 1e6).toFixed(1)} MB` : '—');
console.log(`listo: ${SALIDA} · ${mb(SALIDA)}`);
if (fs.existsSync(SALIDA_WEBM)) console.log(`       ${SALIDA_WEBM} · ${mb(SALIDA_WEBM)}`);
