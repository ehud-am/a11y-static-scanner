/** WCAG 2.2 conformance level for a single success criterion. */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/**
 * How severe an accessibility issue is for users.
 *
 *   critical — blocks access for users with disabilities (e.g. missing alt text)
 *   serious  — creates significant barriers (e.g. keyboard traps)
 *   moderate — degrades the experience noticeably (e.g. missing captions)
 *   minor    — best-practice deviation with limited user impact
 */
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';

/**
 * Overall WCAG 2.2 compliance classification for the scanned project.
 *
 *   AAA          — zero violations across all A, AA, and AAA criteria
 *   AA           — zero A/AA violations; only AAA issues present
 *   Partial AA   — some A or AA violations detected
 *   Non-compliant — high density of critical violations
 */
export type OverallLevel = 'AAA' | 'AA' | 'Partial AA' | 'Non-compliant';

/** A single accessibility violation found during a scan. */
export interface Issue {
  /** Stable UUID for this issue instance. */
  id: string;
  /** Relative path to the file containing the violation. */
  file: string;
  /** 1-based source line number. */
  line: number;
  /** 1-based source column number. */
  column: number;
  /** ESLint or custom rule ID that fired (e.g. "jsx-a11y/alt-text"). */
  rule_id: string;
  /** WCAG 2.2 success criterion number (e.g. "1.1.1"). */
  wcag_criterion: string;
  /** Conformance level of the violated criterion. */
  wcag_level: WcagLevel;
  /** Severity classification of the violation. */
  severity: Severity;
  /** Human-readable description of the problem and how to fix it. */
  message: string;
  /** The source code lines surrounding the violation (context window). */
  code_snippet: string;
  /** Short title of the violated WCAG criterion. */
  wcag_title: string;
  /** W3C Understanding document URL for the criterion. */
  wcag_url: string;
}

/** Scan metadata attached to every report. */
export interface ReportMeta {
  /** URL or local path that was scanned. */
  repo_url: string;
  /** Git branch name, or "(local)" for local-path scans. */
  branch: string;
  /** ISO 8601 timestamp of when the scan ran. */
  scanned_at: string;
  /** Total React/HTML files discovered before filtering. */
  total_files_found: number;
  /** Number of files that were actually analysed. */
  total_files_scanned: number;
}

/**
 * Aggregate statistics computed from the issue list.
 *
 * Pass rates use a *cumulative* model that mirrors WCAG conformance rules:
 *   - `a_pass_rate`   = % of Level A checkable criteria with no violations
 *   - `aa_pass_rate`  = % of Level A+AA checkable criteria with no violations
 *   - `aaa_pass_rate` = % of Level A+AA+AAA checkable criteria with no violations
 *
 * This means an A-level violation will lower both `a_pass_rate` AND
 * `aa_pass_rate`, correctly reflecting that AA conformance requires all A
 * criteria to pass too.
 */
export interface ReportSummary {
  overall_level: OverallLevel;
  /** Percentage (0–100) of Level A criteria that have no violations. */
  a_pass_rate: number;
  /** Percentage (0–100) of cumulative A+AA criteria that have no violations. */
  aa_pass_rate: number;
  /** Percentage (0–100) of cumulative A+AA+AAA criteria that have no violations. */
  aaa_pass_rate: number;
  total_issues: number;
  issues_by_severity: Record<Severity, number>;
  issues_by_wcag_level: Record<WcagLevel, number>;
}

/** The complete scan result returned by every report renderer. */
export interface ReportResult {
  meta: ReportMeta;
  summary: ReportSummary;
  /** All issues, sorted by severity (critical first) then by file + line. */
  issues: Issue[];
}

/** Input parameters for the `analyze_repo` tool. */
export interface AnalyzeRepoInput {
  repo_url: string;
  token?: string;
  branch?: string;
  path_filter?: string;
}

/** Full definition of a WCAG 2.2 success criterion. */
export interface WcagCriterion {
  /** Dotted-number ID, e.g. "1.1.1". */
  id: string;
  title: string;
  level: WcagLevel;
  description: string;
  /** Link to the W3C Understanding document for this criterion. */
  url: string;
}

/** Maps a lint rule ID to its WCAG criterion and severity classification. */
export interface WcagRuleMapping {
  /** WCAG criterion ID this rule checks (e.g. "1.1.1"). */
  criterion: string;
  level: WcagLevel;
  title: string;
  severity: Severity;
  url: string;
}

/** Result of fetching a repository to a temporary local directory. */
export interface FetchedRepo {
  /** Absolute path to the extracted repository root. */
  localPath: string;
  /** The branch that was fetched. */
  branch: string;
  /** Remove all temporary files created during the fetch. */
  cleanup: () => Promise<void>;
}

/** Interface implemented by GitHub and GitLab fetchers. */
export interface RepoFetcher {
  fetch(url: string, token?: string, branch?: string): Promise<FetchedRepo>;
}
