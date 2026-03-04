import { describe, it, expect } from 'vitest';
import { generateReport, renderMarkdownSummary } from '../src/report/generator.js';
import type { Issue } from '../src/types.js';

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'test-id',
    file: 'src/App.tsx',
    line: 10,
    column: 4,
    rule_id: 'jsx-a11y/alt-text',
    wcag_criterion: '1.1.1',
    wcag_level: 'A',
    severity: 'critical',
    message: 'Missing alt text',
    code_snippet: '<img src="foo.png" />',
    wcag_title: 'Non-text Content',
    wcag_url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    ...overrides,
  };
}

const BASE_OPTS = {
  repoUrl: 'https://github.com/org/repo',
  branch: 'main',
  totalFilesFound: 10,
  totalFilesScanned: 10,
};

describe('generateReport', () => {
  it('returns correct meta fields', () => {
    const report = generateReport({ ...BASE_OPTS, issues: [] });
    expect(report.meta.repo_url).toBe(BASE_OPTS.repoUrl);
    expect(report.meta.branch).toBe('main');
    expect(report.meta.total_files_found).toBe(10);
    expect(report.meta.scanned_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns AAA overall_level when there are no issues', () => {
    const report = generateReport({ ...BASE_OPTS, issues: [] });
    expect(report.summary.overall_level).toBe('AAA');
    expect(report.summary.total_issues).toBe(0);
  });

  it('returns AA overall_level when only AAA issues are present', () => {
    const aaaIssue = makeIssue({ wcag_level: 'AAA', severity: 'moderate', wcag_criterion: '2.4.12' });
    const report = generateReport({ ...BASE_OPTS, issues: [aaaIssue] });
    expect(report.summary.overall_level).toBe('AA');
  });

  it('returns Partial AA when A or AA issues are present', () => {
    const issue = makeIssue({ wcag_level: 'A', severity: 'critical' });
    const report = generateReport({ ...BASE_OPTS, issues: [issue] });
    expect(report.summary.overall_level).toBe('Partial AA');
  });

  it('returns Non-compliant for a high volume of critical issues', () => {
    const issues = Array.from({ length: 10 }, (_, i) =>
      makeIssue({ id: `id-${i}`, severity: 'critical', wcag_level: 'A' }),
    );
    const report = generateReport({ ...BASE_OPTS, issues });
    expect(report.summary.overall_level).toBe('Non-compliant');
  });

  it('counts issues_by_severity correctly', () => {
    const issues = [
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'critical' }),
      makeIssue({ severity: 'serious' }),
      makeIssue({ severity: 'minor' }),
    ];
    const report = generateReport({ ...BASE_OPTS, issues });
    expect(report.summary.issues_by_severity.critical).toBe(2);
    expect(report.summary.issues_by_severity.serious).toBe(1);
    expect(report.summary.issues_by_severity.moderate).toBe(0);
    expect(report.summary.issues_by_severity.minor).toBe(1);
    expect(report.summary.total_issues).toBe(4);
  });

  it('counts issues_by_wcag_level correctly', () => {
    const issues = [
      makeIssue({ wcag_level: 'A' }),
      makeIssue({ wcag_level: 'AA' }),
      makeIssue({ wcag_level: 'AAA', severity: 'moderate', wcag_criterion: '2.4.12' }),
    ];
    const report = generateReport({ ...BASE_OPTS, issues });
    expect(report.summary.issues_by_wcag_level.A).toBe(1);
    expect(report.summary.issues_by_wcag_level.AA).toBe(1);
    expect(report.summary.issues_by_wcag_level.AAA).toBe(1);
  });

  it('sorts issues: critical first, then by file and line', () => {
    const issues = [
      makeIssue({ id: '1', severity: 'minor', line: 5 }),
      makeIssue({ id: '2', severity: 'critical', line: 20 }),
      makeIssue({ id: '3', severity: 'serious', line: 10 }),
    ];
    const report = generateReport({ ...BASE_OPTS, issues });
    expect(report.issues[0].severity).toBe('critical');
    expect(report.issues[1].severity).toBe('serious');
    expect(report.issues[2].severity).toBe('minor');
  });

  it('aa_pass_rate is 100 when no A or AA issues', () => {
    const aaaIssue = makeIssue({ wcag_level: 'AAA', severity: 'moderate', wcag_criterion: '2.4.12' });
    const report = generateReport({ ...BASE_OPTS, issues: [aaaIssue] });
    expect(report.summary.aa_pass_rate).toBe(100);
  });

  it('aa_pass_rate drops when A or AA issues are present', () => {
    const aIssue = makeIssue({ wcag_level: 'A', severity: 'critical' });
    const report = generateReport({ ...BASE_OPTS, issues: [aIssue] });
    expect(report.summary.aa_pass_rate).toBeLessThan(100);
  });
});

describe('renderMarkdownSummary', () => {
  it('produces a non-empty markdown string', () => {
    const report = generateReport({ ...BASE_OPTS, issues: [] });
    const md = renderMarkdownSummary(report);
    expect(md).toContain('# A11y Report');
    expect(md).toContain('https://github.com/org/repo');
  });

  it('includes overall_level in the summary table', () => {
    const report = generateReport({ ...BASE_OPTS, issues: [] });
    const md = renderMarkdownSummary(report);
    expect(md).toContain('Overall Level');
    expect(md).toContain('AAA');
  });

  it('includes issue details when issues are present', () => {
    const issues = [makeIssue()];
    const report = generateReport({ ...BASE_OPTS, issues });
    const md = renderMarkdownSummary(report);
    expect(md).toContain('Non-text Content');
    expect(md).toContain('jsx-a11y/alt-text');
    expect(md).toContain('src/App.tsx');
  });

  it('handles zero issues with a congratulations message', () => {
    const report = generateReport({ ...BASE_OPTS, issues: [] });
    const md = renderMarkdownSummary(report);
    expect(md).toContain('No issues found');
  });
});
