#!/usr/bin/env node
/**
 * a11y-scan — CLI for a11y-static-scanner
 *
 * Exposes the same analysis engine used by the MCP server as a standalone
 * command suitable for build pipelines, pre-commit hooks, and terminal use.
 *
 * Usage:
 *   a11y-scan scan <path>  [options]
 *   a11y-scan repo <url>   [options]
 *   a11y-scan wcag <id>
 *
 * Exit codes:
 *   0  — scan completed; compliance meets --fail-on threshold (or no threshold set)
 *   1  — compliance is BELOW the --fail-on threshold  →  fail the build
 *   2  — execution error (bad arguments, file not found, network failure, etc.)
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';

import { discoverReactFiles } from './discovery/file-discoverer.js';
import { analyzeFiles } from './analysis/engine.js';
import { generateReport, renderMarkdownSummary } from './report/generator.js';
import { renderPdf } from './report/pdf-renderer.js';
import { renderExcel } from './report/excel-renderer.js';
import { createFetcher } from './fetcher/index.js';
import { handleWcagDetail } from './tools/wcag-detail.js';
import type { ReportResult, OverallLevel } from './types.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const VERSION = '1.2.0';

// Ordered worst → best so we can do numeric comparisons for --fail-on
const COMPLIANCE_ORDER: OverallLevel[] = ['Non-compliant', 'Partial AA', 'AA', 'AAA'];

type Format = 'json' | 'markdown' | 'pdf' | 'excel';
type FailOnLevel = 'AA' | 'AAA';

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP = `
a11y-scan — WCAG 2.2 accessibility audit for React codebases

Usage:
  a11y-scan scan <path>  [options]     Scan a local directory
  a11y-scan repo <url>   [options]     Download and scan a remote repository
  a11y-scan wcag <id>                  Look up a WCAG 2.2 criterion

Options:
  --format <f>        Output format: json, markdown, pdf, excel  (default: json)
  --output <path>     Where to save the report  (only for pdf and excel formats)
  --filter <glob>     Restrict scan to matching files  (e.g. src/components/**)
  --token <token>     Personal access token for private GitHub / GitLab repos
  --branch <branch>   Branch to scan  (repo command only; defaults to HEAD)
  --fail-on <level>   Exit 1 if compliance is below this level  (AA or AAA)
  --quiet             Suppress progress messages; only print the report
  --version, -v       Print version and exit
  --help, -h          Print this message and exit

Exit codes:
  0   Success — compliance meets the --fail-on threshold (or no threshold set)
  1   Compliance is BELOW the --fail-on threshold
  2   Execution error (bad arguments, file not found, network failure, etc.)

Notes:
  • Progress messages are written to stderr; the report is written to stdout.
    You can safely pipe or redirect stdout without capturing progress noise.
  • For pdf and excel formats, stdout receives only the saved file path.
    The --output flag sets a custom save location; otherwise a timestamped
    file is created in the system temp directory.

Examples:
  # Audit a local project and fail the build on any AA violations
  a11y-scan scan ./my-app --fail-on AA

  # Audit and print a Markdown summary; save nothing to disk
  a11y-scan scan ./my-app --format markdown

  # Scan only the components directory, emit JSON, fail on AA
  a11y-scan scan ./my-app --filter "src/components/**" --format json --fail-on AA

  # Audit a GitHub repo and save an Excel workbook
  a11y-scan repo https://github.com/org/repo --format excel --output ./a11y-report.xlsx

  # Audit a private repo on a specific branch
  a11y-scan repo https://github.com/org/private --token ghp_xxxx --branch staging --fail-on AA

  # Look up WCAG criterion 2.4.11
  a11y-scan wcag 2.4.11

GitHub Actions example:
  - name: Accessibility audit
    run: |
      npx a11y-scan scan ./src --format markdown --fail-on AA | tee a11y-report.md
`.trim();

// ─── Arg parser ───────────────────────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  positional: string[];
  format: Format;
  output?: string;
  filter?: string;
  token?: string;
  branch?: string;
  failOn?: FailOnLevel;
  quiet: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2); // strip node binary + script path

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP + '\n');
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    process.stdout.write(VERSION + '\n');
    process.exit(0);
  }

  const [command, ...rest] = args;

  if (!['scan', 'repo', 'wcag'].includes(command)) {
    die(`Unknown command: "${command}". Run: a11y-scan --help`);
  }

  const positional: string[] = [];
  let format: Format = 'json';
  let output: string | undefined;
  let filter: string | undefined;
  let token: string | undefined;
  let branch: string | undefined;
  let failOn: FailOnLevel | undefined;
  let quiet = false;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const next = rest[i + 1];

    switch (arg) {
      case '--format':
        if (!next || !['json', 'markdown', 'pdf', 'excel'].includes(next)) {
          die('--format must be one of: json, markdown, pdf, excel');
        }
        format = next as Format;
        i++;
        break;

      case '--output':
        if (!next) die('--output requires a path argument');
        output = next;
        i++;
        break;

      case '--filter':
        if (!next) die('--filter requires a glob pattern');
        filter = next;
        i++;
        break;

      case '--token':
        if (!next) die('--token requires a value');
        token = next;
        i++;
        break;

      case '--branch':
        if (!next) die('--branch requires a branch name');
        branch = next;
        i++;
        break;

      case '--fail-on':
        if (!next || !['AA', 'AAA'].includes(next)) {
          die('--fail-on must be AA or AAA');
        }
        failOn = next as FailOnLevel;
        i++;
        break;

      case '--quiet':
        quiet = true;
        break;

      default:
        die(`Unknown option: "${arg}". Run: a11y-scan --help`);
    }
  }

  if (positional.length === 0) {
    die(`"${command}" requires a positional argument. Run: a11y-scan --help`);
  }

  return { command, positional, format, output, filter, token, branch, failOn, quiet };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function die(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(2);
}

function progress(message: string, quiet: boolean): void {
  if (!quiet) process.stderr.write(`${message}\n`);
}

function defaultOutputPath(format: 'pdf' | 'excel'): string {
  const ext = format === 'pdf' ? 'pdf' : 'xlsx';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return path.join(os.tmpdir(), `a11y-report_${ts}.${ext}`);
}

function compliancePasses(actual: OverallLevel, required: FailOnLevel): boolean {
  const actualIdx = COMPLIANCE_ORDER.indexOf(actual);
  const requiredIdx = COMPLIANCE_ORDER.indexOf(required);
  if (actualIdx === -1) return true; // unknown level — don't block the build
  return actualIdx >= requiredIdx;
}

// ─── Report rendering ─────────────────────────────────────────────────────────

async function renderReport(
  report: ReportResult,
  format: Format,
  outputPath: string | undefined,
): Promise<string> {
  switch (format) {
    case 'markdown':
      return renderMarkdownSummary(report);

    case 'pdf': {
      const buffer = await renderPdf(report);
      const filePath = outputPath ?? defaultOutputPath('pdf');
      await fs.writeFile(filePath, buffer);
      return `PDF report saved to: ${filePath}`;
    }

    case 'excel': {
      const buffer = await renderExcel(report);
      const filePath = outputPath ?? defaultOutputPath('excel');
      await fs.writeFile(filePath, buffer);
      return `Excel report saved to: ${filePath}`;
    }

    default:
      return JSON.stringify(report, null, 2);
  }
}

// ─── Core analysis (shared by scan and repo commands) ─────────────────────────

/**
 * Run the full analysis pipeline against a local directory and emit the
 * result to stdout.  Returns an exit code (0 = pass, 1 = fail-on triggered).
 *
 * The scan runs exactly once regardless of --format or --fail-on, because the
 * report object is produced first and then rendered into whatever format the
 * caller requested.
 */
async function runAnalysis(opts: {
  rootPath: string;
  label: string;
  branch: string;
  filter: string | undefined;
  format: Format;
  outputPath: string | undefined;
  failOn: FailOnLevel | undefined;
  quiet: boolean;
}): Promise<number> {
  const { rootPath, label, branch, filter, format, outputPath, failOn, quiet } = opts;

  progress(`Discovering React files…`, quiet);
  const files = await discoverReactFiles(rootPath, filter);
  progress(`Found ${files.length} file(s). Analysing…`, quiet);

  const issues = await analyzeFiles(files, rootPath);

  const report = generateReport({
    repoUrl: label,
    branch,
    totalFilesFound: files.length,
    totalFilesScanned: files.length,
    issues,
  });

  const rendered = await renderReport(report, format, outputPath);
  process.stdout.write(rendered + '\n');

  if (!failOn) return 0;

  const level = report.summary.overall_level;
  if (compliancePasses(level, failOn)) {
    progress(`\nCompliance check PASSED  (overall level: ${level})`, quiet);
    return 0;
  }

  progress(
    `\nCompliance check FAILED  (overall level: "${level}", required: "${failOn}")`,
    quiet,
  );
  return 1;
}

// ─── Command: scan ────────────────────────────────────────────────────────────

async function cmdScan(args: ParsedArgs): Promise<number> {
  const localPath = path.resolve(args.positional[0]);

  try {
    const stat = await fs.stat(localPath);
    if (!stat.isDirectory()) die(`Not a directory: "${localPath}"`);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') die(`Path does not exist: "${localPath}"`);
    throw err;
  }

  return runAnalysis({
    rootPath: localPath,
    label: localPath,
    branch: '(local)',
    filter: args.filter,
    format: args.format,
    outputPath: args.output,
    failOn: args.failOn,
    quiet: args.quiet,
  });
}

// ─── Command: repo ────────────────────────────────────────────────────────────

async function cmdRepo(args: ParsedArgs): Promise<number> {
  const repoUrl = args.positional[0];

  let fetcher: ReturnType<typeof createFetcher>;
  try {
    fetcher = createFetcher(repoUrl);
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }

  progress(`Fetching ${repoUrl}…`, args.quiet);
  const fetchedRepo = await fetcher.fetch(repoUrl, args.token, args.branch);

  try {
    return await runAnalysis({
      rootPath: fetchedRepo.localPath,
      label: repoUrl,
      branch: fetchedRepo.branch,
      filter: args.filter,
      format: args.format,
      outputPath: args.output,
      failOn: args.failOn,
      quiet: args.quiet,
    });
  } finally {
    await fetchedRepo.cleanup();
  }
}

// ─── Command: wcag ────────────────────────────────────────────────────────────

function cmdWcag(args: ParsedArgs): number {
  const result = handleWcagDetail({ criterion_id: args.positional[0] });
  process.stdout.write(result + '\n');
  return 0;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  let exitCode: number;

  try {
    switch (args.command) {
      case 'scan':
        exitCode = await cmdScan(args);
        break;
      case 'repo':
        exitCode = await cmdRepo(args);
        break;
      case 'wcag':
        exitCode = cmdWcag(args);
        break;
      default:
        exitCode = 2;
    }
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    exitCode = 2;
  }

  process.exit(exitCode);
}

main();
