/* Dibuja cada escena del guion como una imagen 3840×2160 (4K) para que el
   movimiento de cámara del montaje no tenga que ampliar y perder nitidez. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Playwright no es dependencia del proyecto —es utillaje, no producción—, así
 * que se busca donde esté y, si no aparece, se instala una vez en una caché
 * fuera del repositorio. Mismo criterio que la skill `revisar-ui`.
 */
async function cargarPlaywright() {
  for (const base of [process.cwd(), path.join(os.tmpdir(), 'maya-utillaje-ui')]) {
    try {
      const require = createRequire(path.join(base, 'index.js'));
      return await import(pathToFileURL(require.resolve('playwright')).href);
    } catch {
      /* Siguiente candidato. */
    }
  }
  const cache = path.join(os.tmpdir(), 'maya-utillaje-ui');
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(path.join(cache, 'package.json'))) {
    execFileSync('npm', ['init', '-y'], { cwd: cache, stdio: 'ignore' });
  }
  execFileSync('npm', ['install', 'playwright'], {
    cwd: cache, stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });
  const require = createRequire(path.join(cache, 'index.js'));
  return await import(pathToFileURL(require.resolve('playwright')).href);
}

const playwright = await cargarPlaywright();
// El paquete es CommonJS: según cómo lo cargue Node, los nombres salen en la
// raíz o colgando de `default`. Se contemplan los dos.
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) {
  console.error('No se pudo cargar Chromium desde Playwright.');
  process.exit(1);
}

/** El navegador de la imagen si está; si no, el que Playwright traiga. */
const navegador = () =>
  chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
  );

// `fileURLToPath` y no `.pathname`: en Windows el pathname de una URL
// `file:` conserva la barra inicial delante de la letra de unidad
// (`/C:/…`), y todo lo que se construya sobre eso acaba en `C:\C:\…`.
const BASE = path.dirname(fileURLToPath(import.meta.url));
const guion = JSON.parse(fs.readFileSync(`${BASE}/guion.json`, 'utf8'));
const salida = `${BASE}/diapositivas`;
fs.mkdirSync(salida, { recursive: true });

/*
 * La misma carpeta, pero escrita como URL.
 *
 * El HTML de cada diapositiva referencia las tipografías y las capturas con
 * `file:`, y ahí no vale la ruta del sistema: en Windows lleva barras
 * invertidas y letra de unidad, que el navegador no resuelve —las tipografías
 * salían con la de respaldo y las capturas, en blanco—.
 */
const BASE_URL = pathToFileURL(`${BASE}/`).href;

const ESTILO = `
  @font-face { font-family: 'Outfit'; src: url('${BASE_URL}tipografias/Outfit-Bold.ttf'); font-weight: 700; }
  @font-face { font-family: 'Outfit'; src: url('${BASE_URL}tipografias/Outfit-Regular.ttf'); font-weight: 400; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --rojo: #FF3B2E; --rojo-hondo: #C31B0D; --tinta: #101114;
    --papel: #FFFFFF; --hueso: #F7F7F8; --gris: #6B6F76; --borde: #E7E8EC;
  }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    font-family: 'Outfit', system-ui, sans-serif; color: var(--tinta);
    background: var(--papel); position: relative;
  }
  .escena { position: absolute; inset: 0; display: flex; flex-direction: column; }
  /* El hueco de abajo lo reserva la barra de subtítulo, que va encima y en
     posición absoluta: sin él, un subtítulo de tres líneas se come el
     titular, y eso solo se ve al mirar la diapositiva ya generada. */
  .cuerpo { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 96px 120px 280px; }

  .kicker {
    font-size: 30px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: var(--rojo-hondo); margin-bottom: 24px;
  }
  .titular { font-size: 92px; font-weight: 700; line-height: 1.06; letter-spacing: -.03em; white-space: pre-line; }
  .titular--grande { font-size: 116px; }

  /* Barra de subtítulo, siempre en el mismo sitio: se lee sin buscarla. */
  .subtitulo {
    position: absolute; left: 50%; transform: translateX(-50%); bottom: 64px;
    max-width: 1560px; padding: 22px 40px; border-radius: 20px;
    background: rgba(16, 17, 20, .90); color: #fff;
    font-size: 40px; font-weight: 400; line-height: 1.34; text-align: center;
    text-wrap: balance;
  }

  /* --- Escena de cifra --- */
  .cifra { font-size: 260px; font-weight: 700; letter-spacing: -.05em; color: var(--rojo); line-height: 1; }
  .cifra-pie { font-size: 38px; color: var(--gris); margin-top: 8px; }

  /* --- Escena de marca --- */
  .escena--marca { background: linear-gradient(135deg, #FF6B4A 0%, #FF3B2E 45%, #C31B0D 100%); color: #fff; }
  .escena--marca .cuerpo { align-items: center; text-align: center; justify-content: center; padding-bottom: 96px; }
  .escena--marca .kicker { color: rgba(255,255,255,.82); }
  .marca { display: flex; align-items: center; gap: 28px; margin-bottom: 28px; }
  .marca__simbolo {
    width: 128px; height: 128px; border-radius: 34px; background: #fff; color: var(--rojo);
    display: grid; place-items: center; font-size: 78px; font-weight: 700;
    box-shadow: 0 24px 60px rgba(0,0,0,.22);
  }
  .marca__texto { font-size: 96px; font-weight: 700; letter-spacing: -.03em; line-height: 1; text-align: left; }
  .marca__texto small { display: block; font-size: 34px; font-weight: 400; letter-spacing: .28em; opacity: .8; }

  /* --- Escena oscura de cierre --- */
  .escena--cierre { background: var(--tinta); color: #fff; }
  .escena--cierre .kicker { color: #FF8F7D; }
  .cta {
    display: inline-flex; align-items: center; gap: 20px; margin-top: 44px;
    background: #25D366; color: #06331A; font-size: 44px; font-weight: 700;
    padding: 24px 44px; border-radius: 999px;
  }

  /* --- Escenas con captura --- */
  .escena--captura .cuerpo { padding: 80px 100px 0; }
  .lamina { display: flex; gap: 72px; align-items: center; height: 100%; }
  .lamina__texto { width: 620px; flex-shrink: 0; }
  .lamina__texto .titular { font-size: 74px; }
  .marco {
    flex: 1; border-radius: 22px; overflow: hidden; background: #fff;
    border: 1px solid var(--borde); box-shadow: 0 40px 90px rgba(16,17,20,.20);
    margin-bottom: 150px;
  }
  .marco__barra {
    height: 46px; background: var(--hueso); border-bottom: 1px solid var(--borde);
    display: flex; align-items: center; gap: 10px; padding: 0 18px;
  }
  .marco__punto { width: 13px; height: 13px; border-radius: 50%; background: #D8DADF; }
  .marco__url {
    margin-left: 14px; background: #fff; border: 1px solid var(--borde); border-radius: 8px;
    font-size: 19px; color: var(--gris); padding: 5px 16px;
  }
  .marco img { display: block; width: 100%; }

  .fondo-blob {
    position: absolute; width: 900px; height: 900px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,59,46,.13), transparent 68%);
    top: -260px; right: -200px; pointer-events: none;
  }
`;

function escenaHtml(e) {
  const sub = `<div class="subtitulo">${e.sub}</div>`;

  if (e.tipo === 'marca') {
    return `<div class="escena escena--marca"><div class="cuerpo">
      <div class="marca">
        <div class="marca__simbolo">M</div>
        <div class="marca__texto">Maya<small>CLASSROOM</small></div>
      </div>
      <div class="kicker">${e.kicker}</div>
    </div>${sub}</div>`;
  }

  if (e.tipo === 'cierre') {
    return `<div class="escena escena--cierre"><div class="cuerpo">
      <div class="kicker">${e.kicker}</div>
      <div class="titular titular--grande">${e.titular}</div>
      <div><span class="cta">WhatsApp · 975 760 418</span></div>
    </div>${sub}</div>`;
  }

  if (e.tipo === 'dato' && e.cifra) {
    return `<div class="escena"><div class="fondo-blob"></div><div class="cuerpo">
      <div class="kicker">${e.kicker}</div>
      <div class="cifra">${e.cifra}</div>
      <div class="cifra-pie">${e.cifraPie}</div>
      <div class="titular" style="margin-top:40px;font-size:72px">${e.titular}</div>
    </div>${sub}</div>`;
  }

  if (e.captura) {
    return `<div class="escena escena--captura"><div class="fondo-blob"></div><div class="cuerpo"><div class="lamina">
      <div class="lamina__texto">
        <div class="kicker">${e.kicker}</div>
        <div class="titular">${e.titular}</div>
      </div>
      <div class="marco">
        <div class="marco__barra">
          <span class="marco__punto"></span><span class="marco__punto"></span><span class="marco__punto"></span>
          <span class="marco__url">tuacademia.pe</span>
        </div>
        <img src="${BASE_URL}capturas/${e.captura}" />
      </div>
    </div></div>${sub}</div>`;
  }

  return `<div class="escena"><div class="fondo-blob"></div><div class="cuerpo">
    <div class="kicker">${e.kicker}</div>
    <div class="titular titular--grande">${e.titular}</div>
  </div>${sub}</div>`;
}

const browser = await navegador();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });

// Cada diapositiva se escribe a disco y se abre con `file://`: con
// `setContent` el documento queda en `about:blank`, y desde ahí el navegador
// no carga las capturas, que también son `file://`.
for (const e of guion.escenas) {
  const html = `${BASE}/diapositivas/${e.id}.html`;
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>${ESTILO}</style>${escenaHtml(e)}`);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${salida}/${e.id}.png` });
  console.log(`  ${e.id} · ${e.titular?.replace(/\n/g, ' ') ?? e.tipo}`);
}

await browser.close();
