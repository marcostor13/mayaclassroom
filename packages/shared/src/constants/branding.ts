/* -------------------------------------------------------------------------- */
/*  Identidad de marca — Maya Classroom                                        */
/*  Rojo vívido sobre blanco puro. Los mismos tokens alimentan el tema SCSS    */
/*  del cliente y la personalización por empresa desde la API.                 */
/* -------------------------------------------------------------------------- */

export const MAYA_BRAND = {
  name: 'Maya Classroom',
  shortName: 'Maya',
  tagline: 'Aprende, enseña y crece.',
  colors: {
    /** Rojo de marca: se usa como relleno (botones, marca, chips). */
    primary: '#FF3B2E',
    primaryDark: '#D91F12',
    /** Rojo legible sobre blanco (6.1:1): enlaces y texto de marca. */
    primaryInk: '#C31B0D',
    /** El más oscuro (7.6:1): texto de marca sobre fondos claros teñidos. */
    primaryDeep: '#A81609',
    /** Rojo claro de apoyo. */
    pastel: '#FF8F7D',
    pastelSoft: '#FFE1DD',
    surfaceTint: '#FFF3F1',
    accent: '#FFB020',
    success: '#12A150',
    warning: '#D98A00',
    danger: '#E02020',
    info: '#1E6FE0',
    ink: '#101114',
    white: '#FFFFFF',
  },
  fonts: {
    heading: "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
    body: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },
} as const;

export type BrandColors = typeof MAYA_BRAND.colors;

export interface TenantBranding {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  loginBackgroundUrl?: string | null;
  customCss?: string | null;
  welcomeMessage?: string | null;
}

export const DEFAULT_TENANT_BRANDING: TenantBranding = {
  primaryColor: MAYA_BRAND.colors.primary,
  accentColor: MAYA_BRAND.colors.accent,
  logoUrl: null,
  faviconUrl: null,
  loginBackgroundUrl: null,
  customCss: null,
  welcomeMessage: null,
};
