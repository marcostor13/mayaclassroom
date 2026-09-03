/* Capturas de la plataforma en alta resolución para el vídeo de la landing.
   Se usan las pantallas reales con la API simulada: lo que se enseña en el
   vídeo tiene que ser la plataforma, no una maqueta. */
import fs from 'node:fs';
import http from 'node:http';
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
const datos = JSON.parse(fs.readFileSync(`${BASE}/datos-demo.json`, 'utf8'));
const salida = `${BASE}/capturas`;
fs.mkdirSync(salida, { recursive: true });

const tenant = { id: 't1', slug: 'demo', name: 'Dulce Lima', logoUrl: '/demo/dulce-lima.svg', primaryColor: '#E11D64', accentColor: '#F2A93B' };
const site = {
  id: 's1', published: true, template: datos.pagina.template, sections: datos.pagina.sections,
  seo: { title: 'Dulce Lima · Escuela de pastelería', description: '', keywords: [], imageUrl: null },
  contact: { email: 'hola@dulcelima.pe', phone: '+51 987 654 321', address: 'Jr. Domeyer 220, Barranco, Lima', website: 'https://dulcelima.pe' },
  updatedAt: new Date().toISOString(),
};
const publico = { tenant, site, courses: datos.cursos, categories: datos.categorias };

const cursosAdmin = datos.cursos.map((c, i) => ({
  id: c.id, fullName: c.title, shortName: c.slug.toUpperCase(), summary: c.summary,
  imageUrl: c.imageUrl, categoryId: c.categoryId, categoryName: c.categoryName,
  enrolledCount: c.enrolledCount, visible: true, format: 'topics', startDate: null, endDate: null,
  catalog: c.catalog, progress: [72, 40, 100, 100][i] ?? 0, favourite: false, hidden: false, visibility: 'visible',
}));
const pedidos = [
  { id: 'o1', reference: 'MC-7K3F9A', courseTitle: datos.cursos[0].title, buyerName: 'Ana Quispe', buyerEmail: 'ana.quispe@dulcelima.pe', amountCents: 14900, currency: 'PEN', provider: 'mercadopago', status: 'paid', enrolled: true, createdAt: new Date(Date.now() - 12 * 864e5).toISOString(), paidAt: new Date(Date.now() - 12 * 864e5).toISOString() },
  { id: 'o2', reference: 'MC-2QX48B', courseTitle: datos.cursos[1].title, buyerName: 'Carlos Mendoza', buyerEmail: 'carlos.mendoza@dulcelima.pe', amountCents: 24900, currency: 'PEN', provider: 'paypal', status: 'paid', enrolled: true, createdAt: new Date(Date.now() - 6 * 864e5).toISOString(), paidAt: new Date(Date.now() - 6 * 864e5).toISOString() },
  { id: 'o3', reference: 'MC-5TN20C', courseTitle: datos.cursos[0].title, buyerName: 'Rocío Ttito', buyerEmail: 'rocio.ttito@ejemplo.pe', amountCents: 14900, currency: 'PEN', provider: 'manual', status: 'pending', enrolled: false, createdAt: new Date(Date.now() - 864e5).toISOString(), paidAt: null },
  { id: 'o4', reference: 'MC-4HB61F', courseTitle: datos.cursos[2].title, buyerName: 'Diego Palomino', buyerEmail: 'diego.palomino@dulcelima.pe', amountCents: 18900, currency: 'PEN', provider: 'simulated', status: 'paid', enrolled: true, createdAt: new Date(Date.now() - 2 * 864e5).toISOString(), paidAt: new Date(Date.now() - 2 * 864e5).toISOString() },
];
const panel = {
  user: { id: 'u1', fullName: 'Ana Quispe', avatarUrl: null },
  stats: { courses: 3, completedCourses: 1, averageProgress: 71, pendingDeadlines: 1, unreadNotifications: 2, unreadMessages: 1 },
  courses: cursosAdmin.slice(0, 3),
  upcomingEvents: [
    { id: 'e1', name: 'Clase en vivo · Merengue italiano sin fallos', startAt: new Date(Date.now() + 6 * 864e5).toISOString(), endAt: new Date(Date.now() + 6 * 864e5 + 54e5).toISOString(), eventType: 'course', courseId: cursosAdmin[0].id, courseName: datos.cursos[0].title, location: 'Aula virtual' },
    { id: 'e2', name: 'Entrega · Primera tanda de alfajores', startAt: new Date(Date.now() + 12 * 864e5).toISOString(), endAt: new Date(Date.now() + 12 * 864e5 + 36e5).toISOString(), eventType: 'course', courseId: cursosAdmin[0].id, courseName: datos.cursos[0].title, location: 'Aula virtual' },
  ],
  deadlines: [{ id: 'd1', name: 'Práctica 1 · Su primera tanda de alfajores', courseId: cursosAdmin[0].id, courseName: datos.cursos[0].title, dueDate: new Date(Date.now() + 12 * 864e5).toISOString(), submitted: false }],
};
/**
 * Los eventos del calendario del alumno.
 *
 * Se reparten por el mes en curso —y no en fechas fijas— para que la rejilla
 * salga poblada cualquier día que se rehaga el vídeo. Mezclan clase en vivo y
 * entrega a propósito: es exactamente lo que la landing promete que el alumno
 * ve en un solo sitio.
 */
const eventos = (() => {
  const hoy = new Date();
  const dia = (n, hora) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), n, hora, 0, 0);
    return d.toISOString();
  };
  const fin = (n, hora, minutos) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), n, hora, minutos, 0);
    return d.toISOString();
  };
  const curso = (i) => ({ courseId: cursosAdmin[i].id, courseName: datos.cursos[i].title });

  return [
    { id: 'c1', name: 'Clase en vivo · Merengue italiano sin fallos', eventType: 'course', ...curso(0), startAt: dia(4, 19), endAt: fin(4, 20, 30), allDay: false, location: 'Aula virtual', actionable: true },
    { id: 'c2', name: 'Entrega · Su primera tanda de alfajores', eventType: 'course', ...curso(0), startAt: dia(8, 23), endAt: fin(8, 23, 59), allDay: false, location: null, actionable: true },
    { id: 'c3', name: 'Clase en vivo · El punto del manjarblanco', eventType: 'course', ...curso(0), startAt: dia(11, 19), endAt: fin(11, 20, 30), allDay: false, location: 'Aula virtual', actionable: true },
    { id: 'c4', name: 'Cuestionario · Temperaturas y puntos de cocción', eventType: 'course', ...curso(1), startAt: dia(15, 20), endAt: fin(15, 21, 0), allDay: false, location: null, actionable: true },
    { id: 'c5', name: 'Clase en vivo · Masa que no se rompe', eventType: 'course', ...curso(1), startAt: dia(18, 19), endAt: fin(18, 20, 30), allDay: false, location: 'Aula virtual', actionable: true },
    { id: 'c6', name: 'Entrega · Hoja de costos por porción', eventType: 'course', ...curso(1), startAt: dia(22, 23), endAt: fin(22, 23, 59), allDay: false, location: null, actionable: true },
    { id: 'c7', name: 'Clase en vivo · Suspiro limeño paso a paso', eventType: 'course', ...curso(2), startAt: dia(25, 19), endAt: fin(25, 20, 30), allDay: false, location: 'Aula virtual', actionable: true },
    { id: 'c8', name: 'Cierre del módulo · Pastelería peruana clásica', eventType: 'course', ...curso(0), startAt: dia(28, 18), endAt: fin(28, 19, 0), allDay: false, location: 'Aula virtual', actionable: true },
  ];
})();

/**
 * Las clases en vivo del alumno: las que vienen, las que ya pasaron y sus
 * grabaciones.
 *
 * La sala en sí no se captura: pide cámara, micrófono y una conexión WebRTC
 * de verdad, y en un navegador headless saldría una rejilla de cuadros negros.
 * El listado enseña lo mismo que hay que contar —que la clase vive dentro de
 * la plataforma y que la grabación se queda ahí— y sale siempre igual.
 */
const enVivo = (() => {
  const hoy = new Date();
  const cuando = (dias, hora, minutos = 0) =>
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias, hora, minutos, 0).toISOString();
  const ajustes = {
    lobby: false, muteOnJoin: true, allowChat: true, allowWhiteboard: true,
    allowAttendeeScreenShare: false, allowAttendeeCamera: true, autoRecord: true,
    recordingVisibleToStudents: true, joinBeforeHostMinutes: 15, maxParticipants: 25,
  };
  const elena = { id: 'u9', fullName: 'Elena Chávez', avatarUrl: null };
  const base = (i, titulo, curso, cuandoIso, estado, extra = {}) => ({
    id: `ls${i}`, title: titulo, description: null,
    roomCode: `DL-${String(1000 + i * 7)}`, joinUrl: `https://tuacademia.pe/live/DL-${String(1000 + i * 7)}`,
    status: estado, mode: 'class', courseId: cursosAdmin[0].id, courseName: curso,
    groupId: null, host: elena, coHosts: [], calendarEventId: null,
    scheduledStart: cuandoIso, scheduledEnd: null, startedAt: null, endedAt: null,
    settings: ajustes, openToTenant: false, liveParticipants: 0, recordingCount: 0,
    canManage: false, canRecord: false, createdAt: cuandoIso, ...extra,
  });

  return {
    proximas: [
      base(1, 'Merengue italiano sin fallos', datos.cursos[0].title, cuando(0, 19), 'live', { liveParticipants: 14, startedAt: cuando(0, 19) }),
      base(2, 'El punto del manjarblanco', datos.cursos[0].title, cuando(2, 19), 'scheduled'),
      base(3, 'Masa que no se rompe', datos.cursos[1].title, cuando(6, 19), 'scheduled'),
      base(4, 'Suspiro limeño paso a paso', datos.cursos[2].title, cuando(9, 19), 'scheduled'),
    ],
    pasadas: [
      base(5, 'Alfajores: masa y armado', datos.cursos[0].title, cuando(-7, 19), 'ended', { endedAt: cuando(-7, 20, 30), recordingCount: 1 }),
      base(6, 'Temperado del chocolate', datos.cursos[1].title, cuando(-14, 19), 'ended', { endedAt: cuando(-14, 20, 30), recordingCount: 1 }),
    ],
    grabaciones: [
      { id: 'r1', sessionId: 'ls5', sessionTitle: 'Alfajores: masa y armado', title: 'Alfajores: masa y armado', status: 'ready', startedAt: cuando(-7, 19), durationSeconds: 5280, size: 486_000_000, mimeType: 'video/webm', url: '/x', recordedBy: elena, visibleToStudents: true, canManage: false, createdAt: cuando(-7, 19) },
      { id: 'r2', sessionId: 'ls6', sessionTitle: 'Temperado del chocolate', title: 'Temperado del chocolate', status: 'ready', startedAt: cuando(-14, 19), durationSeconds: 4620, size: 412_000_000, mimeType: 'video/webm', url: '/x', recordedBy: elena, visibleToStudents: true, canManage: false, createdAt: cuando(-14, 19) },
    ],
  };
})();

const usuario = (rol) => ({
  id: 'u1', tenantId: 't1', tenantSlug: 'demo',
  email: rol === 'manager' ? 'gestora@dulcelima.pe' : 'ana.quispe@dulcelima.pe',
  username: rol === 'manager' ? 'rosa.quispe' : 'ana.quispe',
  firstName: rol === 'manager' ? 'Rosa' : 'Ana', lastName: 'Quispe',
  fullName: rol === 'manager' ? 'Rosa Quispe' : 'Ana Quispe', avatarUrl: null,
  status: 'active', provider: 'local', language: 'es', timezone: 'America/Lima',
  isPlatformAdmin: false, twoFactorEnabled: false, mustChangePassword: false,
  roles: [{ roleId: 'r1', roleShortName: rol, contextLevel: 'tenant', instanceId: null }],
  capabilities: rol === 'manager'
    ? ['maya/site:manage', 'maya/site:manage-requests', 'maya/payment:manage', 'maya/order:manage', 'maya/course:update', 'maya/course:view', 'maya/user:view']
    : ['maya/course:view'],
});

/**
 * El propio guion sirve el cliente construido.
 *
 * Antes había que acordarse de levantar un servidor en el 4310 por separado, y
 * la orden no estaba en ninguna parte: quien lo intentaba veía diez capturas
 * en blanco sin saber por qué. Con `Range` incluido, porque el navegador pide
 * los vídeos por trozos.
 */
const RAIZ = path.resolve(BASE, '../../apps/web/dist/web/browser');
if (!fs.existsSync(path.join(RAIZ, 'index.html'))) {
  console.error(`No encuentro el cliente construido en ${RAIZ}.\nEjecute antes: bun run build:web`);
  process.exit(1);
}

const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(RAIZ, url);
  // Cualquier ruta desconocida es una ruta del cliente: es una sola página.
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(RAIZ, 'index.html');
  const tipo = TIPOS[path.extname(f)] ?? 'application/octet-stream';
  const total = fs.statSync(f).size;
  const rango = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (rango) {
    const inicio = rango[1] ? Number(rango[1]) : 0;
    const fin = rango[2] ? Number(rango[2]) : total - 1;
    res.writeHead(206, {
      'content-type': tipo,
      'content-range': `bytes ${inicio}-${fin}/${total}`,
      'accept-ranges': 'bytes',
      'content-length': fin - inicio + 1,
    });
    fs.createReadStream(f, { start: inicio, end: fin }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': tipo, 'content-length': total, 'accept-ranges': 'bytes' });
  fs.createReadStream(f).pipe(res);
});

await new Promise((listo) => servidor.listen(4310, '127.0.0.1', listo));
console.log('cliente servido en http://127.0.0.1:4310');

const browser = await navegador();

async function pagina(rol) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://images.pexels.com/**', (r) => {
    const u = new URL(r.request().url());
    const w = Number(u.searchParams.get('w') ?? 800), h = Number(u.searchParams.get('h') ?? 600);
    // Degradado apetitoso en lugar de la foto: la red no llega a Pexels y una
    // caja gris en el vídeo de venta sería peor que un fondo cuidado.
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7C9A8"/><stop offset="0.5" stop-color="#EFA07A"/><stop offset="1" stop-color="#D9736B"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>` });
  });
  await page.route('**/api/v1/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const j = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: x }) });
    if (p === '/site/public/demo') return j(publico);
    if (/^\/site\/public\/demo\/courses\//.test(p)) {
      const ref = p.split('/').pop();
      const curso = publico.courses.find((c) => c.slug === ref) ?? publico.courses[0];
      return j({ tenant, site: { template: site.template, contact: site.contact, seo: site.seo }, course: curso, landing: curso.catalog.landing ?? datos.landingPorDefecto, curriculum: datos.temario, related: publico.courses.filter((c) => c.id !== curso.id) });
    }
    if (p === '/auth/me') return j(usuario(rol));
    if (p === '/site') return j(site);
    if (p === '/courses' || p === '/courses/my') return j({ items: cursosAdmin, total: cursosAdmin.length, page: 1, limit: 100 });
    if (p === '/dashboard') return j(panel);
    if (p === '/orders') return j(pedidos);
    if (p === '/payments/settings') return j({ currency: 'PEN', mercadoPago: { enabled: true, publicKey: 'APP_USR-…', hasAccessToken: true, sandbox: false }, paypal: { enabled: true, clientId: 'AY…', hasSecret: true, sandbox: false }, manual: { enabled: true, instructions: 'Transferencia o depósito al BCP, cuenta corriente soles 194-1234567-0-89. También Yape al 987 654 321.' }, simulated: { enabled: false } });
    if (p === '/calendar/events' || p === '/calendar/upcoming') return j(eventos);
    if (p === '/live/sessions') {
      const q = new URL(route.request().url()).searchParams;
      return j(q.get('status') === 'ended' ? enVivo.pasadas : enVivo.proximas);
    }
    if (p === '/live/recordings') return j(enVivo.grabaciones);
    if (p === '/guides') return j({ guides: [], progress: [] });
    if (p === '/messages/unread-count') return j({ count: 1 });
    if (p.startsWith('/tenants/public')) return j({ id: 't1', slug: 'demo', name: 'Dulce Lima', branding: { primaryColor: '#E11D64', accentColor: '#F2A93B', logoUrl: '/demo/dulce-lima.svg' }, allowSelfRegistration: true, allowGuestAccess: false, defaultLanguage: 'es' });
    return j([]);
  });
  if (rol) await page.addInitScript(() => { localStorage.setItem('maya.access', 'x'); localStorage.setItem('maya.refresh', 'x'); localStorage.setItem('maya.tenant', 'demo'); });
  return page;
}

const cerrarGuia = async (p) => { await p.locator('button:has-text("Ahora no")').first().click({ timeout: 1200 }).catch(() => {}); };

// ── Público
{
  const p = await pagina(null);
  await p.goto('http://127.0.0.1:4310/p/demo', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.sitio'); await cerrarGuia(p); await p.waitForTimeout(700);
  await p.screenshot({ path: `${salida}/01-escaparate.png` });
  await p.evaluate(() => document.querySelector('#cursos')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${salida}/02-catalogo.png` });
  await p.goto('http://127.0.0.1:4310/p/demo/c/past-101', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.sitio'); await cerrarGuia(p); await p.waitForTimeout(700);
  await p.screenshot({ path: `${salida}/03-ficha-curso.png` });
  await p.evaluate(() => document.querySelector('.compra')?.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${salida}/04-compra.png` });
  await p.close();
}

// ── Gestión
{
  const p = await pagina('manager');
  await p.goto('http://127.0.0.1:4310/admin/storefront', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.constructor', { timeout: 12000 }); await p.waitForTimeout(1200);
  await p.locator('.sitio section').nth(2).click({ position: { x: 40, y: 20 } }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${salida}/05-constructor.png` });
  await p.locator('[role="tab"]:has-text("Pedidos")').first().click().catch(() => {});
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${salida}/06-pedidos.png` });
  await p.goto('http://127.0.0.1:4310/admin/payments', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${salida}/07-cobros.png` });
  await p.close();
}

// ── Alumnado
//
// Son las capturas que sostienen el argumento del aula, no el de la venta: lo
// que ve quien estudia. Van juntas y con el mismo usuario para que en el vídeo
// se lean como un recorrido y no como pantallas sueltas.
{
  const p = await pagina('student');
  await p.goto('http://127.0.0.1:4310/dashboard', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${salida}/08-panel-alumno.png` });

  await p.goto('http://127.0.0.1:4310/courses', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1600);
  await cerrarGuia(p);
  await p.screenshot({ path: `${salida}/10-mis-cursos.png` });

  await p.goto('http://127.0.0.1:4310/calendar', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await cerrarGuia(p);
  await p.screenshot({ path: `${salida}/11-calendario.png` });

  await p.goto('http://127.0.0.1:4310/live', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await cerrarGuia(p);
  await p.screenshot({ path: `${salida}/12-clases-en-vivo.png` });
  await p.close();
}

// ── Móvil, para enseñar que responde
{
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.route('https://images.pexels.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7C9A8"/><stop offset="1" stop-color="#D9736B"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>' }));
  await p.route('**/api/v1/**', (route) => {
    const q = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const j = (x) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: x }) });
    if (q === '/site/public/demo') return j(publico);
    return j([]);
  });
  await p.goto('http://127.0.0.1:4310/p/demo', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.sitio'); await cerrarGuia(p); await p.waitForTimeout(700);
  await p.screenshot({ path: `${salida}/09-movil.png` });
  await p.close();
}

console.log('capturas:', fs.readdirSync(salida).join(' '));
await browser.close();
servidor.close();
