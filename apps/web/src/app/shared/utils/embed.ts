/**
 * Convierte el enlace que una persona copia del navegador en el que se puede
 * incrustar en un marco.
 *
 * Nadie tiene a mano la dirección «de incrustar»: se copia la de la barra de
 * direcciones, y sin esta traducción el vídeo no se ve y no hay pista de por
 * qué. Devuelve `null` cuando no reconoce el enlace, para poder avisar en vez
 * de dejar un marco en blanco.
 */
export function toEmbedUrl(value: string | null | undefined): string | null {
  const url = (value ?? '').trim();
  if (!url) return null;

  // Ya está en formato incrustable: se deja tal cual.
  if (
    url.startsWith('https://www.youtube.com/embed/') ||
    url.startsWith('https://www.youtube-nocookie.com/embed/') ||
    url.startsWith('https://player.vimeo.com/video/')
  ) {
    return url;
  }

  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;

  return null;
}

/** Imagen de portada del vídeo, para no cargar el reproductor hasta que se pida. */
export function embedPoster(value: string | null | undefined): string | null {
  const embed = toEmbedUrl(value);
  if (!embed) return null;
  const youtube = embed.match(/youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})/);
  return youtube ? `https://i.ytimg.com/vi/${youtube[1]}/hqdefault.jpg` : null;
}

/**
 * Extensiones de vídeo que el navegador reproduce sin ayuda de nadie.
 *
 * Se admite una cadena de consulta detrás porque los bancos de vídeo —Pexels
 * entre ellos— sirven el fichero con parámetros de descarga.
 */
const FICHERO_DE_VIDEO = /\.(mp4|webm|ogv|ogg|mov|m4v)(?:[?#]|$)/i;

/**
 * Cómo hay que pintar un vídeo: dentro de un marco o con el reproductor del
 * navegador.
 */
export type VideoResuelto =
  /** YouTube, Vimeo: se incrusta en un `iframe`. */
  | { readonly tipo: 'marco'; readonly src: string }
  /** Un `.mp4` suelto: lo reproduce el propio navegador con `<video>`. */
  | { readonly tipo: 'fichero'; readonly src: string };

/**
 * Resuelve un enlace de vídeo, venga de donde venga.
 *
 * No todo el vídeo del mundo está en YouTube: los bancos de material libre
 * dan la dirección del fichero, y meter un `.mp4` en un `iframe` deja el
 * visor pelado del navegador dentro de la página. Distinguir los dos casos
 * aquí permite que quien pega el enlace no tenga que saber la diferencia.
 */
export function resolveVideo(value: string | null | undefined): VideoResuelto | null {
  const url = (value ?? '').trim();
  if (!url) return null;

  const marco = toEmbedUrl(url);
  if (marco) return { tipo: 'marco', src: marco };

  if (/^https?:\/\//i.test(url) && FICHERO_DE_VIDEO.test(url)) return { tipo: 'fichero', src: url };

  return null;
}

/**
 * Normaliza el enlace para guardarlo.
 *
 * Los de YouTube y Vimeo se traducen al formato que se puede incrustar; los
 * ficheros se guardan tal cual. Devuelve `null` si no es ninguna de las dos
 * cosas, para poder avisar en vez de guardar algo que no se verá.
 */
export function normalizeVideoUrl(value: string | null | undefined): string | null {
  return resolveVideo(value)?.src ?? null;
}
