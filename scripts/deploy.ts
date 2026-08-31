#!/usr/bin/env bun
/**
 * Utilidad de despliegue de Maya Classroom.
 *
 *   bun run deploy --list      Inventario de Coolify (proyectos, servidores, apps)
 *   bun run deploy --dns       Crea o actualiza los CNAME del túnel en Cloudflare
 *   bun run deploy --check     Verifica que la configuración apunta a donde debe
 *   bun run deploy             Dispara el despliegue de las dos aplicaciones
 *   bun run deploy --api       Solo la API
 *   bun run deploy --web       Solo el cliente
 *
 * Las credenciales salen del entorno; en local se leen de `.env.deploy`, que
 * está en .gitignore. En CI llegan como secretos del repositorio.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

/* --------------------------------- Entorno -------------------------------- */

function cargarEnv(): void {
  for (const fichero of ['.env.deploy', '.env']) {
    const ruta = join(RAIZ, fichero);
    if (!existsSync(ruta)) continue;
    // El \r se retira explícitamente: en Windows el fichero acaba con CRLF con
    // facilidad y arrastrarlo dentro del valor corrompe tokens y URLs.
    for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      // El entorno real manda: en CI los secretos ya vienen definidos.
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
  }
}

function exigir(clave: string): string {
  const valor = process.env[clave];
  if (!valor) {
    throw new Error(
      `Falta la variable ${clave}. Defínala en .env.deploy o como secreto del repositorio.`,
    );
  }
  return valor;
}

/* ------------------------------- Utilidades ------------------------------- */

const COLOR = { ok: '\x1b[32m', mal: '\x1b[31m', aviso: '\x1b[33m', tenue: '\x1b[90m', fin: '\x1b[0m' };
const ok = (t: string) => console.log(`${COLOR.ok}OK${COLOR.fin}   ${t}`);
const mal = (t: string) => console.log(`${COLOR.mal}FALLO${COLOR.fin} ${t}`);
const aviso = (t: string) => console.log(`${COLOR.aviso}AVISO${COLOR.fin} ${t}`);
const info = (t: string) => console.log(`${COLOR.tenue}     ${t}${COLOR.fin}`);

async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  const r = await fetch(url, opciones);
  const texto = await r.text();
  if (!r.ok) {
    throw new Error(`${opciones.method ?? 'GET'} ${url} -> ${r.status}: ${texto.slice(0, 300)}`);
  }
  return texto ? (JSON.parse(texto) as T) : (undefined as T);
}

/* --------------------------------- Coolify -------------------------------- */

interface AppCoolify {
  uuid: string;
  name: string;
  fqdn: string | null;
  status: string;
  git_repository: string;
  git_branch: string;
}

function coolify() {
  const base = exigir('COOLIFY_URL').replace(/\/$/, '');
  const cabeceras = {
    Authorization: `Bearer ${exigir('COOLIFY_TOKEN')}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  return {
    base,
    get: <T>(ruta: string) => pedir<T>(`${base}${ruta}`, { headers: cabeceras }),
    post: <T>(ruta: string, cuerpo?: unknown) =>
      pedir<T>(`${base}${ruta}`, {
        method: 'POST',
        headers: cabeceras,
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      }),
  };
}

async function listar(): Promise<void> {
  const c = coolify();
  const [proyectos, servidores, apps] = await Promise.all([
    c.get<{ uuid: string; name: string }[]>('/api/v1/projects'),
    c.get<{ uuid: string; name: string }[]>('/api/v1/servers'),
    c.get<AppCoolify[]>('/api/v1/applications'),
  ]);

  console.log('\nPROYECTOS');
  for (const p of proyectos) console.log(`  ${p.uuid}  ${p.name}`);
  console.log('\nSERVIDORES');
  for (const s of servidores) console.log(`  ${s.uuid}  ${s.name}`);
  console.log('\nAPLICACIONES');
  for (const a of [...apps].sort((x, y) => x.name.localeCompare(y.name))) {
    console.log(`  ${a.uuid}  ${a.name.padEnd(24)} ${a.fqdn ?? '(sin dominio)'}`);
  }
  console.log('\nCopie los UUID que correspondan a .env.deploy.\n');
}

/* -------------------------------- Cloudflare ------------------------------ */

interface RegistroDns {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
}

/**
 * Publica cada dominio como CNAME al túnel. Esta infraestructura no expone una
 * IP pública: Cloudflare entrega el tráfico por el túnel y el proxy de Coolify
 * enruta por nombre de host, así que el registro debe ir con proxy activado.
 */
async function sincronizarDns(): Promise<void> {
  const token = exigir('CLOUDFLARE_API_TOKEN');
  const tunel = exigir('CLOUDFLARE_TUNNEL_ID');
  const dominios = [exigir('FRONTEND_DOMAIN'), exigir('BACKEND_DOMAIN')];
  const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = 'https://api.cloudflare.com/client/v4';

  // La zona es el dominio registrable, no el subdominio donde se publica.
  const zonaNombre = process.env.CLOUDFLARE_ZONE_NAME ?? dominios[0].split('.').slice(-2).join('.');
  const zonas = await pedir<{ result: { id: string; name: string }[] }>(
    `${api}/zones?name=${encodeURIComponent(zonaNombre)}`,
    { headers: cabeceras },
  );
  const zona = zonas.result[0];
  if (!zona) {
    throw new Error(
      `La zona «${zonaNombre}» no es accesible con este token. Recuerde que CLOUDFLARE_ZONE_NAME ` +
        'es el dominio registrable (ignia.site), no el subdominio donde se publica.',
    );
  }
  info(`zona ${zona.name} (${zona.id})`);

  const destino = `${tunel}.cfargotunnel.com`;

  for (const dominio of dominios) {
    // El Universal SSL gratuito de Cloudflare solo emite «zona» y «*.zona»:
    // un subdominio de dos niveles resuelve por DNS pero falla el handshake
    // TLS, y el síntoma (conexión cerrada sin certificado) no apunta a la
    // causa. Se avisa aquí, que es donde se elige el nombre.
    const niveles = dominio.slice(0, -(zona.name.length + 1)).split('.').length;
    if (niveles > 1) {
      aviso(
        `${dominio} está dos niveles por debajo de ${zona.name}. El certificado ` +
          'gratuito no lo cubre; necesitará Advanced Certificate Manager o un ' +
          'subdominio de un solo nivel.',
      );
    }

    const actuales = await pedir<{ result: RegistroDns[] }>(
      `${api}/zones/${zona.id}/dns_records?name=${encodeURIComponent(dominio)}`,
      { headers: cabeceras },
    );
    const existente = actuales.result[0];
    const cuerpo = { type: 'CNAME', name: dominio, content: destino, proxied: true, ttl: 1 };

    if (!existente) {
      await pedir(`${api}/zones/${zona.id}/dns_records`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
      });
      ok(`creado   CNAME ${dominio} -> ${destino}`);
    } else if (
      existente.content !== destino ||
      !existente.proxied ||
      existente.type !== 'CNAME'
    ) {
      await pedir(`${api}/zones/${zona.id}/dns_records/${existente.id}`, {
        method: 'PUT',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
      });
      ok(`ajustado CNAME ${dominio} -> ${destino}`);
    } else {
      info(`sin cambios ${dominio} -> ${destino}`);
    }
  }
}

/* -------------------------------- Verificación ---------------------------- */

/**
 * Comprueba que los UUID configurados existen y apuntan a este repositorio.
 *
 * Existe por una razón concreta: `.env.deploy` se copia entre proyectos con
 * facilidad, y un UUID heredado despliega este código encima de la aplicación
 * de otro proyecto, que puede estar en producción.
 */
async function comprobar(): Promise<number> {
  const c = coolify();
  const repo = `${exigir('GITHUB_OWNER')}/${exigir('GITHUB_REPO')}`;
  const apps = await c.get<AppCoolify[]>('/api/v1/applications');
  let fallos = 0;

  const objetivos = [
    ['API', 'COOLIFY_API_UUID', process.env.BACKEND_DOMAIN],
    ['WEB', 'COOLIFY_WEB_UUID', process.env.FRONTEND_DOMAIN],
  ] as const;

  for (const [etiqueta, clave, dominio] of objetivos) {
    const uuid = process.env[clave];
    if (!uuid) {
      mal(`${etiqueta}: falta ${clave}`);
      fallos++;
      continue;
    }

    const app = apps.find((a) => a.uuid === uuid);
    if (!app) {
      mal(`${etiqueta}: el UUID ${uuid} no existe en Coolify`);
      fallos++;
      continue;
    }

    if (!app.git_repository.includes(repo)) {
      mal(
        `${etiqueta}: «${app.name}» apunta a ${app.git_repository}, no a ${repo}. ` +
          'Despliegue abortado para no pisar otra aplicación.',
      );
      fallos++;
      continue;
    }

    if (dominio && app.fqdn && !app.fqdn.includes(dominio)) {
      aviso(`${etiqueta}: el dominio en Coolify (${app.fqdn}) no coincide con ${dominio}`);
    }
    ok(`${etiqueta}: «${app.name}» <- ${app.git_repository}#${app.git_branch} · ${app.fqdn ?? 'sin dominio'}`);
  }
  return fallos;
}

/* -------------------------------- Despliegue ------------------------------ */

async function desplegar(objetivos: ('api' | 'web')[]): Promise<void> {
  // Nunca se dispara un despliegue sin validar antes a quién apunta el UUID.
  if ((await comprobar()) > 0) {
    throw new Error('La configuración de despliegue no es coherente; no se ha disparado nada.');
  }

  const c = coolify();
  for (const objetivo of objetivos) {
    const uuid = exigir(objetivo === 'api' ? 'COOLIFY_API_UUID' : 'COOLIFY_WEB_UUID');
    // Coolify 4.3 exige POST aquí; con GET responde 405 «This endpoint has
    // changed to a POST request».
    const r = await c.post<{ deployments?: { deployment_uuid: string }[] }>(
      `/api/v1/deploy?uuid=${uuid}&force=false`,
    );
    const id = r.deployments?.[0]?.deployment_uuid ?? '(sin identificador)';
    ok(`despliegue de ${objetivo.toUpperCase()} encolado · ${id}`);
  }
}

/* ----------------------------------- Main --------------------------------- */

const args = process.argv.slice(2);
cargarEnv();

try {
  if (args.includes('--list')) {
    await listar();
  } else if (args.includes('--dns')) {
    await sincronizarDns();
  } else if (args.includes('--check')) {
    process.exit((await comprobar()) > 0 ? 1 : 0);
  } else {
    const soloApi = args.includes('--api');
    const soloWeb = args.includes('--web');
    const objetivos: ('api' | 'web')[] =
      soloApi && !soloWeb ? ['api'] : soloWeb && !soloApi ? ['web'] : ['api', 'web'];
    await desplegar(objetivos);
  }
} catch (error) {
  mal(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
