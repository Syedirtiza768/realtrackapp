/**
 * WCAG 2.1 contrast / luminance utilities.
 *
 * Used by the branding engine to guarantee readable foreground colors
 * against any custom brand color, regardless of theme mode.
 */

/** Parse a hex string into RGB [0-255]. Accepts #RGB or #RRGGBB. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** sRGB linearisation step — WCAG 2.1 relative luminance. */
function linearise(channel8bit: number): number {
  const s = channel8bit / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.1 relative luminance of a hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colors.
 * Always >= 1 (lighter divided by darker).
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/** Whether a color is considered "dark" (luminance < 0.5). */
export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.5;
}

/**
 * Returns a pure-white or pure-black foreground that meets
 * WCAG AA (4.5:1) against the given background.
 *
 * Falls back to whichever has the higher ratio, even if neither
 * hits 4.5:1 (which can happen with very mid-luminance colors
 * around #808080 — in practice brand colors are rarely that flat).
 */
export function autoForeground(bgHex: string): '#ffffff' | '#000000' {
  const whiteRatio = contrastRatio(bgHex, '#ffffff');
  const blackRatio = contrastRatio(bgHex, '#000000');
  return whiteRatio >= blackRatio ? '#ffffff' : '#000000';
}

/**
 * Lighten or darken a hex color by a given amount.
 * Positive amount = lighter, negative = darker.
 * amount is in [-1, 1] range where 0 = no change.
 */
export function adjustColor(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const delta = Math.round(amount * 255);
  const clamp = (c: number) => Math.max(0, Math.min(255, c + delta));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g)
    .toString(16)
    .padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Compute a hover shade for a given color:
 * - Light colors → darken by 10%
 * - Dark colors → lighten by 10%
 */
export function hoverColor(hex: string): string {
  return isDark(hex) ? adjustColor(hex, 0.1) : adjustColor(hex, -0.1);
}

/**
 * Validate that a brand color + its auto-foreground meet
 * WCAG AA 4.5:1 (normal text). Returns the contrast ratio.
 */
export function validateBrandColor(hex: string): {
  foreground: '#ffffff' | '#000000';
  ratio: number;
  passesAA: boolean;
  passesAALarge: boolean;
} {
  const fg = autoForeground(hex);
  const ratio = contrastRatio(hex, fg);
  return {
    foreground: fg,
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAALarge: ratio >= 3,
  };
}
