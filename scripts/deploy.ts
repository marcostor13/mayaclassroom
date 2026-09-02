#!/usr/bin/env bun
/**
 * Utilidad de despliegue de Maya Classroom.
 *
 *   bun run deploy --list      Inventario de Coolify (proyectos, servidores, apps)
 *   bun run deploy --dns       Crea o actualiza los CNAME del túnel en Cloudflare
 *   bun run deploy --tunel     Publica los dominios como reglas del túnel
 *   bun run deploy --coolify   Vuelca los dominios y sus variables en Coolify
 *   bun run deploy --check     Verifica que la configuración apunta a donde debe
 *   bun run deploy --esperar   Espera a que el despliegue termine y los dominios respondan
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

function leerEnv(fichero: string): Map<string, string> {
  const pares = new Map<string, string>();
  const ruta = join(RAIZ, fichero);
  if (!existsSync(ruta)) return pares;
  // El \r se retira explícitamente: en Windows el fichero acaba con CRLF con
  // facilidad y arrastrarlo dentro del valor corrompe tokens y URLs.
  for (const linea of readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) pares.set(m[1], m[2].trim());
  }
  return pares;
}

/**
 * Deja en el entorno la configuración de despliegue.
 *
 * En CI no hay `.env.deploy` (está en .gitignore) y manda el entorno: los
 * secretos llegan del repositorio. En local manda `.env.deploy`, y aquí está la
 * trampa que costó un despliegue: **Bun carga `.env` automáticamente** en el
 * entorno del proceso antes de que este guion arranque, y `.env` es el fichero
 * de DESARROLLO, con `API_URL`, `WEB_URL` y `CORS_ORIGINS` apuntando a
 * localhost. Rellenando solo lo ausente, esos valores ya estaban definidos,
 * `.env.deploy` no llegaba a aplicarse y el guion publicaba en producción las
 * URL de la máquina local sin avisar de nada.
 */
function cargarEnv(): void {
  const despliegue = leerEnv('.env.deploy');
  if (despliegue.size === 0) return;

  // Se descarta lo que Bun inyectó desde `.env`: solo las claves que
  // `.env.deploy` no define y cuyo valor coincide literalmente con el de
  // desarrollo, para no tocar nada que venga del entorno de verdad.
  for (const [clave, valor] of leerEnv('.env')) {
    if (!despliegue.has(clave) && process.env[clave] === valor) delete process.env[clave];
  }
  for (const [clave, valor] of despliegue) process.env[clave] = valor;
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

/**
 * Comprueba de una vez todas las variables que necesita una acción.
 *
 * Existe porque en CI una variable no configurada no llega ausente sino como
 * cadena vacía: `${{ vars.LO_QUE_SEA }}` sin valor define la variable a "". Con
 * `exigir` de una en una el guion aborta en la primera y hay que repetir el
 * despliegue por cada secreto que falte. Aquí se listan todas juntas, con la
 * longitud de las presentes para detectar un pegado a medias sin revelar el
 * valor.
 */
function exigirTodas(claves: readonly string[]): void {
  const faltan = claves.filter((clave) => !process.env[clave]);
  if (faltan.length === 0) return;

  mal(`faltan ${faltan.length} de ${claves.length} variables de configuración`);
  for (const clave of claves) {
    const valor = process.env[clave];
    console.log(
      valor
        ? `  ${COLOR.ok}OK${COLOR.fin}    ${clave} (${valor.length} caracteres)`
        : `  ${COLOR.mal}FALTA${COLOR.fin} ${clave}`,
    );
  }
  throw new Error(
    'Defina las que faltan en .env.deploy (local) o en Settings > Secrets and ' +
      'variables > Actions del repositorio (CI).',
  );
}

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
  ports_mappings: string | null;
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
    patch: <T>(ruta: string, cuerpo: unknown) =>
      pedir<T>(`${base}${ruta}`, {
        method: 'PATCH',
        headers: cabeceras,
        body: JSON.stringify(cuerpo),
      }),
  };
}

async function listar(): Promise<void> {
  exigirTodas(['COOLIFY_URL', 'COOLIFY_TOKEN']);
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
  exigirTodas(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_TUNNEL_ID', 'FRONTEND_DOMAIN', 'BACKEND_DOMAIN']);
  const token = exigir('CLOUDFLARE_API_TOKEN');
  const tunel = exigir('CLOUDFLARE_TUNNEL_ID');
  const frontal = exigir('FRONTEND_DOMAIN');
  const dominios = [frontal, exigir('BACKEND_DOMAIN')];
  const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = 'https://api.cloudflare.com/client/v4';

  // La zona es el dominio registrable, no el subdominio donde se publica.
  // `||` y no `??`: en CI la variable sin configurar llega como "" y `??` no
  // cae al respaldo con una cadena vacía, así que se consultaba la zona «» y el
  // error resultante no señalaba a la variable que faltaba.
  const zonaNombre = process.env.CLOUDFLARE_ZONE_NAME || dominios[0].split('.').slice(-2).join('.');
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

  // Cuando el cliente se publica en la raíz de la zona, «www» tiene que
  // resolver igual: un visitante que teclea www con el registro ausente recibe
  // un fallo de DNS, no la página. Coolify ya declara ambos nombres en el FQDN
  // de la aplicación, así que el único cabo suelto es este registro.
  if (frontal === zona.name) dominios.push(`www.${zona.name}`);

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

/* --------------------------- Túnel de Cloudflare -------------------------- */

interface ReglaTunel {
  hostname?: string;
  service: string;
}

/**
 * Publica cada dominio como regla de entrada del túnel.
 *
 * El CNAME solo lleva el tráfico hasta el túnel; quien decide qué hacer con él
 * es la lista de reglas del propio túnel, que enruta por nombre de host a un
 * puerto de la máquina. La última regla es un `http_status:404`, así que un
 * dominio que no está en la lista responde 404 con el cuerpo vacío y sin
 * cabecera de tipo: el mismo síntoma que un dominio mal apuntado, con el DNS
 * y Coolify perfectos. Costó un despliegue entero encontrarlo.
 *
 * El puerto no se escribe a mano: se lee del mapeo que Coolify ya tiene para
 * cada aplicación, que es el único sitio donde ese número está de verdad.
 */
async function sincronizarTunel(): Promise<void> {
  exigirTodas([
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_TUNNEL_ID',
    'CLOUDFLARE_ZONE_NAME',
    'FRONTEND_DOMAIN',
    'BACKEND_DOMAIN',
    'COOLIFY_URL',
    'COOLIFY_TOKEN',
    'COOLIFY_API_UUID',
    'COOLIFY_WEB_UUID',
  ]);
  const cabeceras = {
    Authorization: `Bearer ${exigir('CLOUDFLARE_API_TOKEN')}`,
    'Content-Type': 'application/json',
  };
  const api = 'https://api.cloudflare.com/client/v4';
  const zonaNombre = exigir('CLOUDFLARE_ZONE_NAME');

  // La cuenta se deduce de la zona: es un dato más que mantener si se pide
  // aparte, y Cloudflare ya lo devuelve aquí.
  const zonas = await pedir<{ result: { account: { id: string } }[] }>(
    `${api}/zones?name=${encodeURIComponent(zonaNombre)}`,
    { headers: cabeceras },
  );
  const cuenta = zonas.result[0]?.account?.id;
  if (!cuenta) throw new Error(`No se pudo deducir la cuenta de la zona «${zonaNombre}».`);

  const c = coolify();
  const puertoDe = async (uuid: string): Promise<string> => {
    const app = await c.get<AppCoolify>(`/api/v1/applications/${uuid}`);
    const puerto = app.ports_mappings?.split(',')[0]?.split(':')[0]?.trim();
    if (!puerto) {
      throw new Error(
        `«${app.name}» no tiene mapeo de puertos en Coolify, así que el túnel no ` +
          'tendría a dónde entregar el tráfico.',
      );
    }
    return puerto;
  };
  const frontal = exigir('FRONTEND_DOMAIN');
  const puertoWeb = await puertoDe(exigir('COOLIFY_WEB_UUID'));
  const puertoApi = await puertoDe(exigir('COOLIFY_API_UUID'));

  const deseadas: ReglaTunel[] = [
    { hostname: frontal, service: `http://localhost:${puertoWeb}` },
    ...(frontal === zonaNombre
      ? [{ hostname: `www.${frontal}`, service: `http://localhost:${puertoWeb}` }]
      : []),
    { hostname: exigir('BACKEND_DOMAIN'), service: `http://localhost:${puertoApi}` },
  ];

  const url = `${api}/accounts/${cuenta}/cfd_tunnel/${exigir('CLOUDFLARE_TUNNEL_ID')}/configurations`;
  const actual = await pedir<{ result: { config: { ingress: ReglaTunel[] } } }>(url, {
    headers: cabeceras,
  });
  const ingress = actual.result.config.ingress;

  // Por este túnel pasan todos los proyectos de la cuenta y el PUT reemplaza la
  // lista entera, así que se aborta antes de escribir si la lectura no tiene la
  // forma esperada: una lista mal formada deja sin servicio a todo lo demás.
  const reserva = ingress[ingress.length - 1];
  if (!reserva || reserva.hostname !== undefined) {
    throw new Error('La última regla del túnel no es la de reserva; no se toca nada.');
  }

  let cambios = 0;
  for (const deseada of deseadas) {
    const existente = ingress.find((i) => i.hostname === deseada.hostname);
    if (!existente) {
      ingress.splice(ingress.length - 1, 0, deseada);
      ok(`añadida  ${deseada.hostname} -> ${deseada.service}`);
      cambios++;
    } else if (existente.service !== deseada.service) {
      info(`ajustada ${deseada.hostname}: ${existente.service} -> ${deseada.service}`);
      existente.service = deseada.service;
      cambios++;
    } else {
      info(`sin cambios ${deseada.hostname} -> ${deseada.service}`);
    }
  }

  if (cambios === 0) return;
  await pedir(url, {
    method: 'PUT',
    headers: cabeceras,
    body: JSON.stringify({ config: { ...actual.result.config, ingress } }),
  });
  ok(`túnel actualizado (${ingress.length} reglas, ${cambios} tocadas)`);
}

/* --------------------------- Coolify: dominios ---------------------------- */

interface EnvCoolify {
  key: string;
  is_buildtime: boolean;
  is_literal: boolean;
  is_preview: boolean;
}

/**
 * Vuelca en Coolify los dominios públicos y las variables que dependen de ellos.
 *
 * Cambiar de dominio toca cuatro sitios; tres los cubre este guion y el cuarto
 * era la interfaz de Coolify, a mano. Sin este paso el despliegue queda a medias
 * de una forma que engaña: el DNS ya resuelve, pero el proxy no tiene ruta para
 * el nombre nuevo y responde 404, y aunque la tuviera el cliente seguiría
 * llamando a la API anterior, porque API_URL se incrusta en el paquete al
 * compilar y no se lee en ejecución.
 */
async function sincronizarCoolify(): Promise<void> {
  exigirTodas([
    'COOLIFY_URL',
    'COOLIFY_TOKEN',
    'COOLIFY_API_UUID',
    'COOLIFY_WEB_UUID',
    'FRONTEND_DOMAIN',
    'BACKEND_DOMAIN',
    'WEB_URL',
    'CORS_ORIGINS',
    'API_URL',
    'MAIL_FROM',
  ]);
  const c = coolify();
  const frontal = exigir('FRONTEND_DOMAIN');
  const zona = process.env.CLOUDFLARE_ZONE_NAME ?? '';

  const objetivos = [
    {
      etiqueta: 'WEB',
      uuid: exigir('COOLIFY_WEB_UUID'),
      // El cliente atiende también «www» cuando vive en la raíz de la zona.
      dominios: frontal === zona ? [frontal, `www.${frontal}`] : [frontal],
      variables: { API_URL: exigir('API_URL') },
    },
    {
      etiqueta: 'API',
      uuid: exigir('COOLIFY_API_UUID'),
      dominios: [exigir('BACKEND_DOMAIN')],
      variables: {
        WEB_URL: exigir('WEB_URL'),
        CORS_ORIGINS: exigir('CORS_ORIGINS'),
        API_URL: exigir('API_URL'),
        // También va aquí, aunque su dominio sea el verificado en Resend y no
        // el del sitio: es lo bastante fácil de desincronizar como para no
        // dejarla suelta en la interfaz de Coolify.
        MAIL_FROM: exigir('MAIL_FROM'),
      },
    },
  ] as const;

  for (const objetivo of objetivos) {
    const fqdn = objetivo.dominios.map((d) => `https://${d}`).join(',');
    const app = await c.get<AppCoolify>(`/api/v1/applications/${objetivo.uuid}`);
    if (app.fqdn === fqdn) {
      info(`${objetivo.etiqueta}: dominios sin cambios (${fqdn})`);
    } else {
      await c.patch(`/api/v1/applications/${objetivo.uuid}`, { domains: fqdn });
      ok(`${objetivo.etiqueta}: dominios ${app.fqdn ?? '(ninguno)'} -> ${fqdn}`);
    }

    const existentes = await c.get<EnvCoolify[]>(`/api/v1/applications/${objetivo.uuid}/envs`);
    for (const [clave, valor] of Object.entries(objetivo.variables)) {
      const previa = existentes.find((e) => e.key === clave);
      const cuerpo = {
        key: clave,
        value: valor,
        // «is_buildtime», no «is_build_time»: este último es el nombre que usa
        // la documentación de Coolify y el que rechaza la validación con un 422.
        //
        // API_URL es un ARG del Dockerfile del cliente: si pierde esta marca,
        // el paquete se compila con el valor por defecto y no con el dominio.
        is_buildtime: previa?.is_buildtime ?? false,
        is_literal: previa?.is_literal ?? true,
        is_preview: previa?.is_preview ?? false,
      };
      // Coolify no devuelve el valor de las variables, así que no hay manera de
      // saltarse la escritura cuando ya coincide: se escribe siempre.
      const ruta = `/api/v1/applications/${objetivo.uuid}/envs`;
      if (previa) await c.patch(ruta, cuerpo);
      else await c.post(ruta, cuerpo);
      ok(`${objetivo.etiqueta}: ${clave} = ${valor}`);
    }
  }

  aviso('Las variables se aplican al reconstruir: ejecute «bun run deploy» a continuación.');
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
  exigirTodas(['COOLIFY_URL', 'COOLIFY_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO']);
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
  exigirTodas(
    objetivos.map((objetivo) => (objetivo === 'api' ? 'COOLIFY_API_UUID' : 'COOLIFY_WEB_UUID')),
  );
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

/* -------------------------------- Espera ---------------------------------- */

interface DespliegueCoolify {
  deployment_uuid: string;
  commit: string | null;
  status: string;
  created_at: string;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Dominio público de una aplicación.
 *
 * La variable de entorno manda, pero si llega vacía se usa el `fqdn` que
 * Coolify tiene configurado. Esto existe porque un `${{ vars.X }}` sin definir
 * no aborta el job: se expande a cadena vacía y la comprobación acaba pidiendo
 * «https:///», que falla al instante y durante todos los reintentos sin que el
 * registro diga por qué. Coolify es la fuente de verdad del dominio, así que
 * sirve de respaldo.
 */
function dominioDe(app: AppCoolify | undefined, variable: string): string | null {
  const delEntorno = process.env[variable];
  if (delEntorno) return delEntorno.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const fqdn = app?.fqdn?.split(',')[0]?.trim();
  if (!fqdn) return null;
  aviso(`${variable} no está definida; se usa el dominio de Coolify (${fqdn}).`);
  return fqdn.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

/** Espera a que Coolify termine de construir el despliegue de una aplicación. */
async function esperarConstruccion(uuid: string, etiqueta: string, sha?: string): Promise<boolean> {
  const c = coolify();
  const limite = Date.now() + 20 * 60 * 1000;
  let ultimo = '';

  while (Date.now() < limite) {
    const { deployments } = await c.get<{ deployments: DespliegueCoolify[] }>(
      `/api/v1/deployments/applications/${uuid}?take=10`,
    );
    // Se sigue el despliegue de ESTE commit; si no aparece (despliegue manual,
    // o Coolify aún no lo ha registrado) se sigue el más reciente.
    const propio = sha ? deployments.find((d) => d.commit?.startsWith(sha.slice(0, 7))) : undefined;
    const d = propio ?? deployments[0];
    if (!d) {
      info(`${etiqueta}: Coolify aún no ha registrado ningún despliegue`);
      await dormir(10_000);
      continue;
    }

    if (d.status !== ultimo) {
      info(`${etiqueta}: despliegue ${d.deployment_uuid} · ${d.status}`);
      ultimo = d.status;
    }
    if (d.status === 'finished') return true;
    if (d.status === 'failed' || d.status.startsWith('cancelled')) {
      mal(`${etiqueta}: la construcción terminó en «${d.status}». Revise el registro en Coolify.`);
      return false;
    }
    await dormir(10_000);
  }
  mal(`${etiqueta}: la construcción no terminó en 20 minutos`);
  return false;
}

/** Espera a que una URL pública devuelva 200. */
async function esperarUrl(url: string, etiqueta: string): Promise<boolean> {
  const limite = Date.now() + 10 * 60 * 1000;
  let intento = 0;
  let ultimo = '';

  while (Date.now() < limite) {
    intento++;
    let codigo = '000';
    try {
      const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
      codigo = String(r.status);
    } catch (error) {
      codigo = `sin respuesta (${error instanceof Error ? error.message : String(error)})`;
    }
    if (codigo === '200') {
      ok(`${etiqueta}: ${url} responde 200 (intento ${intento})`);
      return true;
    }
    if (codigo !== ultimo) {
      info(`${etiqueta}: ${url} -> ${codigo}`);
      ultimo = codigo;
    }
    await dormir(15_000);
  }
  mal(`${etiqueta}: ${url} no respondió 200 tras 10 minutos (último: ${ultimo})`);
  return false;
}

/**
 * Comprobación posterior al despliegue.
 *
 * Se ejecuta como paso propio y no como guion suelto en el workflow para que
 * reutilice `exigirTodas`: una variable sin configurar se señala por su nombre
 * en cinco segundos, en vez de disfrazarse de diez minutos de reintentos.
 */
async function esperarProduccion(): Promise<number> {
  exigirTodas(['COOLIFY_URL', 'COOLIFY_TOKEN', 'COOLIFY_API_UUID', 'COOLIFY_WEB_UUID']);
  const c = coolify();
  const apps = await c.get<AppCoolify[]>('/api/v1/applications');
  const sha = process.env.GITHUB_SHA;
  if (sha) info(`comprobando el despliegue del commit ${sha.slice(0, 7)}`);

  const objetivos = [
    ['API', 'COOLIFY_API_UUID', 'BACKEND_DOMAIN', '/api/v1/health'],
    ['WEB', 'COOLIFY_WEB_UUID', 'FRONTEND_DOMAIN', '/'],
  ] as const;

  let fallos = 0;
  for (const [etiqueta, claveUuid, claveDominio, ruta] of objetivos) {
    const uuid = exigir(claveUuid);
    const dominio = dominioDe(
      apps.find((a) => a.uuid === uuid),
      claveDominio,
    );
    if (!dominio) {
      mal(`${etiqueta}: no hay dominio. Defina ${claveDominio} o el FQDN de la aplicación en Coolify.`);
      fallos++;
      continue;
    }

    // Las dos esperas van seguidas a propósito: si la construcción falla no
    // tiene sentido esperar diez minutos a una URL que servirá la versión
    // anterior y devolverá 200 igualmente, ocultando el fallo real.
    if (!(await esperarConstruccion(uuid, etiqueta, sha))) {
      fallos++;
      continue;
    }
    if (!(await esperarUrl(`https://${dominio}${ruta}`, etiqueta))) fallos++;
  }
  return fallos;
}

/* ----------------------------------- Main --------------------------------- */

const args = process.argv.slice(2);
cargarEnv();

try {
  if (args.includes('--list')) {
    await listar();
  } else if (args.includes('--dns')) {
    await sincronizarDns();
  } else if (args.includes('--tunel')) {
    await sincronizarTunel();
  } else if (args.includes('--coolify')) {
    await sincronizarCoolify();
  } else if (args.includes('--check')) {
    process.exit((await comprobar()) > 0 ? 1 : 0);
  } else if (args.includes('--esperar')) {
    process.exit((await esperarProduccion()) > 0 ? 1 : 0);
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
