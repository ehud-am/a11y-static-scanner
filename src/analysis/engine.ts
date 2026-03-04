import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Issue } from '../types.js';
import { runEslintPass } from './eslint-pass.js';
import { runAstPass } from './ast-pass.js';
import { runHtmlPass } from './html-pass.js';
import { discoverHtmlFiles } from '../discovery/file-discoverer.js';
import { getRuleMapping } from './wcag-map.js';

const CONCURRENCY = 10;

// ─── Skip-link detection ───────────────────────────────────────────────────────
// We only use href-based patterns because free-text phrases like
// "skip to main content" frequently appear in string labels and comments,
// causing false negatives (thinking a skip link exists when it doesn't).
const SKIP_LINK_PATTERNS: RegExp[] = [
  // JSX attribute:  href="#main-content"  or  href={'#main'}
  /href\s*=\s*[{"']#(main|content|maincontent|main-content|skip|skipnav|skip-nav|primary|primary-content)[}'"][\s\S]{0,3}[/>]/i,
  // Plain HTML attribute: href="#main"
  /href\s*=\s*["']#(main|content|maincontent|main-content|skip|skipnav|skip-nav|primary|primary-content)["']/i,
];

/**
 * Strip block comments (/* … *​/) and line comments (// …) so that skip-link
 * patterns inside commented-out example code don't cause false negatives.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // block comments
    .replace(/\/\/[^\n]*/g, '');         // line comments
}

/**
 * Replace string literal contents with empty quotes so that patterns like
 * `<nav>` inside a label string (e.g. `label: '<div> used instead of <nav>'`)
 * don't produce false landmark positives.
 */
function stripStringLiterals(src: string): string {
  return src
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function containsSkipLink(content: string): boolean {
  const stripped = stripComments(content);
  return SKIP_LINK_PATTERNS.some((re) => re.test(stripped));
}

/**
 * Pick the most meaningful file to attach the skip-link issue to:
 * prefer App.tsx/App.jsx, then index/main entry points, then the first file.
 */
function bestAnchorFile(filePaths: string[], repoRoot: string): string {
  const priority = [
    'App.tsx', 'App.jsx', 'App.ts', 'App.js',
    'index.tsx', 'index.jsx', 'main.tsx', 'main.jsx',
  ];
  for (const name of priority) {
    const found = filePaths.find(
      (fp) => fp.endsWith('/' + name) || fp.endsWith(path.sep + name),
    );
    if (found) {
      return found.startsWith(repoRoot + '/') ? found.slice(repoRoot.length + 1) : found;
    }
  }
  const first = filePaths[0];
  if (!first) return '(project root)';
  return first.startsWith(repoRoot + '/') ? first.slice(repoRoot.length + 1) : first;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.file}:${issue.line}:${issue.column}:${issue.rule_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Per-file analysis ────────────────────────────────────────────────────────

async function analyzeReactFile(
  filePath: string,
  repoRoot: string,
): Promise<Issue[]> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`[a11y-static-scanner] Could not read file ${filePath}: ${err}\n`);
    return [];
  }

  try {
    const [eslintIssues, astIssues] = await Promise.all([
      runEslintPass(filePath, content, repoRoot),
      runAstPass(filePath, content, repoRoot),
    ]);
    return deduplicateIssues([...eslintIssues, ...astIssues]);
  } catch (err) {
    process.stderr.write(`[a11y-static-scanner] Error analysing ${filePath}: ${err}\n`);
    return [];
  }
}

async function analyzeHtmlFile(
  filePath: string,
  repoRoot: string,
): Promise<Issue[]> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    process.stderr.write(`[a11y-static-scanner] Could not read HTML file ${filePath}: ${err}\n`);
    return [];
  }

  try {
    return runHtmlPass(filePath, content, repoRoot);
  } catch (err) {
    process.stderr.write(`[a11y-static-scanner] Error analysing HTML file ${filePath}: ${err}\n`);
    return [];
  }
}

// ─── App-level: skip-link check ───────────────────────────────────────────────

async function checkSkipLink(
  allFilePaths: string[],
  repoRoot: string,
): Promise<Issue[]> {
  // Quick content scan — no parsing needed, just regex
  for (const filePath of allFilePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      if (containsSkipLink(content)) return []; // found — no issue
    } catch {
      // unreadable file: skip
    }
  }

  // No skip link found anywhere in the project
  const mapping = getRuleMapping('custom/skip-link-missing');
  if (!mapping) return [];

  const anchorFile = bestAnchorFile(
    allFilePaths.filter((fp) => /\.(jsx?|tsx?)$/.test(fp)),
    repoRoot,
  );

  return [
    {
      id: uuidv4(),
      file: anchorFile,
      line: 1,
      column: 1,
      rule_id: 'custom/skip-link-missing',
      wcag_criterion: mapping.criterion,
      wcag_level: mapping.level,
      severity: mapping.severity,
      message:
        'No "skip to main content" link was found. Add a visually-hidden skip link as the first focusable element so keyboard users can bypass repeated navigation blocks (WCAG 2.4.1).',
      code_snippet: '',
      wcag_title: mapping.title,
      wcag_url: mapping.url,
    },
  ];
}

// ─── App-level: landmark checks ───────────────────────────────────────────────

/**
 * Verify that the project contains at least one <main> and one <nav> landmark.
 * Scans all React and HTML source files with comment-stripping to avoid
 * flagging landmarks mentioned only inside code comments.
 */
async function checkLandmarks(
  allFilePaths: string[],
  repoRoot: string,
): Promise<Issue[]> {
  let hasMain = false;
  let hasNav = false;

  for (const filePath of allFilePaths) {
    if (hasMain && hasNav) break;
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      // Strip comments first, then string literals, so that patterns like
      // `<nav>` inside a label string don't produce false positives.
      const stripped = stripStringLiterals(stripComments(content));
      // Match <main> / <main ... /> and <nav> / <nav ... /> but not
      // custom components like <MainContent> or <Navigate>.
      if (!hasMain && /<main[\s/>]/i.test(stripped)) hasMain = true;
      if (!hasNav && /<nav[\s/>]/i.test(stripped)) hasNav = true;
    } catch {
      // unreadable file: skip
    }
  }

  const issues: Issue[] = [];
  const anchorFile = bestAnchorFile(
    allFilePaths.filter((fp) => /\.(jsx?|tsx?)$/.test(fp)),
    repoRoot,
  );

  if (!hasMain) {
    const mapping = getRuleMapping('custom/missing-main-landmark');
    if (mapping) {
      issues.push({
        id: uuidv4(),
        file: anchorFile,
        line: 1,
        column: 1,
        rule_id: 'custom/missing-main-landmark',
        wcag_criterion: mapping.criterion,
        wcag_level: mapping.level,
        severity: mapping.severity,
        message:
          'No <main> landmark element was found. Add a <main> element to identify the primary content region so screen-reader users can navigate directly to it (WCAG 1.3.1).',
        code_snippet: '',
        wcag_title: mapping.title,
        wcag_url: mapping.url,
      });
    }
  }

  if (!hasNav) {
    const mapping = getRuleMapping('custom/missing-nav-landmark');
    if (mapping) {
      issues.push({
        id: uuidv4(),
        file: anchorFile,
        line: 1,
        column: 1,
        rule_id: 'custom/missing-nav-landmark',
        wcag_criterion: mapping.criterion,
        wcag_level: mapping.level,
        severity: mapping.severity,
        message:
          'No <nav> landmark element was found. Add a <nav> element (or role="navigation") to identify navigation regions so screen-reader users can navigate directly to them (WCAG 1.3.1).',
        code_snippet: '',
        wcag_title: mapping.title,
        wcag_url: mapping.url,
      });
    }
  }

  return issues;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeFiles(
  reactFilePaths: string[],
  repoRoot: string,
): Promise<Issue[]> {
  const allIssues: Issue[] = [];

  // 1. Analyse React/JSX/TSX files (ESLint + Babel AST)
  for (let i = 0; i < reactFilePaths.length; i += CONCURRENCY) {
    const chunk = reactFilePaths.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((fp) => analyzeReactFile(fp, repoRoot)),
    );
    for (const issues of chunkResults) allIssues.push(...issues);
  }

  // 2. Discover and analyse HTML files
  const htmlFilePaths = await discoverHtmlFiles(repoRoot);
  for (let i = 0; i < htmlFilePaths.length; i += CONCURRENCY) {
    const chunk = htmlFilePaths.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((fp) => analyzeHtmlFile(fp, repoRoot)),
    );
    for (const issues of chunkResults) allIssues.push(...issues);
  }

  // 3. App-level check: skip-to-main link (scans all React + HTML files)
  const skipIssues = await checkSkipLink(
    [...reactFilePaths, ...htmlFilePaths],
    repoRoot,
  );
  allIssues.push(...skipIssues);

  // 4. App-level check: <main> and <nav> landmark elements
  const landmarkIssues = await checkLandmarks(
    [...reactFilePaths, ...htmlFilePaths],
    repoRoot,
  );
  allIssues.push(...landmarkIssues);

  return allIssues;
}
