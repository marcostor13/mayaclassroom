import { Injectable, effect, signal } from '@angular/core';
import { TenantBranding } from '../models';

export type ThemeMode = 'light' | 'dark' | 'system';

const THEME_KEY = 'maya.theme';

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

  constructor() {
    effect(() => this.apply(this.modeSignal()));
    this.media.addEventListener('change', () => {
      if (this.modeSignal() === 'system') this.apply('system');
    });
  }

  setMode(mode: ThemeMode): void {
    localStorage.setItem(THEME_KEY, mode);
    this.modeSignal.set(mode);
  }

  toggle(): void {
    this.setMode(this.resolved() === 'dark' ? 'light' : 'dark');
  }

  resolved(): 'light' | 'dark' {
    const mode = this.modeSignal();
    if (mode === 'system') return this.media.matches ? 'dark' : 'light';
    return mode;
  }

  private apply(mode: ThemeMode): void {
    const resolved = mode === 'system' ? (this.media.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset['theme'] = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0d0e11' : '#ff3b2e');
  }

  /** Aplica los colores de la empresa sobre los tokens de marca. */
  applyBranding(branding: TenantBranding | null | undefined): void {
    const root = document.documentElement;
    if (!branding) {
      root.style.removeProperty('--maya-primary');
      root.style.removeProperty('--maya-accent');
      return;
    }
    if (branding.primaryColor) {
      root.style.setProperty('--maya-primary', branding.primaryColor);
      root.style.setProperty('--maya-primary-hover', this.shade(branding.primaryColor, -8));
      root.style.setProperty('--maya-primary-active', this.shade(branding.primaryColor, -16));
      root.style.setProperty('--maya-primary-deep', this.shade(branding.primaryColor, -38));
      root.style.setProperty('--maya-primary-soft', this.tint(branding.primaryColor, 82));
      root.style.setProperty('--maya-primary-softer', this.tint(branding.primaryColor, 94));
      root.style.setProperty('--maya-pastel', this.tint(branding.primaryColor, 46));
    }
    if (branding.accentColor) {
      root.style.setProperty('--maya-accent', branding.accentColor);
    }
    if (branding.customCss) {
      let style = document.getElementById('maya-tenant-css');
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

  /** Mezcla el color con blanco en el porcentaje indicado. */
  private tint(hex: string, percent: number): string {
    const { r, g, b } = this.parse(hex);
    const mix = (channel: number) => Math.round(channel + (255 - channel) * (percent / 100));
    return this.toHex(mix(r), mix(g), mix(b));
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
