import type {
  Issue,
  OverallLevel,
  ReportMeta,
  ReportResult,
  ReportSummary,
  Severity,
  WcagLevel,
} from '../types.js';
import { CHECKABLE_CRITERIA, WCAG_CRITERIA } from '../analysis/wcag-map.js';

// ─── Pass-rate computation ────────────────────────────────────────────────────

/**
 * Compute the pass rate for a given WCAG conformance level using a
 * *cumulative* (inclusive) model that mirrors real-world compliance:
 *
 *   a_pass_rate   = % of Level A checkable criteria with no violations
 *   aa_pass_rate  = % of Level A + AA checkable criteria with no violations
 *   aaa_pass_rate = % of Level A + AA + AAA checkable criteria with no violations
 *
 * This means an A-level violation will lower both the A and AA pass rates,
 * correctly reflecting that WCAG AA conformance requires ALL A and AA
 * criteria to be met.  Returns a 0–100 integer.
 */
function computePassRate(issues: Issue[], level: WcagLevel): number {
  // Cumulative: 'AA' includes A criteria; 'AAA' includes A+AA criteria.
  const levelsToInclude: WcagLevel[] =
    level === 'A'  ? ['A'] :
    level === 'AA' ? ['A', 'AA'] :
                    ['A', 'AA', 'AAA'];

  const criteriaInScope = new Set(
    Object.values(WCAG_CRITERIA)
      .filter((c) => levelsToInclude.includes(c.level))
      .map((c) => c.id)
      .filter((id) => CHECKABLE_CRITERIA.has(id)),
  );

  if (criteriaInScope.size === 0) return 100;

  const failedCriteria = new Set(
    issues
      .filter((i) => levelsToInclude.includes(i.wcag_level))
      .map((i) => i.wcag_criterion),
  );

  const passed = [...criteriaInScope].filter((id) => !failedCriteria.has(id)).length;
  return Math.round((passed / criteriaInScope.size) * 100);
}

// ─── Overall compliance level ─────────────────────────────────────────────────

/**
 * Classify the project's overall WCAG 2.2 compliance level based on the
 * number and severity of detected violations.
 *
 * Thresholds (intentionally conservative for a static-analysis tool):
 *   Non-compliant  — >5 critical Level-A violations, OR >20 A issues AND >10 AA issues
 *   Partial AA     — any A or AA violation
 *   AA             — no A/AA violations; AAA issues only
 *   AAA            — zero violations across all levels
 */
function deriveOverallLevel(issues: Issue[]): OverallLevel {
  const aCritical = issues.filter(
    (i) => i.wcag_level === 'A' && i.severity === 'critical',
  ).length;
  const aaIssues = issues.filter((i) => i.wcag_level === 'AA').length;
  const aIssues = issues.filter((i) => i.wcag_level === 'A').length;

  if (aCritical > 5 || (aIssues > 20 && aaIssues > 10)) return 'Non-compliant';
  if (aIssues > 0 || aaIssues > 0) return 'Partial AA';
  if (issues.some((i) => i.wcag_level === 'AAA')) return 'AA';
  return 'AAA';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Options passed to {@link generateReport}. */
export interface GenerateReportOptions {
  repoUrl: string;
  branch: string;
  totalFilesFound: number;
  totalFilesScanned: number;
  issues: Issue[];
}

/**
 * Build a complete {@link ReportResult} from a raw issue list.
 *
 * Computes all summary statistics (pass rates, severity counts, overall level)
 * and sorts the issues by severity then file+line for deterministic output.
 */
export function generateReport(opts: GenerateReportOptions): ReportResult {
  const { repoUrl, branch, totalFilesFound, totalFilesScanned, issues } = opts;

  const countBySeverity = (s: Severity) => issues.filter((i) => i.severity === s).length;
  const countByLevel = (l: WcagLevel) => issues.filter((i) => i.wcag_level === l).length;

  const summary: ReportSummary = {
    overall_level: deriveOverallLevel(issues),
    a_pass_rate: computePassRate(issues, 'A'),
    aa_pass_rate: computePassRate(issues, 'AA'),
    aaa_pass_rate: computePassRate(issues, 'AAA'),
    total_issues: issues.length,
    issues_by_severity: {
      critical: countBySeverity('critical'),
      serious: countBySeverity('serious'),
      moderate: countBySeverity('moderate'),
      minor: countBySeverity('minor'),
    },
    issues_by_wcag_level: {
      A: countByLevel('A'),
      AA: countByLevel('AA'),
      AAA: countByLevel('AAA'),
    },
  };

  const meta: ReportMeta = {
    repo_url: repoUrl,
    branch,
    scanned_at: new Date().toISOString(),
    total_files_found: totalFilesFound,
    total_files_scanned: totalFilesScanned,
  };

  // Sort: critical first, then by file + line for deterministic output
  const sortedIssues = [...issues].sort((a, b) => {
    const severityOrder: Severity[] = ['critical', 'serious', 'moderate', 'minor'];
    const sA = severityOrder.indexOf(a.severity);
    const sB = severityOrder.indexOf(b.severity);
    if (sA !== sB) return sA - sB;
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  return { meta, summary, issues: sortedIssues };
}

/** Render a human-readable Markdown summary of the report */
export function renderMarkdownSummary(report: ReportResult): string {
  const { meta, summary, issues } = report;
  const lines: string[] = [
    `# A11y Report — ${meta.repo_url}`,
    '',
    `**Branch:** ${meta.branch}  `,
    `**Scanned:** ${meta.scanned_at}  `,
    `**Files:** ${meta.total_files_scanned} React files scanned (${meta.total_files_found} found)`,
    '',
    `## Compliance Summary`,
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Overall Level | **${summary.overall_level}** |`,
    `| A Pass Rate | ${summary.a_pass_rate}% |`,
    `| AA Pass Rate | ${summary.aa_pass_rate}% |`,
    `| AAA Pass Rate | ${summary.aaa_pass_rate}% |`,
    `| Total Issues | ${summary.total_issues} |`,
    `| Critical | ${summary.issues_by_severity.critical} |`,
    `| Serious | ${summary.issues_by_severity.serious} |`,
    `| Moderate | ${summary.issues_by_severity.moderate} |`,
    `| Minor | ${summary.issues_by_severity.minor} |`,
    '',
    `## Issues by WCAG Level`,
    '',
    `| Level | Count |`,
    `|-------|-------|`,
    `| A | ${summary.issues_by_wcag_level.A} |`,
    `| AA | ${summary.issues_by_wcag_level.AA} |`,
    `| AAA | ${summary.issues_by_wcag_level.AAA} |`,
    '',
  ];

  if (issues.length === 0) {
    lines.push('_No issues found — congratulations!_');
  } else {
    lines.push('## Detailed Issues', '');
    for (const issue of issues.slice(0, 50)) {
      lines.push(
        `### [${issue.severity.toUpperCase()}] ${issue.wcag_criterion} ${issue.wcag_title}`,
        '',
        `**File:** \`${issue.file}\` line ${issue.line}  `,
        `**Rule:** \`${issue.rule_id}\`  `,
        `**WCAG:** [${issue.wcag_criterion} ${issue.wcag_title}](${issue.wcag_url}) (Level ${issue.wcag_level})  `,
        `**Message:** ${issue.message}`,
        '',
        '```jsx',
        issue.code_snippet,
        '```',
        '',
      );
    }
    if (issues.length > 50) {
      lines.push(`_... and ${issues.length - 50} more issues (see full JSON report)_`);
    }
  }

  return lines.join('\n');
}
