import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';
import { runEslintPass } from '../src/analysis/eslint-pass.js';
import { runAstPass } from '../src/analysis/ast-pass.js';
import { analyzeFiles } from '../src/analysis/engine.js';

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
    const issues = await analyzeFiles(['/tmp/does-not-exist-12345.tsx'], '/tmp');
    expect(issues).toEqual([]);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readFixture(name: string): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  return readFile(path.join(FIXTURES, name), 'utf-8');
}
