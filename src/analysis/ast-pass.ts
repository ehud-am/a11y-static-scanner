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
import { parseCssColor, wcagContrastRatio } from './color-utils.js';
import type { CssClassColors } from './css-pass.js';

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

/**
 * Extract static class names from a JSX element's className attribute.
 * Handles:
 *   className="foo bar"          → ['foo', 'bar']
 *   className={"foo bar"}        → ['foo', 'bar']
 * Returns an empty array when the value is dynamic (template literal, variable).
 */
function extractClassNames(node: JSXOpeningElement): string[] {
  const classAttr = node.attributes.find(
    (a): a is JSXAttribute =>
      a.type === 'JSXAttribute' &&
      a.name.type === 'JSXIdentifier' &&
      a.name.name === 'className',
  );
  if (!classAttr) return [];

  let classString: string | null = null;
  if (classAttr.value?.type === 'StringLiteral') {
    classString = classAttr.value.value;
  } else if (classAttr.value?.type === 'JSXExpressionContainer') {
    const expr = classAttr.value.expression;
    if (expr.type === 'StringLiteral') classString = expr.value;
  }

  if (!classString) return [];
  return classString.split(/\s+/).filter(Boolean);
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

/**
 * Run the Babel AST accessibility pass against a single JSX/TSX/JS/TS file.
 *
 * @param filePath     Absolute path to the source file.
 * @param fileContent  Source content of the file.
 * @param repoRoot     Absolute path to the repository root (used for relative
 *                     paths in issue objects).
 * @param cssColorMap  Optional map of CSS class names to their colour values,
 *                     built from the project's CSS files by `buildCssColorMap`.
 *                     When provided, elements styled via CSS classes are also
 *                     checked for contrast violations (WCAG 1.4.3).
 */
export async function runAstPass(
  filePath: string,
  fileContent: string,
  repoRoot: string,
  cssColorMap?: Map<string, CssClassColors>,
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

  /**
   * CSS class names already flagged for a contrast issue in this file.
   * Prevents the same class from generating one issue per element when it is
   * used on multiple elements — the class definition is the root cause, so a
   * single report per file is sufficient.
   */
  const flaggedContrastClasses = new Set<string>();

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

      // ── Check NEW-A: <img> alt attribute — missing or non-descriptive ────────
      if (tagName === 'img') {
        const alt = getAttrValue(opening, 'alt');

        if (alt === null) {
          // Alt attribute is completely absent.
          // This is a fallback for cases where the ESLint jsx-a11y/alt-text pass
          // misses the element (e.g. unusual JSX patterns). The dedup pair
          // ['jsx-a11y/alt-text', 'custom/img-missing-alt'] in engine.ts ensures
          // only one issue is reported when both passes fire on the same line.
          const issue = makeIssue(
            'custom/img-missing-alt',
            '<img> is missing an alt attribute. Add alt="" for purely decorative images, or a concise description of the image for informative ones (WCAG 1.1.1).',
            relPath, line, column, fileContent,
          );
          if (issue) issues.push(issue);
        } else if (typeof alt === 'string' && alt.trim() !== '') {
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
                textColor = parseCssColor(p.value.value);
              } else if (keyName === 'backgroundColor') {
                bgColor = parseCssColor(p.value.value);
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

      // ── Check 4b: CSS class-based colour contrast ─────────────────────────
      // Only runs when the caller has provided a CSS colour map built from the
      // project's stylesheets.  We inspect every static class name on this
      // element; the first failing class produces one issue (avoids noise when
      // multiple classes share the same problematic colour).
      if (cssColorMap && cssColorMap.size > 0) {
        const classNames = extractClassNames(opening);
        const WHITE: [number, number, number] = [255, 255, 255];

        for (const cls of classNames) {
          const cssColors = cssColorMap.get(cls);
          if (cssColors?.color) {
            const effectiveBg = cssColors.backgroundColor ?? WHITE;
            const ratio = wcagContrastRatio(cssColors.color, effectiveBg);
            if (ratio < 4.5) {
              // Skip colours that are clearly too light to be placed on a white
              // background — a very low ratio (< 2.0) against white strongly
              // suggests the colour is intended for a dark background that the
              // static CSS parser could not resolve (e.g. inherited from a parent
              // or set via a compound selector).  Reporting these would produce
              // a large number of false positives.
              if (!cssColors.backgroundColor && ratio < 2.0) continue;

              // Each distinct CSS class name should produce at most ONE issue
              // per file, even if the class is applied to several elements.
              // The root cause is the class definition, not each individual use.
              if (flaggedContrastClasses.has(cls)) continue;
              flaggedContrastClasses.add(cls);

              const bgNote = cssColors.backgroundColor
                ? ''
                : ' (assuming white background)';
              const issue = makeIssue(
                'custom/css-class-low-contrast',
                `CSS class ".${cls}" has insufficient colour contrast ratio of ${ratio.toFixed(2)}:1${bgNote} (minimum 4.5:1 for normal text, WCAG 1.4.3).`,
                relPath, line, column, fileContent,
              );
              if (issue) issues.push(issue);
              break; // one issue per element is enough
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
