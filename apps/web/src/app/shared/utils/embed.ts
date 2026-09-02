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
