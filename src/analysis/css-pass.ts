/**
 * CSS pass — parse plain CSS files and build a map of
 *   className → { color, backgroundColor }
 *
 * This map is consumed by the AST pass to detect colour-contrast violations
 * in elements styled via CSS classes, complementing the existing inline-style
 * check which only covers `style={{ color: '...' }}` props.
 *
 * Limitations (acceptable for static analysis):
 *   - Only handles plain CSS / CSS Modules (.css). SCSS/LESS are not parsed.
 *   - Only matches simple `.className { ... }` rules; nested rules,
 *     @media queries, pseudo-selectors, and compound selectors are ignored.
 *   - Values using CSS custom properties (`var(--foo)`) cannot be resolved
 *     statically and are skipped.
 *   - When the same class appears in multiple rules, the first encountered
 *     value for each property wins (cascading specificity is not simulated).
 */

import * as fs from 'node:fs/promises';
import { parseCssColor } from './color-utils.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CssClassColors {
  /** Foreground text colour as an RGB triple. */
  color?: [number, number, number];
  /** Background colour as an RGB triple. */
  backgroundColor?: [number, number, number];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Strip block comments (/* … *​/) from CSS content, preserving line structure
 * by replacing matched content with spaces.
 */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

/**
 * Parse the declaration block of a single CSS rule and return color values.
 *
 * Splits on semicolons so that property names like `background-color` are not
 * accidentally matched by a substring search for `color`.
 */
function parseDeclarations(declarations: string): CssClassColors {
  const result: CssClassColors = {};

  for (const rawDecl of declarations.split(';')) {
    const colonIdx = rawDecl.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = rawDecl.slice(0, colonIdx).trim().toLowerCase();
    const val  = rawDecl.slice(colonIdx + 1).trim();

    if (prop === 'color' && !result.color) {
      const parsed = parseCssColor(val);
      if (parsed) result.color = parsed;
    } else if ((prop === 'background-color' || prop === 'background') && !result.backgroundColor) {
      // For the `background` shorthand we iterate space-separated tokens and
      // use the first one that parses as a CSS colour.  This handles the common
      // pattern `background: #hex` and `background: rgba(…)` while gracefully
      // skipping complex values like `background: url(…) center/cover no-repeat`.
      const tokens = prop === 'background-color' ? [val] : val.split(/\s+/);
      for (const token of tokens) {
        if (token.startsWith('url(')) continue; // skip image values
        const parsed = parseCssColor(token);
        if (parsed) {
          result.backgroundColor = parsed;
          break;
        }
      }
    }
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read all provided CSS files and return a map of
 *   `className` → `{ color?, backgroundColor? }`
 *
 * Only classes that define at least one of the two colour properties are
 * included.  When the same class name appears in multiple rules across
 * different files, the first definition encountered is used.
 *
 * @param cssFilePaths Absolute paths to CSS files to parse.
 */
export async function buildCssColorMap(
  cssFilePaths: string[],
): Promise<Map<string, CssClassColors>> {
  const map = new Map<string, CssClassColors>();

  for (const filePath of cssFilePaths) {
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      // Unreadable file — skip silently
      continue;
    }

    const stripped = stripCssComments(content);

    // Match simple `.className { declarations }` blocks.
    // The class name regex allows letters, digits, hyphens, and underscores
    // but must start with a letter (CSS spec).
    // We stop the declaration capture at the first `}` to avoid runaway matches.
    const ruleRe = /\.([a-zA-Z][\w-]*)\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;

    while ((m = ruleRe.exec(stripped)) !== null) {
      const className   = m[1];
      const declarations = m[2];

      // Skip if this class was already resolved from an earlier file / rule
      if (map.has(className)) continue;

      const colors = parseDeclarations(declarations);
      if (colors.color !== undefined || colors.backgroundColor !== undefined) {
        map.set(className, colors);
      }
    }
  }

  return map;
}
