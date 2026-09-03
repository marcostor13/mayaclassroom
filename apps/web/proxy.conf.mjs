import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * El puerto de la API vive en el `.env` de la raíz (`PORT`). Leerlo aquí evita
 * duplicarlo: con el valor fijo, cambiarlo en el `.env` dejaba el proxy
 * apuntando al puerto antiguo y el cliente recibía ECONNREFUSED en cada
 * llamada sin ninguna pista de por qué.
 */
function puertoApi() {
  for (const fichero of ['.env.local', '.env']) {
    const ruta = join(raiz, fichero);
    if (!existsSync(ruta)) continue;
    const coincidencia = readFileSync(ruta, 'utf8').match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    if (coincidencia) return coincidencia[1];
  }
  return process.env.PORT ?? '3000';
}

// 127.0.0.1 en lugar de localhost: la API se enlaza solo a IPv4 (HOST=0.0.0.0)
// y en Windows `localhost` resuelve antes a ::1, que rechaza la conexión.
export default {
  '/api': {
    target: `http://127.0.0.1:${puertoApi()}`,
    secure: false,
    changeOrigin: true,
    // `ws` es imprescindible para la señalización de las aulas en vivo: sin
    // ella el proxy responde a `/api/live-socket` con HTTP normal, el socket
    // no llega a ascender a WebSocket y la sala se queda cargando para
    // siempre sin ningún error en la consola.
    ws: true,
  },
};
