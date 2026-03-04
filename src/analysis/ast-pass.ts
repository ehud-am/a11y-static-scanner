import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { TraverseOptions } from '@babel/traverse';
import type { Node, JSXOpeningElement, JSXAttribute, ObjectProperty, ObjectExpression, StringLiteral, NumericLiteral } from '@babel/types';

// @babel/traverse is CJS; its module.exports is a namespace object with the
// actual traverse function at .default. Handle both shapes for safety.
const traverse = ((_traverse as any).default ?? _traverse) as unknown as (ast: Node, opts: TraverseOptions) => void;
import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../types.js';
import { getRuleMapping } from './wcag-map.js';

// ─── Colour contrast helpers ───────────────────────────────────────────────────

/** Convert a 3- or 6-digit hex colour to RGB. */
function hexToRgb(hex: string): [number, number, number] | null {
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
const NAMED_COLORS: Record<string, [number, number, number]> = {
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

/** Parse a CSS colour string (hex / rgb() / rgba() / named) to [R, G, B]. */
function parseInlineColor(value: string): [number, number, number] | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent' || v === 'inherit' || v === 'currentcolor') return null;
  if (v.startsWith('#')) return hexToRgb(v);
  const rgbMatch = v.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return [+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]];
  return NAMED_COLORS[v] ?? null;
}

function srgbLinearise(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbLinearise(r) + 0.7152 * srgbLinearise(g) + 0.0722 * srgbLinearise(b);
}

function wcagContrastRatio(
  c1: [number, number, number],
  c2: [number, number, number],
): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSnippet(content: string, line: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, line - 2);
  const end = Math.min(lines.length, line + 1);
  return lines.slice(start, end).join('\n');
}

function makeIssue(
  ruleId: string,
  message: string,
  file: string,
  line: number,
  column: number,
  content: string,
): Issue | null {
  const mapping = getRuleMapping(ruleId);
  if (!mapping) return null;
  return {
    id: uuidv4(),
    file,
    line,
    column,
    rule_id: ruleId,
    wcag_criterion: mapping.criterion,
    wcag_level: mapping.level,
    severity: mapping.severity,
    message,
    code_snippet: extractSnippet(content, line),
    wcag_title: mapping.title,
    wcag_url: mapping.url,
  };
}

function getAttrValue(node: JSXOpeningElement, name: string): string | boolean | null {
  for (const attr of node.attributes) {
    if (attr.type !== 'JSXAttribute') continue;
    if (attr.name.type === 'JSXIdentifier' && attr.name.name === name) {
      if (attr.value === null) return true; // boolean attr
      if (attr.value?.type === 'StringLiteral') return attr.value.value;
      if (attr.value?.type === 'JSXExpressionContainer') {
        const expr = attr.value.expression;
        if (expr.type === 'StringLiteral') return expr.value;
        if (expr.type === 'BooleanLiteral') return expr.value;
        if (expr.type === 'NumericLiteral') return String(expr.value);
      }
      return true;
    }
  }
  return null;
}

function hasAttr(node: JSXOpeningElement, name: string): boolean {
  return getAttrValue(node, name) !== null;
}

function getElementName(node: JSXOpeningElement): string | null {
  if (node.name.type === 'JSXIdentifier') return node.name.name;
  if (node.name.type === 'JSXMemberExpression') return null; // e.g. Foo.Bar
  return null;
}

const NON_INTERACTIVE_ELEMENTS = new Set([
  'div', 'span', 'p', 'section', 'article', 'header', 'footer',
  'main', 'aside', 'li', 'ul', 'ol', 'dd', 'dt', 'figure',
  'figcaption', 'details', 'summary', 'blockquote', 'pre', 'code',
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch',
  'option', 'gridcell', 'columnheader', 'rowheader', 'combobox',
  'listbox', 'menu', 'menubar', 'radiogroup', 'tablist', 'tree',
  'treegrid', 'treeitem', 'searchbox', 'spinbutton', 'slider',
]);

const KEYBOARD_EVENTS = new Set([
  'onKeyDown', 'onKeyPress', 'onKeyUp',
]);

/** Alt text values that convey no meaningful information. */
const NONDESCRIPTIVE_ALT = new Set([
  'img', 'image', 'photo', 'photograph', 'picture', 'pic',
  'icon', 'logo', 'banner', 'thumbnail', 'thumb',
  'graphic', 'figure', 'avatar', 'profile',
]);

/** Link text that fails WCAG 2.4.4 on its own. */
const GENERIC_LINK_TEXT = new Set([
  'click here', 'click', 'here', 'read more', 'more', 'learn more',
  'more info', 'more information', 'details', 'link', 'this link',
  'this', 'continue', 'tap here', 'press here', 'go', 'start',
]);

/** Class names suggesting a modal/dialog widget. */
const MODAL_CLASS_RE = /\b(modal|dialog|overlay|lightbox|popup|popover)\b/i;

/**
 * Matches strings that consist solely of emoji (Emoji_Presentation category)
 * and/or whitespace. Used to detect icon-only buttons/links.
 */
const EMOJI_ONLY_RE = /^[\p{Emoji_Presentation}\s]+$/u;

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runAstPass(
  filePath: string,
  fileContent: string,
  repoRoot: string,
): Promise<Issue[]> {
  const relPath = filePath.startsWith(repoRoot + '/')
    ? filePath.slice(repoRoot.length + 1)
    : filePath;

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(fileContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    return [];
  }

  const issues: Issue[] = [];

  /** Heading elements collected during traversal for level-skip analysis. */
  const headingElements: Array<{ level: number; line: number; column: number }> = [];

  traverse(ast, {
    JSXElement(path) {
      const opening = path.node.openingElement;
      const tagName = getElementName(opening);
      if (!tagName) return;

      const line = opening.loc?.start.line ?? 1;
      const column = opening.loc?.start.column ?? 0;

      // ── Check 1: <svg> missing accessible name ──────────────────────────────
      if (tagName === 'svg') {
        const hasAriaLabel = hasAttr(opening, 'aria-label');
        const hasAriaLabelledby = hasAttr(opening, 'aria-labelledby');
        const hasRoleImg = getAttrValue(opening, 'role') === 'img';

        // Check for child <title> element
        const hasChildTitle = path.node.children.some(
          (child) =>
            child.type === 'JSXElement' &&
            child.openingElement.name.type === 'JSXIdentifier' &&
            child.openingElement.name.name === 'title',
        );

        // Decorative SVGs with aria-hidden are fine
        const isHidden = getAttrValue(opening, 'aria-hidden');
        if (isHidden === 'true' || isHidden === true) return;

        if (!hasAriaLabel && !hasAriaLabelledby && !(hasRoleImg && hasChildTitle) && !hasChildTitle) {
          const issue = makeIssue(
            'custom/svg-missing-accessible-name',
            'SVG element is missing an accessible name. Add aria-label, aria-labelledby, or a <title> child element. If decorative, add aria-hidden="true".',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }
        return;
      }

      // ── Check 2: <table> missing <caption> ────────────────────────────────
      if (tagName === 'table') {
        const hasCaption = path.node.children.some(
          (child) =>
            child.type === 'JSXElement' &&
            child.openingElement.name.type === 'JSXIdentifier' &&
            child.openingElement.name.name === 'caption',
        );
        const hasAriaLabel = hasAttr(opening, 'aria-label');
        const hasAriaLabelledby = hasAttr(opening, 'aria-labelledby');

        if (!hasCaption && !hasAriaLabel && !hasAriaLabelledby) {
          const issue = makeIssue(
            'custom/table-missing-caption',
            'Table is missing a <caption> element or aria-label/aria-labelledby attribute to describe its purpose.',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }
        return;
      }

      // ── Check NEW-A: <img> non-descriptive alt text ─────────────────────────
      if (tagName === 'img') {
        const alt = getAttrValue(opening, 'alt');
        if (typeof alt === 'string' && alt.trim() !== '') {
          const altLower = alt.trim().toLowerCase();
          if (NONDESCRIPTIVE_ALT.has(altLower)) {
            const issue = makeIssue(
              'custom/nondescriptive-alt-text',
              `<img> has a non-descriptive alt="${alt}". Replace with a concise, meaningful description of the image content (WCAG 1.1.1).`,
              relPath, line, column, fileContent,
            );
            if (issue) issues.push(issue);
          }
        }
        return; // images never need style / keyboard checks
      }

      // ── Check NEW-B: <th> missing scope ────────────────────────────────────
      if (tagName === 'th') {
        if (!hasAttr(opening, 'scope')) {
          const issue = makeIssue(
            'custom/th-missing-scope',
            '<th> is missing a scope attribute. Add scope="col" or scope="row" to associate header cells with data cells for screen readers (WCAG 1.3.1).',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }
        // fall through — no early return needed
      }

      // ── Check NEW-C: <video> autoPlay without muted / missing controls ──────
      if (tagName === 'video') {
        const hasAutoPlay = hasAttr(opening, 'autoPlay') || hasAttr(opening, 'autoplay');
        const hasControls = hasAttr(opening, 'controls');

        if (hasAutoPlay) {
          const issue = makeIssue(
            'custom/video-autoplay',
            '<video> has autoPlay. Auto-playing media starts without user consent, which can distract, disorient, or block audio for screen-reader users (WCAG 2.2.2). Remove autoPlay or provide a prominent pause control.',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }

        if (!hasControls) {
          const issue = makeIssue(
            'custom/video-missing-controls',
            '<video> is missing the controls attribute. Users need playback controls to pause, stop, or adjust volume (WCAG 1.2.1).',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }
        return; // video never needs style / keyboard checks
      }

      // ── Check NEW-D: collect heading elements for level-skip analysis ────────
      const headingMatch = tagName.match(/^h([1-6])$/);
      if (headingMatch) {
        headingElements.push({ level: parseInt(headingMatch[1], 10), line, column });
      }

      // ── Check 3: Non-interactive element with onClick but no keyboard ───────
      // Note: we do NOT early-return here so Checks 4-6 still run on these
      // elements (e.g. <p style={{color:'#ccc'}}> needs the contrast check).
      if (NON_INTERACTIVE_ELEMENTS.has(tagName)) {
        const hasOnClick = hasAttr(opening, 'onClick');
        if (hasOnClick) {
          const role = getAttrValue(opening, 'role');
          if (!(typeof role === 'string' && INTERACTIVE_ROLES.has(role))) {
            const hasKeyboardHandler = [...KEYBOARD_EVENTS].some((e) => hasAttr(opening, e));
            if (!hasKeyboardHandler) {
              const issue = makeIssue(
                'custom/onclick-without-keyboard',
                `<${tagName}> has an onClick handler but no keyboard event handler (onKeyDown, onKeyPress, or onKeyUp). Add a keyboard handler or use a native interactive element like <button>.`,
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
            }
          }
        }
        // fall through — Checks 4, 5, 6 apply to all element types
      }

      // ── Check NEW-E: <input>/<textarea> missing accessible label ────────────
      if (tagName === 'input' || tagName === 'textarea') {
        const inputType = getAttrValue(opening, 'type');
        if (inputType !== 'hidden') {
          const hasId = hasAttr(opening, 'id');
          const hasAriaLabel = hasAttr(opening, 'aria-label');
          const hasAriaLabelledby = hasAttr(opening, 'aria-labelledby');
          const hasTitle = hasAttr(opening, 'title');
          if (!hasId && !hasAriaLabel && !hasAriaLabelledby && !hasTitle) {
            const issue = makeIssue(
              'custom/input-missing-label',
              `<${tagName}> is missing an accessible label. Add aria-label, aria-labelledby, a title, or an id paired with a <label> element (WCAG 3.3.2).`,
              relPath, line, column, fileContent,
            );
            if (issue) issues.push(issue);
          }
        }
        // fall through — inputs can have style checks too
      }

      // ── Check NEW-F: <div> with modal-like class but no role="dialog" ────────
      if (tagName === 'div') {
        const divRole = getAttrValue(opening, 'role');
        if (divRole !== 'dialog' && divRole !== 'alertdialog') {
          const classValue = getAttrValue(opening, 'className');
          if (typeof classValue === 'string' && MODAL_CLASS_RE.test(classValue)) {
            const issue = makeIssue(
              'custom/missing-dialog-role',
              `<div className="${classValue}"> appears to be a modal/dialog but is missing role="dialog". Add role="dialog", aria-modal="true", and an accessible label via aria-label or aria-labelledby (WCAG 4.1.2).`,
              relPath, line, column, fileContent,
            );
            if (issue) issues.push(issue);
          }
        }
        // fall through — div can also trigger style / onclick checks
      }

      // ── Check 4: inline style — outline:none/0 + colour contrast ─────────────
      const styleAttr = opening.attributes.find(
        (a): a is JSXAttribute =>
          a.type === 'JSXAttribute' &&
          a.name.type === 'JSXIdentifier' &&
          a.name.name === 'style',
      );
      if (styleAttr?.value?.type === 'JSXExpressionContainer') {
        const expr = styleAttr.value.expression;
        if (expr.type === 'ObjectExpression') {
          let hasBadOutline = false;
          let textColor: [number, number, number] | null = null;
          let bgColor: [number, number, number] | null = null;

          for (const prop of (expr as ObjectExpression).properties) {
            if (prop.type !== 'ObjectProperty') continue;
            const p = prop as ObjectProperty;
            const keyName =
              p.key.type === 'Identifier'
                ? p.key.name
                : p.key.type === 'StringLiteral'
                ? p.key.value
                : '';

            // outline check
            if (keyName === 'outline') {
              const val = p.value as StringLiteral | NumericLiteral;
              if (
                (val.type === 'StringLiteral' && (val.value === 'none' || val.value === '0')) ||
                (val.type === 'NumericLiteral' && val.value === 0)
              ) {
                hasBadOutline = true;
              }
            }

            // colour contrast — only checkable when value is a static string literal
            if (p.value.type === 'StringLiteral') {
              if (keyName === 'color') {
                textColor = parseInlineColor(p.value.value);
              } else if (keyName === 'backgroundColor') {
                bgColor = parseInlineColor(p.value.value);
              }
            }
          }

          if (hasBadOutline) {
            const issue = makeIssue(
              'custom/focus-outline-removed',
              'Inline style removes the focus outline (outline: none/0). This prevents keyboard users from seeing the focused element. Use a custom visible focus style instead.',
              relPath, line, column, fileContent,
            );
            if (issue) issues.push(issue);
          }

          // Colour contrast — when text colour is set, fall back to white if no
          // explicit backgroundColor is found (white is the browser default).
          const WHITE: [number, number, number] = [255, 255, 255];
          if (textColor) {
            const effectiveBg = bgColor ?? WHITE;
            const ratio = wcagContrastRatio(textColor, effectiveBg);
            if (ratio < 4.5) {
              const bgNote = bgColor ? '' : ' (assuming white background)';
              const issue = makeIssue(
                'custom/low-color-contrast',
                `Inline style has insufficient colour contrast ratio of ${ratio.toFixed(2)}:1${bgNote} (minimum required: 4.5:1 for normal text, WCAG 1.4.3).`,
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
            }
          }
        }
      }

      // ── Check 5: role="button" without keyboard handler ──────────────────
      const roleValue = getAttrValue(opening, 'role');

      // ── Check 6: <a target="_blank"> without warning ──────────────────────
      if (tagName === 'a') {
        // 6a. target="_blank" without new-tab warning
        const target = getAttrValue(opening, 'target');
        if (target === '_blank') {
          const ariaLabel = getAttrValue(opening, 'aria-label');
          const titleAttr = getAttrValue(opening, 'title');
          const NEW_TAB_RE = /new.?tab|new.?window|opens in/i;

          const hasAttrWarning =
            (typeof ariaLabel === 'string' && NEW_TAB_RE.test(ariaLabel)) ||
            (typeof titleAttr === 'string' && NEW_TAB_RE.test(titleAttr));

          if (!hasAttrWarning) {
            const hasChildWarning = path.node.children.some(
              (child) =>
                child.type === 'JSXText' &&
                NEW_TAB_RE.test((child as { value: string }).value),
            );
            if (!hasChildWarning) {
              const issue = makeIssue(
                'custom/new-tab-no-warning',
                '<a target="_blank"> opens a new tab without warning the user. Add aria-label or visible text such as "(opens in new tab)" so users are not surprised by the context change (WCAG 3.2.2).',
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
            }
          }
        }

        // 6b. Generic link text (only when there is no overriding accessible name)
        if (!hasAttr(opening, 'aria-label') && !hasAttr(opening, 'aria-labelledby')) {
          const linkText = path.node.children
            .filter((child) => child.type === 'JSXText')
            .map((child) => (child as { value: string }).value.trim())
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (linkText && GENERIC_LINK_TEXT.has(linkText)) {
            const issue = makeIssue(
              'custom/generic-link-text',
              `<a> has generic link text "${linkText}". Use descriptive text that conveys the link's purpose without relying on surrounding context (WCAG 2.4.4).`,
              relPath, line, column, fileContent,
            );
            if (issue) issues.push(issue);
          }
        }

        // 6c. Icon/emoji-only link with no accessible label
        if (
          !hasAttr(opening, 'aria-label') &&
          !hasAttr(opening, 'aria-labelledby') &&
          !hasAttr(opening, 'title')
        ) {
          const nonWsText = path.node.children.filter(
            (child) => child.type === 'JSXText' &&
              (child as { value: string }).value.trim().length > 0,
          );
          // Only flag if there are no nested elements (avoids false positives on
          // links like <a>🔍 <span className="sr-only">Search</span></a>)
          const hasNoNestedEl = !path.node.children.some((c) => c.type === 'JSXElement');
          if (hasNoNestedEl && nonWsText.length > 0) {
            const allEmoji = nonWsText.every((child) =>
              EMOJI_ONLY_RE.test((child as { value: string }).value.trim()),
            );
            if (allEmoji) {
              const issue = makeIssue(
                'custom/icon-button-no-label',
                '<a> contains only emoji/icon content with no accessible label. Add aria-label, aria-labelledby, or title to describe the link\'s purpose (WCAG 4.1.2).',
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
            }
          }
        }
      }

      // ── Check 7: role="button" without keyboard handler ──────────────────────
      if (roleValue === 'button') {
        const hasKeyboard = [...KEYBOARD_EVENTS, 'tabIndex'].some((e) => hasAttr(opening, e));
        if (!hasKeyboard) {
          const issue = makeIssue(
            'custom/role-button-no-keyboard',
            `Element with role="button" is missing keyboard event handlers (onKeyDown/onKeyPress/onKeyUp) and/or tabIndex. Button roles must be keyboard operable.`,
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        }
      }

      // ── Check NEW-G: <button> icon/emoji-only with no accessible label ───────
      if (tagName === 'button') {
        if (
          !hasAttr(opening, 'aria-label') &&
          !hasAttr(opening, 'aria-labelledby') &&
          !hasAttr(opening, 'title')
        ) {
          const nonWsText = path.node.children.filter(
            (child) => child.type === 'JSXText' &&
              (child as { value: string }).value.trim().length > 0,
          );
          const hasNoNestedEl = !path.node.children.some((c) => c.type === 'JSXElement');
          if (hasNoNestedEl && nonWsText.length > 0) {
            const allEmoji = nonWsText.every((child) =>
              EMOJI_ONLY_RE.test((child as { value: string }).value.trim()),
            );
            if (allEmoji) {
              const issue = makeIssue(
                'custom/icon-button-no-label',
                "<button> contains only emoji/icon content with no accessible label. Add aria-label, aria-labelledby, or title to describe the button's purpose (WCAG 4.1.2).",
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
            }
          }
        }
      }
    },
  });

  // ── Post-traverse: heading level skip check ──────────────────────────────────
  for (let i = 1; i < headingElements.length; i++) {
    const prev = headingElements[i - 1];
    const curr = headingElements[i];
    if (curr.level > prev.level + 1) {
      const issue = makeIssue(
        'custom/heading-level-skip',
        `Heading level skips from <h${prev.level}> to <h${curr.level}>. Heading levels should increase by one at a time to convey proper document structure (WCAG 1.3.1).`,
        relPath, curr.line, curr.column, fileContent,
      );
      if (issue) issues.push(issue);
    }
  }

  return issues;
}
