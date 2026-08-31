#!/usr/bin/env node
/**
 * Captura una o varias anchuras de una página y avisa de los errores de
 * consola. Sirve tanto para el servidor de desarrollo (`http://…`) como para
 * un banco de pruebas estático (`file://…`).
 *
 *   node capturar.mjs <url> <directorio-salida> [movil,tableta,escritorio]
 *
 * Requiere Playwright. En este contenedor Chromium ya está instalado en
 * PLAYWRIGHT_BROWSERS_PATH; no ejecutar `playwright install`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ANCHURAS = {
  movil: { width: 390, height: 844 },
  tableta: { width: 820, height: 1180 },
  escritorio: { width: 1440, height: 900 },
};

const [url, salida = 'capturas', lista = 'movil,escritorio'] = process.argv.slice(2);

if (!url) {
  console.error('Uso: node capturar.mjs <url> [directorio-salida] [movil,tableta,escritorio]');
  process.exit(1);
}

/**
 * Playwright no es dependencia del proyecto —es utillaje de revisión, no de
 * producción—, así que se resuelve donde esté y, si no está en ninguna parte,
 * se instala una vez en una caché fuera del repositorio.
 */
async function cargarPlaywright() {
  try {
    return await import('playwright');
  } catch {
    /* Se busca a continuación. */
  }

  const cache = path.join(os.tmpdir(), 'maya-utillaje-ui');
  const candidatos = [process.cwd(), cache];

  for (const base of candidatos) {
    try {
      const require = createRequire(path.join(base, 'index.js'));
      return await import(pathToFileURL(require.resolve('playwright')).href);
    } catch {
      /* Siguiente candidato. */
    }
  }

  console.error('Playwright no está disponible; instalándolo en', cache);
  await mkdir(cache, { recursive: true });
  if (!existsSync(path.join(cache, 'package.json'))) {
    execFileSync('npm', ['init', '-y'], { cwd: cache, stdio: 'ignore' });
  }
  // Los navegadores ya vienen en la imagen (PLAYWRIGHT_BROWSERS_PATH), así que
  // se instala solo el paquete: nunca ejecutar `playwright install`.
  execFileSync('npm', ['install', 'playwright'], {
    cwd: cache,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
  });

  const require = createRequire(path.join(cache, 'index.js'));
  return import(pathToFileURL(require.resolve('playwright')).href);
}

// Playwright es CommonJS: importado por URL de fichero llega envuelto en
// `default`, mientras que resuelto por nombre expone los nombres directamente.
const playwright = await cargarPlaywright();
const chromium = playwright.chromium ?? playwright.default?.chromium;

if (!chromium) {
  console.error('No se pudo cargar Chromium desde Playwright.');
  process.exit(1);
}
await mkdir(salida, { recursive: true });

const browser = await chromium.launch();
let fallos = 0;

for (const nombre of lista.split(',').map((s) => s.trim()).filter(Boolean)) {
  const viewport = ANCHURAS[nombre];
  if (!viewport) {
    console.error(`Anchura desconocida: ${nombre}. Válidas: ${Object.keys(ANCHURAS).join(', ')}`);
    fallos++;
    continue;
  }

  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  const errores = [];
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (e) {
    errores.push(`goto: ${e.message}`);
  }

  // El ratón virtual arranca en (0,0) y dispara :hover sobre lo que haya en
  // esa esquina, que en el cajón lateral es la cabecera de cuenta. Apartarlo
  // evita capturar un estado que el usuario no vería.
  await page.mouse.move(-50, -50);
  await page.waitForTimeout(600);

  const fichero = path.join(salida, `${nombre}.png`);
  await page.screenshot({ path: fichero, fullPage: false });
  console.log(`${nombre} (${viewport.width}×${viewport.height}) → ${fichero}`);

  if (errores.length) {
    console.log(`  errores de consola:\n${errores.slice(0, 8).map((e) => `    ${e}`).join('\n')}`);
  }
  await page.close();
}

await browser.close();
process.exit(fallos ? 1 : 0);
