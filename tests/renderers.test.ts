/**
 * Tests for the PDF and Excel renderers.
 *
 * These tests verify:
 *  - The rendered output is a non-empty Buffer with the correct magic bytes
 *  - Key content is present in the output (round-tripped for Excel via ExcelJS)
 *  - Edge cases: zero issues, one issue, many issues
 *  - The analyze_repo tool correctly saves PDF/Excel files and returns file paths
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import ExcelJS from 'exceljs';
import type { ReportResult, Issue } from '../src/types.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'test-uuid',
    file: 'src/components/Hero.tsx',
    line: 42,
    column: 5,
    rule_id: 'jsx-a11y/alt-text',
    wcag_criterion: '1.1.1',
    wcag_level: 'A',
    severity: 'critical',
    message: 'img elements must have an alt prop, either with meaningful text, or an empty string for decorative images.',
    code_snippet: '  <img src={hero} />\n  // missing alt',
    wcag_title: 'Non-text Content',
    wcag_url: 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html',
    ...overrides,
  };
}

function makeReport(issues: Issue[]): ReportResult {
  const crit  = issues.filter(i => i.severity === 'critical').length;
  const ser   = issues.filter(i => i.severity === 'serious').length;
  const mod   = issues.filter(i => i.severity === 'moderate').length;
  const minor = issues.filter(i => i.severity === 'minor').length;
  const A   = issues.filter(i => i.wcag_level === 'A').length;
  const AA  = issues.filter(i => i.wcag_level === 'AA').length;
  const AAA = issues.filter(i => i.wcag_level === 'AAA').length;

  return {
    meta: {
      repo_url: 'https://github.com/test-org/test-repo',
      branch: 'main',
      scanned_at: '2024-06-01T10:00:00.000Z',
      total_files_found: 25,
      total_files_scanned: 25,
    },
    summary: {
      overall_level: issues.length === 0 ? 'AAA' : crit > 5 ? 'Non-compliant' : 'Partial AA',
      aa_pass_rate: issues.length === 0 ? 100 : 72,
      aaa_pass_rate: issues.length === 0 ? 100 : 60,
      total_issues: issues.length,
      issues_by_severity: { critical: crit, serious: ser, moderate: mod, minor },
      issues_by_wcag_level: { A, AA, AAA },
    },
    issues,
  };
}

// ─── PDF renderer ─────────────────────────────────────────────────────────────

describe('renderPdf', () => {
  it('returns a Buffer starting with the PDF magic bytes', async () => {
    const { renderPdf } = await import('../src/report/pdf-renderer.js');
    const report = makeReport([makeIssue()]);
    const buf = await renderPdf(report);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(500);
    // PDF files always start with "%PDF"
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('renders a report with zero issues without throwing', async () => {
    const { renderPdf } = await import('../src/report/pdf-renderer.js');
    const report = makeReport([]);
    const buf = await renderPdf(report);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('renders a report with many issues (pagination test)', async () => {
    const { renderPdf } = await import('../src/report/pdf-renderer.js');
    const issues = Array.from({ length: 30 }, (_, i) =>
      makeIssue({
        id: `id-${i}`,
        line: i + 1,
        file: `src/component${i}.tsx`,
        severity: (['critical', 'serious', 'moderate', 'minor'] as const)[i % 4],
      }),
    );
    const report = makeReport(issues);
    const buf = await renderPdf(report);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
    // Multi-page PDF should be larger than single-page
    expect(buf.length).toBeGreaterThan(5_000);
  });

  it('renders multiple severity levels without throwing', async () => {
    const { renderPdf } = await import('../src/report/pdf-renderer.js');
    const issues = [
      makeIssue({ severity: 'critical', wcag_level: 'A' }),
      makeIssue({ severity: 'serious',  wcag_level: 'AA',  rule_id: 'jsx-a11y/autocomplete-valid', wcag_criterion: '1.3.5' }),
      makeIssue({ severity: 'moderate', wcag_level: 'AAA', rule_id: 'custom/focus-outline-removed', wcag_criterion: '2.4.12' }),
      makeIssue({ severity: 'minor',    wcag_level: 'A',   rule_id: 'jsx-a11y/no-autofocus' }),
    ];
    const report = makeReport(issues);
    await expect(renderPdf(report)).resolves.toBeInstanceOf(Buffer);
  });
});

// ─── Excel renderer ───────────────────────────────────────────────────────────

describe('renderExcel', () => {
  it('returns a Buffer with ZIP/PK magic bytes (XLSX is a ZIP)', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const report = makeReport([makeIssue()]);
    const buf = await renderExcel(report);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(1_000);
    // XLSX files are ZIP archives; ZIP magic bytes are 0x50 0x4B (PK)
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });

  it('renders a report with zero issues without throwing', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const report = makeReport([]);
    const buf = await renderExcel(report);

    expect(buf).toBeInstanceOf(Buffer);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('workbook has Summary, Issues, and WCAG Coverage sheets', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const report = makeReport([makeIssue()]);
    const buf = await renderExcel(report);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toContain('Summary');
    expect(names).toContain('Issues');
    expect(names).toContain('WCAG Coverage');
  });

  it('Issues sheet has a header row and one data row per issue', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const issues = [makeIssue(), makeIssue({ id: 'id-2', line: 99 })];
    const report = makeReport(issues);
    const buf = await renderExcel(report);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const ws = wb.getWorksheet('Issues')!;
    expect(ws).toBeDefined();
    // Row 1 = headers, then one row per issue
    expect(ws.rowCount).toBe(issues.length + 1);
  });

  it('Summary sheet contains the overall level', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const report = makeReport([makeIssue()]);
    const buf = await renderExcel(report);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const ws = wb.getWorksheet('Summary')!;
    let found = false;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (typeof v === 'string' && v.includes('Partial AA')) found = true;
        if (typeof v === 'object' && v !== null && 'text' in (v as object)) {
          const text = (v as { text: string }).text;
          if (typeof text === 'string' && text.includes('Partial AA')) found = true;
        }
      });
    });
    expect(found).toBe(true);
  });

  it('Issues sheet contains correct file path and line number', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const issue = makeIssue({ file: 'src/unique-file.tsx', line: 777 });
    const report = makeReport([issue]);
    const buf = await renderExcel(report);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const ws = wb.getWorksheet('Issues')!;
    const dataRow = ws.getRow(2); // Row 1 = headers, row 2 = first issue
    const rowValues = dataRow.values as (string | number | undefined)[];

    expect(rowValues).toContain('src/unique-file.tsx');
    expect(rowValues).toContain(777);
  });

  it('WCAG Coverage sheet groups issues by criterion', async () => {
    const { renderExcel } = await import('../src/report/excel-renderer.js');
    const issues = [
      makeIssue({ wcag_criterion: '1.1.1', id: '1' }),
      makeIssue({ wcag_criterion: '1.1.1', id: '2' }),
      makeIssue({ wcag_criterion: '2.1.1', id: '3', wcag_title: 'Keyboard' }),
    ];
    const report = makeReport(issues);
    const buf = await renderExcel(report);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const ws = wb.getWorksheet('WCAG Coverage')!;
    // Should have header + 2 unique criteria rows
    expect(ws.rowCount).toBe(3); // header + 1.1.1 + 2.1.1
  });
});

// ─── analyze_repo tool — PDF/Excel file output ────────────────────────────────

describe('handleAnalyzeRepo — pdf/excel file output', () => {
  let savedFiles: string[] = [];

  afterEach(async () => {
    for (const f of savedFiles) {
      await fs.rm(f, { force: true });
    }
    savedFiles = [];
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('saves a .pdf file and returns the path when format="pdf"', async () => {
    const tmpPath = path.join(os.tmpdir(), `a11y-test-${Date.now()}.pdf`);
    savedFiles.push(tmpPath);

    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures'),
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'pdf',
      output_path: tmpPath,
    });

    expect(result).toContain(tmpPath);
    expect(result).toContain('Overall:');

    const stat = await fs.stat(tmpPath);
    expect(stat.size).toBeGreaterThan(500);

    const buf = await fs.readFile(tmpPath);
    expect(buf.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('saves an .xlsx file and returns the path when format="excel"', async () => {
    const tmpPath = path.join(os.tmpdir(), `a11y-test-${Date.now()}.xlsx`);
    savedFiles.push(tmpPath);

    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures'),
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'excel',
      output_path: tmpPath,
    });

    expect(result).toContain(tmpPath);
    expect(result).toContain('Issues');
    expect(result).toContain('WCAG Coverage');

    const buf = await fs.readFile(tmpPath);
    expect(buf[0]).toBe(0x50); // ZIP magic byte 'P'
    expect(buf[1]).toBe(0x4b); // ZIP magic byte 'K'
  });

  it('uses a default temp path when output_path is not specified', async () => {
    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures'),
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'pdf',
    });

    // Extract the file path from the response text
    const match = result.match(/saved to:\s+(.+\.pdf)/);
    expect(match).toBeTruthy();
    const filePath = match![1].trim();
    savedFiles.push(filePath);

    expect(filePath).toContain(os.tmpdir());
    const stat = await fs.stat(filePath);
    expect(stat.size).toBeGreaterThan(500);
  });

  it('excel output message lists the three worksheet names', async () => {
    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures'),
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'excel',
    });

    const match = result.match(/saved to:\s+(.+\.xlsx)/);
    if (match) savedFiles.push(match[1].trim());

    expect(result).toContain('Summary');
    expect(result).toContain('Issues');
    expect(result).toContain('WCAG Coverage');
  });
});

// ─── Schema validation for new params ────────────────────────────────────────

describe('AnalyzeRepoSchema — pdf/excel fields', () => {
  it('accepts format="pdf"', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({
      repo_url: 'https://github.com/org/repo',
      format: 'pdf',
    });
    expect(result.success).toBe(true);
  });

  it('accepts format="excel"', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({
      repo_url: 'https://github.com/org/repo',
      format: 'excel',
    });
    expect(result.success).toBe(true);
  });

  it('accepts output_path with pdf format', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({
      repo_url: 'https://github.com/org/repo',
      format: 'pdf',
      output_path: '/tmp/my-report.pdf',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_path).toBe('/tmp/my-report.pdf');
    }
  });

  it('rejects invalid format values', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({
      repo_url: 'https://github.com/org/repo',
      format: 'csv',
    });
    expect(result.success).toBe(false);
  });
});
