import { Logger } from '@nestjs/common';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Medios de la demostración                                                  */
/*                                                                            */
/*  Fotos y vídeos de Pexels, libres de derechos y sin atribución obligatoria. */
/*  Cada uno va elegido por el tema del curso al que acompaña: la demostración */
/*  tiene que parecer una escuela de pastelería de verdad, no una plantilla    */
/*  con imágenes de relleno.                                                   */
/*                                                                            */
/*  Las fotos se componen a partir de su identificador, que es estable. Los    */
/*  vídeos no: el nombre del fichero incluye resolución y fotogramas, y varía  */
/*  de un vídeo a otro, así que hay que preguntárselo a la API. Por eso:       */
/*                                                                            */
/*    · con `PEXELS_API_KEY` puesta, la siembra resuelve los vídeos y guarda   */
/*      el resultado en una caché, de modo que las siguientes siembras no      */
/*      vuelven a salir a la red y el contenido no cambia;                     */
/*    · sin clave, la demostración se siembra igual, con sus fotos y sin los   */
/*      vídeos, y el registro lo dice claramente en vez de dejar reproductores */
/*      rotos por la página.                                                   */
/* -------------------------------------------------------------------------- */

const logger = new Logger('Seed·Medios');

/** Dirección de una foto de Pexels a partir de su identificador. */
export function foto(id: number, ancho = 1200, alto = 800): string {
  return (
    `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg` +
    `?auto=compress&cs=tinysrgb&fit=crop&w=${ancho}&h=${alto}`
  );
}

/** Recorte cuadrado, para avatares y miniaturas. */
export function retrato(id: number, lado = 400): string {
  return foto(id, lado, lado);
}

/**
 * Fotos elegidas para la demostración, por lo que sale en ellas.
 *
 * El número es el identificador de Pexels; la dirección se compone sola.
 */
export const FOTOS = {
  /** Pastelera amasando: portada de la escuela. */
  amasando: 5964530,
  /** Obrador con la vitrina llena: sección «sobre nosotros». */
  obrador: 31505379,
  /** Vitrina de pastelería francesa: galería. */
  vitrina: 3639538,
  /** Interior de la tienda: galería. */
  tienda: 10438814,
  /** Mostrador de pastelería: galería. */
  mostrador: 29286450,
  /** Surtido de pasteles y tartaletas: galería. */
  surtido: 31101247,
  /** Panes en el obrador: curso de panadería. */
  panes: 3341067,
  /** Pan de masa madre, corteza tostada: curso de panadería. */
  masaMadre: 6605201,
  /** Pan recién horneado, primer plano: lección de panadería. */
  panReciente: 10202998,
  /** Torta de chocolate con fresas: curso de tortas. */
  tortaChocolate: 34802628,
  /** Torta glaseada en rojo: lección de decoración. */
  tortaGlaseada: 20385832,
  /** Torta de capas con fruta: galería de tortas. */
  tortaCapas: 18732594,
  /** Chocolate en primer plano: curso de chocolatería. */
  chocolate: 6054918,
  /** Bandeja de macarons y petit fours: curso de pastelería fina. */
  bandeja: 35618231,
  /** Macarons de colores: lección de merengue. */
  macarons: 31807952,
  /** Tres macarons: miniatura. */
  macaronsTrio: 8356208,
  /** Cocina profesional en marcha: profesorado. */
  cocina: 262978,
} as const;

export type ClaveFoto = keyof typeof FOTOS;

/**
 * Vídeos de la demostración.
 *
 * Con `id` se pide ese vídeo concreto, que es el que se eligió mirándolo. Sin
 * él se busca por la consulta y se coge el primero: sirve para los huecos que
 * no tienen todavía un vídeo elegido a mano.
 */
export const VIDEOS: Record<string, { readonly id?: number; readonly consulta: string }> = {
  /** Manos decorando una torta: portada de la escuela. */
  decorando: { id: 8477931, consulta: 'decorating a cake with cream' },
  /** Vitrina de pastelería: presentación del curso de pastelería peruana. */
  vitrina: { id: 35872521, consulta: 'pastries on display at bakery' },
  /** Obrador en marcha: curso de panadería. */
  obrador: { id: 28988753, consulta: 'baking bread in bakery oven' },
  /** Chocolate fundido: curso de chocolatería. */
  chocolate: { consulta: 'melted chocolate pouring' },
};

export type ClaveVideo = 'decorando' | 'vitrina' | 'obrador' | 'chocolate';

/** Direcciones de los vídeos, ya resueltas. `null` si no se pudo resolver. */
export type Videos = Record<ClaveVideo, string | null>;

/* ------------------------------ Resolución -------------------------------- */

interface FicheroDeVideo {
  readonly link: string;
  readonly quality: string;
  readonly width: number;
  readonly file_type: string;
}

interface VideoDePexels {
  readonly id: number;
  readonly video_files: FicheroDeVideo[];
}

interface BusquedaDeVideos {
  readonly videos: VideoDePexels[];
}

/**
 * El fichero que conviene servir: el de mejor calidad que no pase de 1920 px.
 *
 * Los originales de Pexels llegan a 4K y pesan decenas de megas; en una página
 * de venta eso es una espera larga a cambio de nada, porque el reproductor
 * ocupa como mucho el ancho de la pantalla.
 */
function mejorFichero(video: VideoDePexels): string | null {
  const candidatos = video.video_files
    .filter((f) => f.file_type === 'video/mp4' && f.width > 0)
    .sort((a, b) => b.width - a.width);
  return (candidatos.find((f) => f.width <= 1920) ?? candidatos[0])?.link ?? null;
}

/** Fichero donde se guarda lo resuelto, para no volver a salir a la red. */
const CACHE = join(process.cwd(), '.demo-media.json');

function leerCache(): Partial<Videos> {
  if (!existsSync(CACHE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8')) as Partial<Videos>;
  } catch {
    // Una caché ilegible no es motivo para parar la siembra: se rehace.
    return {};
  }
}

async function pedir<T>(url: string, clave: string): Promise<T> {
  const respuesta = await fetch(url, { headers: { Authorization: clave } });
  if (!respuesta.ok) throw new Error(`Pexels respondió ${respuesta.status} a ${url}`);
  return (await respuesta.json()) as T;
}

/** El vídeo elegido a mano, o el primero que devuelva la búsqueda. */
async function resolverUno(
  ranura: { readonly id?: number; readonly consulta: string },
  clave: string,
): Promise<string | null> {
  if (ranura.id) {
    const video = await pedir<VideoDePexels>(
      `https://api.pexels.com/videos/videos/${ranura.id}`,
      clave,
    );
    return mejorFichero(video);
  }

  const busqueda = await pedir<BusquedaDeVideos>(
    `https://api.pexels.com/videos/search?per_page=1&orientation=landscape&query=${encodeURIComponent(ranura.consulta)}`,
    clave,
  );
  const primero = busqueda.videos[0];
  return primero ? mejorFichero(primero) : null;
}

/**
 * Resuelve las direcciones de los vídeos de la demostración.
 *
 * Nunca lanza: si no hay clave o la red falla, devuelve lo que tenga y avisa.
 * Una demostración sin vídeos se puede enseñar; una siembra a medias, no.
 */
export async function resolverVideos(): Promise<Videos> {
  const vacio = Object.fromEntries(Object.keys(VIDEOS).map((k) => [k, null])) as Videos;
  const cache = leerCache();
  const resuelto: Videos = { ...vacio, ...cache };

  const faltan = (Object.keys(VIDEOS) as ClaveVideo[]).filter((clave) => !resuelto[clave]);
  if (!faltan.length) {
    logger.log(`Vídeos: ${Object.keys(VIDEOS).length} en caché`);
    return resuelto;
  }

  const clave = process.env.PEXELS_API_KEY?.trim();
  if (!clave) {
    logger.warn(
      'Sin PEXELS_API_KEY: la demostración se siembra con sus fotos pero sin vídeos. ' +
        'Ponga la clave (pexels.com/api) y vuelva a sembrar para completarla.',
    );
    return resuelto;
  }

  for (const nombre of faltan) {
    try {
      resuelto[nombre] = await resolverUno(VIDEOS[nombre], clave);
    } catch (error) {
      logger.warn(
        `No se pudo resolver el vídeo «${nombre}»: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  const logrados = Object.values(resuelto).filter(Boolean).length;
  logger.log(`Vídeos: ${logrados}/${Object.keys(VIDEOS).length} resueltos`);

  try {
    writeFileSync(CACHE, `${JSON.stringify(resuelto, null, 2)}\n`);
  } catch {
    // Que no se pueda guardar la caché solo cuesta una llamada más la próxima vez.
  }

  return resuelto;
}
