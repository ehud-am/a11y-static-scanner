/**
 * Shared colour-parsing and WCAG-contrast utilities.
 * Used by both the JSX AST pass (inline styles) and the CSS pass
 * (stylesheet class rules).
 */

// ─── Hex / named colour helpers ───────────────────────────────────────────────

/** Convert a 3- or 6-digit hex colour to an RGB triple. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  if (full.length !== 6) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Basic named-colour lookup (covers common palette used in UIs). */
export const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0], white: [255, 255, 255],
  red: [255, 0, 0], lime: [0, 255, 0], blue: [0, 0, 255],
  yellow: [255, 255, 0], aqua: [0, 255, 255], cyan: [0, 255, 255],
  fuchsia: [255, 0, 255], magenta: [255, 0, 255],
  silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128],
  maroon: [128, 0, 0], olive: [128, 128, 0], green: [0, 128, 0],
  purple: [128, 0, 128], teal: [0, 128, 128], navy: [0, 0, 128],
  orange: [255, 165, 0], coral: [255, 127, 80], pink: [255, 192, 203],
  lightgray: [211, 211, 211], lightgrey: [211, 211, 211],
  darkgray: [169, 169, 169], darkgrey: [169, 169, 169],
  lightblue: [173, 216, 230], lightyellow: [255, 255, 224],
  lightgreen: [144, 238, 144], lightcoral: [240, 128, 128],
  darkred: [139, 0, 0], darkblue: [0, 0, 139], darkgreen: [0, 100, 0],
  indianred: [205, 92, 92], hotpink: [255, 105, 180],
  goldenrod: [218, 165, 32], chocolate: [210, 105, 30],
};

/**
 * Parse a CSS colour string (hex / rgb() / rgba() / named) to [R, G, B].
 * Returns null for values that cannot be resolved statically
 * (e.g. `transparent`, `inherit`, `currentcolor`, `var(--foo)`).
 */
export function parseCssColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (
    v === 'transparent' ||
    v === 'inherit' ||
    v === 'currentcolor' ||
    v.startsWith('var(')
  ) {
    return null;
  }
  if (v.startsWith('#')) return hexToRgb(v);
  const rgbMatch = v.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  return NAMED_COLORS[v] ?? null;
}

// ─── WCAG contrast computation ────────────────────────────────────────────────

function srgbLinearise(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (
    0.2126 * srgbLinearise(r) +
    0.7152 * srgbLinearise(g) +
    0.0722 * srgbLinearise(b)
  );
}

export function wcagContrastRatio(
  c1: [number, number, number],
  c2: [number, number, number],
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
