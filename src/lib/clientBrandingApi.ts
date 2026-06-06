/**
 * Public client branding (no auth) for login/register pages and shell.
 */

import { fetchWithAuth } from './authApi';
import { autoForeground, hoverColor } from './contrast';

export type PublicBranding = {
  appName: string;
  clientName: string;
  shortName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginLogoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: string;
  footerText: string | null;
  poweredByVisible: boolean;
};

const DEFAULT_BRANDING: PublicBranding = {
  appName: 'RealTrackApp',
  clientName: 'RealTrack',
  shortName: 'RT',
  logoUrl: null,
  faviconUrl: null,
  loginLogoUrl: null,
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  accentColor: '#0ea5e9',
  themeMode: 'dark',
  footerText: null,
  poweredByVisible: false,
};

let cached: PublicBranding | null = null;

export function getDefaultBranding(): PublicBranding {
  return { ...DEFAULT_BRANDING };
}

export function invalidateBrandingCache(): void {
  cached = null;
}

export async function fetchPublicBranding(): Promise<PublicBranding> {
  if (cached) return { ...cached };

  try {
    const res = await fetch('/api/client-settings/branding');
    if (!res.ok) {
      return getDefaultBranding();
    }
    const data = (await res.json()) as PublicBranding;
    cached = { ...DEFAULT_BRANDING, ...data };
    return { ...cached };
  } catch {
    return getDefaultBranding();
  }
}

function resolveThemeMode(themeMode: string): 'light' | 'dark' {
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/** Apply theme tokens to document root (login + shell). */
export function applyBrandingToDocument(branding: PublicBranding): void {
  const root = document.documentElement;

  // Brand background colors
  root.style.setProperty('--brand-primary', branding.primaryColor);
  root.style.setProperty('--brand-secondary', branding.secondaryColor);
  root.style.setProperty('--brand-accent', branding.accentColor);

  // Contrast-safe foregrounds (white or black based on luminance)
  root.style.setProperty('--brand-primary-fg', autoForeground(branding.primaryColor));
  root.style.setProperty('--brand-secondary-fg', autoForeground(branding.secondaryColor));
  root.style.setProperty('--brand-accent-fg', autoForeground(branding.accentColor));

  // Hover states (±10% brightness)
  root.style.setProperty('--brand-primary-hover', hoverColor(branding.primaryColor));
  root.style.setProperty('--brand-secondary-hover', hoverColor(branding.secondaryColor));
  root.style.setProperty('--brand-accent-hover', hoverColor(branding.accentColor));

  const resolved = resolveThemeMode(branding.themeMode);
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;

  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }

  document.title = branding.appName;
}

/** Normalize hex color input (#RGB or #RRGGBB). */
export function normalizeHexColor(value: string, fallback: string): string {
  const v = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
  if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

export const COLOR_PRESETS = [
  { name: 'Blue', primary: '#2563eb', secondary: '#1e293b', accent: '#0ea5e9' },
  { name: 'Indigo', primary: '#4f46e5', secondary: '#1e1b4b', accent: '#818cf8' },
  { name: 'Emerald', primary: '#059669', secondary: '#064e3b', accent: '#34d399' },
  { name: 'Amber', primary: '#d97706', secondary: '#451a03', accent: '#fbbf24' },
  { name: 'Rose', primary: '#e11d48', secondary: '#4c0519', accent: '#fb7185' },
  { name: 'Slate', primary: '#475569', secondary: '#0f172a', accent: '#94a3b8' },
] as const;

/** Authenticated client settings row (GET /api/client-settings). */
export type ClientSettingsRecord = {
  appName: string;
  clientName: string;
  shortName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginLogoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: string;
  sidebarTheme: string;
  navbarTheme: string;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  whiteLabelEnabled: boolean;
  poweredByVisible: boolean;
};

/** PATCH body — must match backend UpdateClientSettingsDto only. */
export type UpdateClientSettingsPayload = {
  appName: string;
  clientName: string;
  shortName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginLogoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeMode: string;
  sidebarTheme: string;
  navbarTheme: string;
  footerText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  whiteLabelEnabled: boolean;
  poweredByVisible: boolean;
};

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Build a PATCH payload the Nest ValidationPipe accepts (no entity metadata). */
export function toUpdateClientSettingsPayload(
  data: ClientSettingsRecord,
): UpdateClientSettingsPayload {
  return {
    appName: data.appName.trim(),
    clientName: data.clientName.trim(),
    shortName: emptyToNull(data.shortName),
    logoUrl: emptyToNull(data.logoUrl),
    faviconUrl: emptyToNull(data.faviconUrl),
    loginLogoUrl: emptyToNull(data.loginLogoUrl),
    primaryColor: normalizeHexColor(data.primaryColor, '#2563eb'),
    secondaryColor: normalizeHexColor(data.secondaryColor, '#1e293b'),
    accentColor: normalizeHexColor(data.accentColor, '#0ea5e9'),
    themeMode: data.themeMode,
    sidebarTheme: data.sidebarTheme,
    navbarTheme: data.navbarTheme,
    footerText: emptyToNull(data.footerText),
    supportEmail: emptyToNull(data.supportEmail),
    supportPhone: emptyToNull(data.supportPhone),
    whiteLabelEnabled: data.whiteLabelEnabled,
    poweredByVisible: data.poweredByVisible,
  };
}

export async function fetchClientSettings(): Promise<ClientSettingsRecord> {
  return fetchWithAuth<ClientSettingsRecord>('/api/client-settings');
}

export async function updateClientSettings(
  data: ClientSettingsRecord,
): Promise<ClientSettingsRecord> {
  return fetchWithAuth<ClientSettingsRecord>('/api/client-settings', {
    method: 'PATCH',
    body: JSON.stringify(toUpdateClientSettingsPayload(data)),
  });
}
