import { SignatureUse } from '../enums';

/* -------------------------------------------------------------------------- */
/*  Firma electrónica                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Firma de referencia de una persona.
 *
 * El trazo se guarda como PNG en base64 porque es lo que produce el lienzo del
 * navegador y lo que consume tanto el certificado como el acta de asistencia,
 * sin pasar por el almacén de ficheros ni por una petición extra al pintarlo.
 *
 * `hash` es la huella SHA-256 del trazo junto con quién y cuándo firmó: sirve
 * para demostrar que la imagen que se enseña es la misma que se registró.
 */
export interface UserSignatureDto {
  id: string;
  userId: string;
  /** `data:image/png;base64,…` */
  imageDataUrl: string;
  hash: string;
  signedAt: string;
  /** Ancho y alto del lienzo con que se firmó, para reescalar sin deformar. */
  width: number;
  height: number;
}

/** Firma estampada sobre un hecho concreto: una asistencia, una visualización. */
export interface SignatureRecordDto {
  id: string;
  userId: string;
  userName?: string;
  use: SignatureUse;
  courseId: string | null;
  courseName?: string | null;
  /** Sesión en vivo o módulo firmado, según el uso. */
  referenceId: string | null;
  referenceLabel: string | null;
  signedAt: string;
  hash: string;
  imageDataUrl?: string;
  /** Cómo se registró: útil ante una reclamación. */
  ip: string | null;
}
