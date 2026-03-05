import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';
import { runEslintPass } from '../src/analysis/eslint-pass.js';
import { runAstPass } from '../src/analysis/ast-pass.js';
import { analyzeFiles } from '../src/analysis/engine.js';
import { buildCssColorMap } from '../src/analysis/css-pass.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

// ─── ESLint pass ──────────────────────────────────────────────────────────────

describe('runEslintPass', () => {
  it('finds no issues in good-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'good-component.tsx');
    const issues = await runEslintPass(filePath, await readFixture('good-component.tsx'), FIXTURES);
    // No critical/serious issues expected
    const serious = issues.filter((i) => i.severity === 'critical' || i.severity === 'serious');
    expect(serious).toHaveLength(0);
  });

  it('finds multiple issues in bad-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('flags missing alt text', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    const altIssue = issues.find((i) => i.rule_id === 'jsx-a11y/alt-text');
    expect(altIssue).toBeDefined();
    expect(altIssue!.wcag_criterion).toBe('1.1.1');
    expect(altIssue!.severity).toBe('critical');
  });

  it('flags positive tabIndex', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    const tabIssue = issues.find((i) => i.rule_id === 'jsx-a11y/tabindex-no-positive');
    expect(tabIssue).toBeDefined();
    expect(tabIssue!.wcag_criterion).toBe('2.4.3');
  });

  it('flags empty anchor', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    const anchorIssue = issues.find((i) => i.rule_id === 'jsx-a11y/anchor-has-content');
    expect(anchorIssue).toBeDefined();
  });

  it('flags missing label for input', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    const labelIssue = issues.find((i) => i.rule_id === 'jsx-a11y/label-has-associated-control');
    expect(labelIssue).toBeDefined();
  });

  it('returns empty array for unparseable content', async () => {
    const issues = await runEslintPass('/fake/path.tsx', '<<< this is not valid JSX <<<', '/fake');
    expect(issues).toEqual([]);
  });

  it('issue objects have all required fields', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runEslintPass(filePath, content, FIXTURES);
    for (const issue of issues) {
      expect(issue.id).toBeTruthy();
      expect(issue.file).toBeTruthy();
      expect(issue.line).toBeGreaterThan(0);
      expect(issue.rule_id).toBeTruthy();
      expect(issue.wcag_criterion).toBeTruthy();
      expect(['A', 'AA', 'AAA']).toContain(issue.wcag_level);
      expect(['critical', 'serious', 'moderate', 'minor']).toContain(issue.severity);
      expect(issue.message).toBeTruthy();
      expect(issue.wcag_title).toBeTruthy();
      expect(issue.wcag_url).toMatch(/^https:\/\//);
    }
  });
});

// ─── AST pass ─────────────────────────────────────────────────────────────────

describe('runAstPass', () => {
  it('finds no issues in good-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'good-component.tsx');
    const content = await readFixture('good-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const serious = issues.filter((i) => i.severity === 'critical' || i.severity === 'serious');
    expect(serious).toHaveLength(0);
  });

  it('flags SVG without accessible name in bad-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const svgIssue = issues.find((i) => i.rule_id === 'custom/svg-missing-accessible-name');
    expect(svgIssue).toBeDefined();
    expect(svgIssue!.wcag_criterion).toBe('1.1.1');
  });

  it('flags table without caption in bad-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const tableIssue = issues.find((i) => i.rule_id === 'custom/table-missing-caption');
    expect(tableIssue).toBeDefined();
  });

  it('flags div onClick without keyboard handler', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const kbIssue = issues.find((i) => i.rule_id === 'custom/onclick-without-keyboard');
    expect(kbIssue).toBeDefined();
    expect(kbIssue!.wcag_criterion).toBe('2.1.1');
    expect(kbIssue!.severity).toBe('critical');
  });

  it('flags inline outline:none', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const outlineIssue = issues.find((i) => i.rule_id === 'custom/focus-outline-removed');
    expect(outlineIssue).toBeDefined();
    expect(outlineIssue!.wcag_criterion).toBe('2.4.7');
  });

  it('flags role=button without keyboard handler', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const content = await readFixture('bad-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const roleIssue = issues.find((i) => i.rule_id === 'custom/role-button-no-keyboard');
    expect(roleIssue).toBeDefined();
  });

  it('does not flag aria-hidden SVG', async () => {
    const content = `
      import React from 'react';
      export const Icon = () => <svg aria-hidden="true" viewBox="0 0 24 24"><path /></svg>;
    `;
    const issues = await runAstPass('/tmp/Icon.tsx', content, '/tmp');
    const svgIssue = issues.find((i) => i.rule_id === 'custom/svg-missing-accessible-name');
    expect(svgIssue).toBeUndefined();
  });

  it('does not flag table with aria-label', async () => {
    const content = `
      import React from 'react';
      export const T = () => (
        <table aria-label="Results"><tbody><tr><td>x</td></tr></tbody></table>
      );
    `;
    const issues = await runAstPass('/tmp/T.tsx', content, '/tmp');
    const tableIssue = issues.find((i) => i.rule_id === 'custom/table-missing-caption');
    expect(tableIssue).toBeUndefined();
  });

  it('returns empty array for invalid syntax', async () => {
    const issues = await runAstPass('/tmp/bad.tsx', '<<< invalid <<<', '/tmp');
    expect(issues).toEqual([]);
  });
});

// ─── Full engine ──────────────────────────────────────────────────────────────

describe('analyzeFiles', () => {
  it('returns combined issues from both passes for bad-component.tsx', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    expect(issues.length).toBeGreaterThan(3);
  });

  it('returns fewer issues for good-component than bad-component', async () => {
    const [goodIssues, badIssues] = await Promise.all([
      analyzeFiles([path.join(FIXTURES, 'good-component.tsx')], FIXTURES),
      analyzeFiles([path.join(FIXTURES, 'bad-component.tsx')], FIXTURES),
    ]);
    expect(goodIssues.length).toBeLessThan(badIssues.length);
  });

  it('deduplicates issues that appear in both passes', async () => {
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const keys = issues.map((i) => `${i.file}:${i.line}:${i.column}:${i.rule_id}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('handles non-existent file gracefully', async () => {
    // File-level passes (ESLint / AST) return [] for unreadable files.
    // App-level checks (skip-link, landmarks) still run against the file list
    // and produce issues when no skip link or landmark is found — so the
    // overall result is not empty.  Assert that no per-file issues exist.
    const issues = await analyzeFiles(['/tmp/does-not-exist-12345.tsx'], '/tmp');
    // Filter out all app-level checks (which may fire against other files in
    // the /tmp directory, e.g. HTML files discovered by the broken-anchor pass)
    const APP_LEVEL_RULES = new Set([
      'custom/skip-link-missing',
      'custom/missing-main-landmark',
      'custom/missing-nav-landmark',
      'custom/broken-anchor-link',
    ]);
    const perFileIssues = issues.filter((i) => !APP_LEVEL_RULES.has(i.rule_id));
    expect(perFileIssues).toEqual([]);
  });

  it('handles multiple files', async () => {
    const files = [
      path.join(FIXTURES, 'good-component.tsx'),
      path.join(FIXTURES, 'bad-component.tsx'),
      path.join(FIXTURES, 'mixed-component.tsx'),
    ];
    const issues = await analyzeFiles(files, FIXTURES);
    // Should have issues from bad and mixed, fewer from good
    expect(issues.length).toBeGreaterThan(0);
    // All issues should reference one of the known files
    const relPaths = new Set(issues.map((i) => i.file));
    for (const rp of relPaths) {
      expect(['good-component.tsx', 'bad-component.tsx', 'mixed-component.tsx']).toContain(rp);
    }
  });
});

// ─── Rec 1: Broken anchor links ───────────────────────────────────────────────

describe('broken anchor link detection (custom/broken-anchor-link)', () => {
  it('flags href="#id" when the target id is nowhere in the project', async () => {
    const filePath = path.join(FIXTURES, 'broken-anchor-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const anchorIssues = issues.filter((i) => i.rule_id === 'custom/broken-anchor-link');
    // Two broken anchors: #nonexistent-section and #missing-target
    expect(anchorIssues.length).toBe(2);
    const ids = anchorIssues.map((i) => {
      const m = i.message.match(/href="#([\w-]+)"/);
      return m?.[1];
    });
    expect(ids).toContain('nonexistent-section');
    expect(ids).toContain('missing-target');
  });

  it('does NOT flag href="#id" when a matching id exists in the same file', async () => {
    const filePath = path.join(FIXTURES, 'broken-anchor-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const anchorIssues = issues.filter((i) => i.rule_id === 'custom/broken-anchor-link');
    // #real-section has id="real-section" in the same file — should not be flagged
    expect(anchorIssues.every((i) => !i.message.includes('#real-section'))).toBe(true);
  });

  it('broken anchor issues have correct WCAG mapping', async () => {
    const filePath = path.join(FIXTURES, 'broken-anchor-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const anchorIssue = issues.find((i) => i.rule_id === 'custom/broken-anchor-link');
    expect(anchorIssue).toBeDefined();
    expect(anchorIssue!.wcag_criterion).toBe('2.4.1');
    expect(anchorIssue!.wcag_level).toBe('A');
    expect(anchorIssue!.severity).toBe('serious');
  });
});

// ─── Rec 2: CSS class-based contrast detection ────────────────────────────────

describe('CSS class contrast detection (custom/css-class-low-contrast)', () => {
  it('buildCssColorMap extracts colour values from .css files', async () => {
    const cssFile = path.join(FIXTURES, 'test-styles.css');
    const map = await buildCssColorMap([cssFile]);

    // .low-contrast-text { color: #aaa }
    expect(map.has('low-contrast-text')).toBe(true);
    expect(map.get('low-contrast-text')!.color).toEqual([170, 170, 170]);

    // .high-contrast-text has both color and background-color
    expect(map.has('high-contrast-text')).toBe(true);
    expect(map.get('high-contrast-text')!.color).toEqual([0, 0, 0]);
    expect(map.get('high-contrast-text')!.backgroundColor).toEqual([255, 255, 255]);

    // .var-color-text uses var() — should not be in the map
    expect(map.has('var-color-text')).toBe(false);
  });

  it('flags elements with a failing CSS class contrast ratio', async () => {
    const filePath = path.join(FIXTURES, 'css-contrast-component.tsx');
    // FIXTURES is the repo root so test-styles.css is discovered automatically
    const issues = await analyzeFiles([filePath], FIXTURES);
    const contrastIssues = issues.filter((i) => i.rule_id === 'custom/css-class-low-contrast');
    expect(contrastIssues.length).toBeGreaterThan(0);
    // At least .low-contrast-text and .pale-on-white should be flagged
    const classNames = contrastIssues.map((i) => {
      const m = i.message.match(/\.([a-zA-Z][\w-]*)/);
      return m?.[1];
    });
    expect(classNames).toContain('low-contrast-text');
    expect(classNames).toContain('pale-on-white');
  });

  it('does NOT flag elements with passing CSS class contrast', async () => {
    const filePath = path.join(FIXTURES, 'css-contrast-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const contrastIssues = issues.filter((i) => i.rule_id === 'custom/css-class-low-contrast');
    const classNames = contrastIssues.map((i) => {
      const m = i.message.match(/\.([a-zA-Z][\w-]*)/);
      return m?.[1];
    });
    // These classes have sufficient contrast and must not be flagged
    expect(classNames).not.toContain('high-contrast-text');
    expect(classNames).not.toContain('dark-grey-text');
    expect(classNames).not.toContain('navy-text');
    expect(classNames).not.toContain('var-color-text');
  });

  it('css-class contrast issues have correct WCAG mapping', async () => {
    const filePath = path.join(FIXTURES, 'css-contrast-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const contrastIssue = issues.find((i) => i.rule_id === 'custom/css-class-low-contrast');
    expect(contrastIssue).toBeDefined();
    expect(contrastIssue!.wcag_criterion).toBe('1.4.3');
    expect(contrastIssue!.wcag_level).toBe('AA');
    expect(contrastIssue!.severity).toBe('serious');
  });
});

// ─── Rec 3: Missing alt attribute fallback ────────────────────────────────────

describe('missing alt attribute fallback (custom/img-missing-alt)', () => {
  it('AST pass flags <img> with no alt attribute at all', async () => {
    const filePath = path.join(FIXTURES, 'missing-alt-component.tsx');
    const content = await readFixture('missing-alt-component.tsx');
    const issues = await runAstPass(filePath, content, FIXTURES);
    const missingAltIssue = issues.find((i) => i.rule_id === 'custom/img-missing-alt');
    expect(missingAltIssue).toBeDefined();
    expect(missingAltIssue!.wcag_criterion).toBe('1.1.1');
    expect(missingAltIssue!.severity).toBe('critical');
  });

  it('AST pass does NOT flag <img alt=""> (decorative empty alt)', async () => {
    const content = `
      import React from 'react';
      export const Deco = () => <img src="/deco.png" alt="" />;
    `;
    const issues = await runAstPass('/tmp/Deco.tsx', content, '/tmp');
    expect(issues.find((i) => i.rule_id === 'custom/img-missing-alt')).toBeUndefined();
  });

  it('AST pass does NOT flag <img> with a descriptive alt', async () => {
    const content = `
      import React from 'react';
      export const Hero = () => <img src="/hero.png" alt="A scenic mountain landscape at dawn" />;
    `;
    const issues = await runAstPass('/tmp/Hero.tsx', content, '/tmp');
    expect(issues.find((i) => i.rule_id === 'custom/img-missing-alt')).toBeUndefined();
  });

  it('engine deduplicates img-missing-alt when jsx-a11y/alt-text fires on same line', async () => {
    // bad-component.tsx has <img src={imageUrl} /> (no alt) — both ESLint and AST pass
    // should fire on it, but dedup logic should keep only one issue for 1.1.1 at that line
    const filePath = path.join(FIXTURES, 'bad-component.tsx');
    const issues = await analyzeFiles([filePath], FIXTURES);
    const altIssues = issues.filter(
      (i) => (i.rule_id === 'jsx-a11y/alt-text' || i.rule_id === 'custom/img-missing-alt') &&
              i.file === 'bad-component.tsx',
    );
    // Only ONE issue should survive dedup (the preferred jsx-a11y one)
    expect(altIssues.length).toBe(1);
    expect(altIssues[0].rule_id).toBe('jsx-a11y/alt-text');
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readFixture(name: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(path.join(FIXTURES, name), 'utf-8');
}
