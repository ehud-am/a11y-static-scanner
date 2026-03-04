export type WcagLevel = 'A' | 'AA' | 'AAA';
export type Severity = 'critical' | 'serious' | 'moderate' | 'minor';
export type OverallLevel = 'AAA' | 'AA' | 'Partial AA' | 'Non-compliant';

export interface Issue {
  id: string;
  file: string;
  line: number;
  column: number;
  rule_id: string;
  wcag_criterion: string;
  wcag_level: WcagLevel;
  severity: Severity;
  message: string;
  code_snippet: string;
  wcag_title: string;
  wcag_url: string;
}

export interface ReportMeta {
  repo_url: string;
  branch: string;
  scanned_at: string;
  total_files_found: number;
  total_files_scanned: number;
}

export interface ReportSummary {
  overall_level: OverallLevel;
  aa_pass_rate: number;
  aaa_pass_rate: number;
  total_issues: number;
  issues_by_severity: Record<Severity, number>;
  issues_by_wcag_level: Record<WcagLevel, number>;
}

export interface ReportResult {
  meta: ReportMeta;
  summary: ReportSummary;
  issues: Issue[];
}

export interface AnalyzeRepoInput {
  repo_url: string;
  token?: string;
  branch?: string;
  path_filter?: string;
}

export interface WcagCriterion {
  id: string;
  title: string;
  level: WcagLevel;
  description: string;
  url: string;
}

export interface WcagRuleMapping {
  criterion: string;
  level: WcagLevel;
  title: string;
  severity: Severity;
  url: string;
}

export interface FetchedRepo {
  localPath: string;
  branch: string;
  cleanup: () => Promise<void>;
}

export interface RepoFetcher {
  fetch(url: string, token?: string, branch?: string): Promise<FetchedRepo>;
}
