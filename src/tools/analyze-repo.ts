import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { createFetcher } from '../fetcher/index.js';
import { discoverReactFiles } from '../discovery/file-discoverer.js';
import { analyzeFiles } from '../analysis/engine.js';
import { generateReport, renderMarkdownSummary } from '../report/generator.js';
import { renderPdf } from '../report/pdf-renderer.js';
import { renderExcel } from '../report/excel-renderer.js';

export const AnalyzeRepoSchema = z.object({
  repo_url: z
    .string()
    .url()
    .describe('Full URL of the GitHub or GitLab repository (e.g. https://github.com/org/repo)'),
  token: z
    .string()
    .optional()
    .describe('Personal access token for private repositories. Omit for public repos.'),
  branch: z
    .string()
    .optional()
    .describe('Branch to scan. Defaults to the repository default branch.'),
  path_filter: z
    .string()
    .optional()
    .describe(
      'Optional glob pattern to restrict the scan, relative to repo root (e.g. src/components/**)',
    ),
  format: z
    .enum(['json', 'markdown', 'pdf', 'excel'])
    .default('json')
    .describe(
      'Output format. ' +
      '"json" returns structured data. ' +
      '"markdown" returns a human-readable text report. ' +
      '"pdf" saves a formatted PDF to disk and returns the file path. ' +
      '"excel" saves an Excel workbook (.xlsx) to disk and returns the file path.',
    ),
  output_path: z
    .string()
    .optional()
    .describe(
      'Absolute path where the PDF or Excel file should be saved. ' +
      'Only used when format is "pdf" or "excel". ' +
      'Defaults to a timestamped file in the system temp directory.',
    ),
});

export type AnalyzeRepoInput = z.infer<typeof AnalyzeRepoSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultOutputPath(format: 'pdf' | 'excel'): string {
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return path.join(os.tmpdir(), `a11y-report_${ts}.${ext}`);
}

function quickSummaryText(report: ReturnType<typeof generateReport>): string {
  const { summary: s } = report;
  return (
    `Overall:  ${s.overall_level}\n` +
    `AA pass rate: ${s.aa_pass_rate}%   AAA pass rate: ${s.aaa_pass_rate}%\n` +
    `Issues:   ${s.total_issues} total  ` +
    `(critical: ${s.issues_by_severity.critical}, ` +
    `serious: ${s.issues_by_severity.serious}, ` +
    `moderate: ${s.issues_by_severity.moderate}, ` +
    `minor: ${s.issues_by_severity.minor})\n` +
    `WCAG A: ${s.issues_by_wcag_level.A}  ` +
    `AA: ${s.issues_by_wcag_level.AA}  ` +
    `AAA: ${s.issues_by_wcag_level.AAA}`
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleAnalyzeRepo(input: AnalyzeRepoInput): Promise<string> {
  const { repo_url, token, branch, path_filter, format, output_path } = input;

  // 1. Fetch repository
  const fetcher = createFetcher(repo_url);
  const fetchedRepo = await fetcher.fetch(repo_url, token, branch);

  try {
    // 2. Discover React files
    const allFiles = await discoverReactFiles(fetchedRepo.localPath, path_filter);

    // 3. Analyse
    const issues = await analyzeFiles(allFiles, fetchedRepo.localPath);

    // 4. Build report data
    const report = generateReport({
      repoUrl: repo_url,
      branch: fetchedRepo.branch,
      totalFilesFound: allFiles.length,
      totalFilesScanned: allFiles.length,
      issues,
    });

    // 5. Render in the requested format
    switch (format) {
      case 'markdown':
        return renderMarkdownSummary(report);

      case 'pdf': {
        const buffer = await renderPdf(report);
        const filePath = output_path ?? defaultOutputPath('pdf');
        await fs.writeFile(filePath, buffer);
        return (
          `PDF report saved to:\n  ${filePath}\n\n` +
          `${quickSummaryText(report)}\n\n` +
          `Open the file to view the full formatted report.`
        );
      }

      case 'excel': {
        const buffer = await renderExcel(report);
        const filePath = output_path ?? defaultOutputPath('excel');
        await fs.writeFile(filePath, buffer);
        return (
          `Excel report saved to:\n  ${filePath}\n\n` +
          `${quickSummaryText(report)}\n\n` +
          `The workbook contains three sheets:\n` +
          `  • Summary  — overall compliance metrics\n` +
          `  • Issues   — all ${report.issues.length} issues with colour-coded severity and auto-filter\n` +
          `  • WCAG Coverage — violations grouped by criterion`
        );
      }

      default:
        return JSON.stringify(report, null, 2);
    }
  } finally {
    await fetchedRepo.cleanup();
  }
}
