import { Injectable, computed, effect, signal } from '@angular/core';
import { TenantBranding } from '../models';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'maya.theme';

/**
 * Variables que deriva la marca de la empresa. Se limpian todas juntas: al
 * quitar solo `--maya-primary` quedaban seis tonos derivados de la empresa
 * anterior pisando los del tema.
 */
const BRAND_VARS = [
  '--maya-primary',
  '--maya-primary-hover',
  '--maya-primary-active',
  '--maya-primary-deep',
  '--maya-primary-soft',
  '--maya-primary-softer',
  '--maya-pastel',
  '--maya-accent',
] as const;

/** Fondo con el que se mezclan los tonos suaves de la marca en cada tema. */
const LIENZO = { light: '#ffffff', dark: '#0d0e11' } as const;

/**
 * Tema visual: modo claro/oscuro/sistema y personalización de marca por
 * empresa, aplicada sobre las variables CSS del sistema de diseño.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly modeSignal = signal<ThemeMode>(
    (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'system',
  );
  readonly mode = this.modeSignal.asReadonly();

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);
  /** La marca vigente, guardada para poder repintarla al cambiar de tema. */
  private readonly branding = signal<TenantBranding | null>(null);

  readonly resolvedMode = computed<'light' | 'dark'>(() => {
    const mode = this.modeSignal();
    return mode === 'system' ? (this.systemDark() ? 'dark' : 'light') : mode;
  });

  constructor() {
    this.media.addEventListener('change', (event) => this.systemDark.set(event.matches));
    // Tema y marca se pintan en el mismo efecto porque dependen uno del otro:
    // los tonos suaves de la empresa se mezclan con el fondo, y el fondo lo
    // decide el tema. Separarlos dejaba la marca calculada para el tema
    // anterior hasta la siguiente carga.
    effect(() => this.paint(this.resolvedMode(), this.branding()));
  }

  setMode(mode: ThemeMode): void {
    localStorage.setItem(THEME_KEY, mode);
    this.modeSignal.set(mode);
  }

  toggle(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  resolved(): 'light' | 'dark' {
    return this.resolvedMode();
  }

  /** Aplica los colores de la empresa sobre los tokens de marca. */
  applyBranding(branding: TenantBranding | null | undefined): void {
    this.branding.set(branding ?? null);
  }

  private paint(resolved: 'light' | 'dark', branding: TenantBranding | null): void {
    const root = document.documentElement;
    root.dataset['theme'] = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? LIENZO.dark : '#ff3b2e');

    for (const name of BRAND_VARS) root.style.removeProperty(name);
    const custom = document.getElementById('maya-tenant-css');
    if (custom) custom.textContent = '';
    if (!branding) return;

    if (branding.primaryColor) {
      const oscuro = resolved === 'dark';
      const lienzo = LIENZO[resolved];
      root.style.setProperty('--maya-primary', branding.primaryColor);
      // En oscuro los estados aclaran en vez de oscurecer: sobre un lienzo
      // negro, oscurecer el color al pasar el ratón lo apaga en vez de
      // destacarlo.
      root.style.setProperty('--maya-primary-hover', this.shade(branding.primaryColor, oscuro ? 8 : -8));
      root.style.setProperty(
        '--maya-primary-active',
        this.shade(branding.primaryColor, oscuro ? 16 : -16),
      );
      // «deep» se usa como texto encima de los tonos suaves, así que tiene que
      // ir en dirección contraria al lienzo para que contraste.
      root.style.setProperty(
        '--maya-primary-deep',
        oscuro ? this.mix(branding.primaryColor, 46, LIENZO.light) : this.shade(branding.primaryColor, -38),
      );
      // Aquí estaba el fallo que dejaba blancas las tarjetas «--accent»: estos
      // tres tonos se mezclaban siempre con blanco, también en tema oscuro, y
      // al escribirse en línea sobre `:root` ganaban al `[data-theme='dark']`
      // del sistema de diseño, así que ni el CSS podía corregirlo.
      root.style.setProperty('--maya-primary-soft', this.mix(branding.primaryColor, 82, lienzo));
      root.style.setProperty('--maya-primary-softer', this.mix(branding.primaryColor, 94, lienzo));
      root.style.setProperty('--maya-pastel', this.mix(branding.primaryColor, 46, lienzo));
    }
    if (branding.accentColor) {
      root.style.setProperty('--maya-accent', branding.accentColor);
    }
    if (branding.customCss) {
      let style = custom;
      if (!style) {
        style = document.createElement('style');
        style.id = 'maya-tenant-css';
        document.head.appendChild(style);
      }
      style.textContent = branding.customCss;
    }
  }

  /** Oscurece (porcentaje negativo) o aclara un color hexadecimal. */
  private shade(hex: string, percent: number): string {
    const { r, g, b } = this.parse(hex);
    const factor = 1 + percent / 100;
    return this.toHex(
      Math.min(255, Math.max(0, Math.round(r * factor))),
      Math.min(255, Math.max(0, Math.round(g * factor))),
      Math.min(255, Math.max(0, Math.round(b * factor))),
    );
  }

  /** Mezcla el color con otro (el fondo del tema) en el porcentaje indicado. */
  private mix(hex: string, percent: number, hacia: string): string {
    const color = this.parse(hex);
    const destino = this.parse(hacia);
    const canal = (from: number, to: number) => Math.round(from + (to - from) * (percent / 100));
    return this.toHex(
      canal(color.r, destino.r),
      canal(color.g, destino.g),
      canal(color.b, destino.b),
    );
  }

  private parse(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  private toHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
}
