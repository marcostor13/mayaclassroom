/* -------------------------------------------------------------------------- */
/*  Identidad de marca — Maya Classroom                                        */
/*  Rojo pastel elegante + blanco. Los mismos tokens alimentan el tema SCSS    */
/*  del cliente y la personalización por empresa desde la API.                 */
/* -------------------------------------------------------------------------- */

export const MAYA_BRAND = {
  name: 'Maya Classroom',
  shortName: 'Maya',
  tagline: 'Aprende, enseña y crece.',
  colors: {
    /** Rojo elegante principal. */
    primary: '#E4574D',
    primaryDark: '#C2413A',
    primaryDeep: '#8E2A22',
    /** Rojo pastel de apoyo. */
    pastel: '#F4A8A0',
    pastelSoft: '#FBDCD8',
    surfaceTint: '#FFF8F7',
    accent: '#F2B441',
    success: '#2E9E6B',
    warning: '#E2A03F',
    danger: '#D64545',
    info: '#3E7BC6',
    ink: '#2A2320',
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
