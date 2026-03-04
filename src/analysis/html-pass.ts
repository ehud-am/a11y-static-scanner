import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../types.js';
import { getRuleMapping } from './wcag-map.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIssue(
  ruleId: string,
  message: string,
  file: string,
  line: number,
  snippet: string,
): Issue | null {
  const mapping = getRuleMapping(ruleId);
  if (!mapping) return null;
  return {
    id: uuidv4(),
    file,
    line,
    column: 1,
    rule_id: ruleId,
    wcag_criterion: mapping.criterion,
    wcag_level: mapping.level,
    severity: mapping.severity,
    message,
    code_snippet: snippet,
    wcag_title: mapping.title,
    wcag_url: mapping.url,
  };
}

/** 1-based line number for the character at `charIndex` in `content`. */
function lineAt(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split('\n').length;
}

function snippet(lines: string[], lineNumber: number): string {
  return lines.slice(Math.max(0, lineNumber - 2), lineNumber + 1).join('\n');
}

// Page titles that are generic / auto-generated and give no information to the user.
const GENERIC_TITLES = new Set([
  '',
  'app',
  'cra',
  'create react app',
  'document',
  'index',
  'my app',
  'my react app',
  'next.js app',
  'parcel app',
  'react app',
  'snowpack app',
  'untitled',
  'vite app',
  'web app',
  'webpack app',
  'website',
  'home',
  'page',
]);

/**
 * Strip HTML comments (<!-- … -->) so that example code inside comments
 * doesn't confuse the checks (e.g. a `<title>` mentioned in a comment
 * should not count as the real page title).
 * Line positions are preserved by replacing matched content with spaces.
 */
function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function runHtmlPass(
  filePath: string,
  content: string,
  repoRoot: string,
): Issue[] {
  const relPath = filePath.startsWith(repoRoot + '/')
    ? filePath.slice(repoRoot.length + 1)
    : filePath;

  // Use a comment-stripped copy for pattern matching so that example markup
  // inside HTML comments is not mistaken for real elements.
  const stripped = stripHtmlComments(content);
  const lines = content.split('\n');   // keep original lines for snippets
  const issues: Issue[] = [];

  // ── Check 1: <html> element missing lang attribute ────────────────────────
  const htmlTagMatch = stripped.match(/<html([^>]*)>/i);
  if (htmlTagMatch) {
    if (!/lang\s*=/i.test(htmlTagMatch[1])) {
      const ln = lineAt(stripped, htmlTagMatch.index ?? 0);
      const issue = makeIssue(
        'custom/missing-html-lang',
        'The <html> element is missing a lang attribute. Screen readers use this to select the correct language voice and pronunciation.',
        relPath,
        ln,
        snippet(lines, ln),
      );
      if (issue) issues.push(issue);
    }
  }

  // ── Check 2: <title> missing or non-descriptive ───────────────────────────
  const titleMatch = stripped.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) {
    const issue = makeIssue(
      'custom/missing-page-title',
      'The page is missing a <title> element. Every page must have a descriptive title so users can identify it (WCAG 2.4.2).',
      relPath,
      1,
      lines[0] ?? '',
    );
    if (issue) issues.push(issue);
  } else {
    const titleText = titleMatch[1].trim();
    if (GENERIC_TITLES.has(titleText.toLowerCase())) {
      const ln = lineAt(stripped, titleMatch.index ?? 0);
      const issue = makeIssue(
        'custom/nondescriptive-page-title',
        `Page title "${titleText}" is non-descriptive. Provide a title that describes the specific topic or purpose of the page (WCAG 2.4.2).`,
        relPath,
        ln,
        snippet(lines, ln),
      );
      if (issue) issues.push(issue);
    }
  }

  return issues;
}
