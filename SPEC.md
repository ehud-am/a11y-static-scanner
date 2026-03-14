# A11y Analysis MCP — Specification

## Overview

An MCP (Model Context Protocol) server that accepts a GitHub or GitLab repository reference **or a local filesystem path**, discovers all React UI source files, performs static accessibility analysis against WCAG 2.2 AA and AAA criteria, and returns a structured compliance report.

---

## Technology Choice: TypeScript (Node.js)

**Recommendation: TypeScript over Python.**

Rationale:

- The accessibility static-analysis ecosystem lives in JavaScript: `eslint-plugin-jsx-a11y`, `axe-core`, `@babel/parser`. These tools are authoritative and actively maintained.
- Parsing JSX/TSX ASTs is first-class in the JS ecosystem (`@babel/parser`, `@typescript-eslint`). Doing the same from Python requires shelling out or using fragile ports.
- The MCP TypeScript SDK (`@modelcontextprotocol/sdk`) is mature and well-documented.
- GitHub and GitLab both have excellent JS/TS API clients (`@octokit/rest`; GitLab uses the native `fetch` REST API).
- Node.js handles async I/O (API calls, file scanning) naturally.

Python would be appropriate if the server were primarily doing document parsing or ML-based analysis, but for React + WCAG static analysis, TypeScript is the better fit.

---

## Scope

### In scope

- **Local filesystem folders** — scan any directory already on disk without network access
- Public and private GitHub and GitLab repositories
- Authentication via personal access token (PAT) or anonymous (public repos)
- Discovery of React component files: `.jsx`, `.tsx`, `.js`/`.ts`, `.mjs`/`.mts`/`.cjs`/`.cts`, `.mdx`
- Static analysis against WCAG 2.2 Level AA and Level AAA
- Structured JSON report with summary and per-issue detail
- Human-readable Markdown report
- Formatted PDF report (via pdfkit)
- Excel workbook report (.xlsx, via exceljs) with Summary, Issues, and WCAG Coverage sheets
- MCP tool interface consumable by Claude and other MCP clients
- **`a11y-scan` CLI** — standalone command for build pipelines, pre-commit hooks, and terminal use
- **CI/CD pipeline integration** via the CLI (`--fail-on` flag, structured exit codes)

### Out of scope (v1)

- Runtime/browser-rendered analysis (axe-core browser mode)
- Color contrast checking (requires computed styles, not available statically)
- End-to-end test execution
- Remediation suggestions beyond issue identification

---

## MCP Tools Exposed

### `analyze_local_path`

Scans a local folder on disk and returns a full compliance report. No network access is required.

**Input schema:**

```json
{
  "local_path": "string",          // absolute or relative path, e.g. /home/user/my-app or ./frontend
  "path_filter": "string | undefined", // glob to restrict scan, e.g. "src/components/**"
  "format": "json | markdown | pdf | excel", // output format, default "json"
  "output_path": "string | undefined" // absolute path for PDF/Excel output; defaults to timestamped file in system temp
}
```

**Output:** Same shape as `analyze_repo`. `meta.branch` is set to `"(local)"` and `meta.repo_url` contains the resolved absolute path.

---

### `analyze_repo`

Clones or fetches a repository, scans it, and returns a full compliance report.

**Input schema:**

```json
{
  "repo_url": "string",          // e.g. https://github.com/org/repo or https://gitlab.com/org/repo
  "token": "string | undefined", // PAT for private repos; omit for public anonymous access
  "branch": "string | undefined",// defaults to the repo's default branch
  "path_filter": "string | undefined", // glob to restrict scan, e.g. "src/components/**"
  "format": "json | markdown | pdf | excel", // output format, default "json"
  "output_path": "string | undefined" // absolute path for PDF/Excel output; defaults to timestamped file in system temp
}
```

**Output:** A `ReportResult` JSON object (`format: "json"`), a Markdown string (`format: "markdown"`), or a file path with a text summary (`format: "pdf"` or `format: "excel"`).

---

### `get_wcag_rule_detail`

Returns human-readable detail about a specific WCAG 2.2 criterion.

**Input schema:**

```json
{
  "criterion_id": "string" // e.g. "1.1.1", "2.4.7"
}
```

**Output:** Criterion name, level (A/AA/AAA), description, and links to the W3C spec.

---

## CLI (`a11y-scan`)

### Overview

The `a11y-scan` CLI (`src/a11y-scan.ts`, compiled to `dist/a11y-scan.js`) provides a standalone command that calls the same underlying analysis engine as the MCP tools — no MCP client or protocol overhead involved.

It is the recommended integration point for **build pipelines**, **pre-commit hooks**, and any non-AI automated workflow.

### Commands

```
a11y-scan scan <path>  [options]   Scan a local directory
a11y-scan repo <url>   [options]   Download and scan a remote repository
a11y-scan wcag <id>               Look up a WCAG 2.2 criterion
```

### Input schema

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--format` | `json\|markdown\|pdf\|excel` | `json` | Output format |
| `--output` | `string` | system temp | Save path for `pdf`/`excel` output |
| `--filter` | `string` | — | Glob to restrict scan (e.g. `src/components/**`) |
| `--token` | `string` | — | PAT for private GitHub/GitLab repos (`repo` only) |
| `--branch` | `string` | repo HEAD | Branch to scan (`repo` only) |
| `--fail-on` | `AA\|AAA` | — | Exit `1` if compliance is below this level |
| `--quiet` | flag | false | Suppress progress messages |

### Output

- The **report** is written to `stdout` in the requested format.
- **Progress messages** (file count, scan status, compliance result) are written to `stderr` and can be suppressed with `--quiet`.
- For `pdf` and `excel` formats, `stdout` contains only the saved file path.

### Exit codes

| Code | Condition |
|------|-----------|
| `0` | Scan completed; compliance meets `--fail-on` (or no `--fail-on` set) |
| `1` | Compliance is below the `--fail-on` threshold |
| `2` | Execution error (bad arguments, path not found, network failure) |

### `--fail-on` semantics

Compliance levels are ordered: `Non-compliant` < `Partial AA` < `AA` < `AAA`.

`--fail-on AA` exits `1` when `overall_level` is `Partial AA` or `Non-compliant`.
`--fail-on AAA` exits `1` unless `overall_level` is `AAA`.

The check is applied after the scan; the report is always printed regardless of outcome.

### Implementation notes

- The CLI imports the analysis building blocks directly (`discoverReactFiles`, `analyzeFiles`, `generateReport`, renderers) rather than going through the MCP server subprocess. This means a single scan pass, even when `--fail-on` is combined with a non-JSON `--format`.
- Tokens passed via `--token` are held in memory only for the duration of the command and are never written to disk or logged.
- For `repo` scans, the temporary directory is deleted in a `finally` block, including on error.

---

## Report Schema

```typescript
interface ReportResult {
  meta: {
    repo_url: string;
    branch: string;
    scanned_at: string;        // ISO 8601
    total_files_found: number;
    total_files_scanned: number;
  };

  summary: {
    overall_level: "AA" | "AAA" | "Partial AA" | "Non-compliant";
    aa_pass_rate: number;       // 0–100 percentage
    aaa_pass_rate: number;
    total_issues: number;
    issues_by_severity: {
      critical: number;         // WCAG A violations (break AA)
      serious: number;          // WCAG AA violations
      moderate: number;         // WCAG AAA violations
      minor: number;            // Best-practice deviations
    };
    issues_by_wcag_level: {
      A: number;
      AA: number;
      AAA: number;
    };
  };

  issues: Issue[];
}

interface Issue {
  id: string;                   // unique issue id (uuid)
  file: string;                 // repo-relative path
  line: number;
  column: number;
  rule_id: string;              // e.g. "jsx-a11y/alt-text"
  wcag_criterion: string;       // e.g. "1.1.1"
  wcag_level: "A" | "AA" | "AAA";
  severity: "critical" | "serious" | "moderate" | "minor";
  message: string;
  code_snippet: string;         // the offending JSX line(s)
  wcag_title: string;           // e.g. "Non-text Content"
  wcag_url: string;             // link to W3C criterion
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCP Client                               │
│              (Claude, claude-code, custom agent)                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  MCP Protocol (stdio / SSE)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server Layer                           │
│               (@modelcontextprotocol/sdk)                       │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ Tool: analyze_   │  │ Tool: analyze_   │  │ Tool: get_wcag_rule_     │  │
│  │ local_path       │  │ repo             │  │ detail                   │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────────────┘  │
└───────────┼─────────────────────┼────────────────────────────────────────────┘
            │                     │
            ▼                     ▼
┌────────────────────┐  ┌──────────────────────────────────────────────────┐
│  Local Orchestrator│  │              Remote Orchestrator                  │
│  (analyze-local.ts)│  │              (analyze-repo.ts)                    │
└──────┬─────────────┘  └────┬──────────────┬──────────────┬───────────────┘
       │                     │              │              │
       │               ┌─────┘         ┌───┘         ┌───┘
       ▼               ▼               ▼             ▼
  ┌────────────┐  ┌─────────┐   ┌────────────┐  ┌──────────────┐
  │   File     │  │  Repo   │   │   File     │  │   Analysis   │
  │ Discoverer │  │ Fetcher │   │ Discoverer │  │   Engine     │
  └─────┬──────┘  └─────────┘   └────────────┘  └──────────────┘
        │                                              │
        └──────────────────────────────────────────────┘
                                │
                                ▼
                      ┌──────────────────┐
                      │  Report Generator│
                      └──────────────────┘
```

### Component Detail

#### Repo Fetcher

Responsible for obtaining the source files from a remote repository.

- Detects host (GitHub vs GitLab) from the URL
- Uses the respective REST API client to download a zip archive of the target branch — avoids a full `git clone` and reduces disk I/O
- Falls back to `simple-git` shallow clone if the archive endpoint is unavailable (e.g. self-hosted GitLab)
- Authenticates via `Authorization: Bearer <token>` header; omits header for anonymous access
- Extracts to a temporary directory; cleans up after the scan completes
- Libraries: `@octokit/rest` (GitHub), native `fetch` (GitLab), `simple-git`, `adm-zip`, `tmp-promise`

#### File Discoverer

- Walks the extracted directory tree using `fast-glob`
- Primary filter: `**/*.{jsx,tsx}`
- Secondary filter for `.js` and `.ts` files: reads first 4 KB, checks for JSX heuristics (presence of `import React`, `<` followed by an uppercase identifier, `JSX.Element` return type)
- Respects `.gitignore` and excludes `node_modules`, `dist`, `build`, `.next`, `coverage`
- Applies optional `path_filter` from tool input
- Libraries: `fast-glob`, `ignore`

#### Analysis Engine

The core of the scanner. Runs two passes per file.

**Pass 1 — ESLint static analysis**

- Runs ESLint programmatically (Node API, not shelling out)
- Parser: `@typescript-eslint/parser` with JSX enabled
- Plugin: `eslint-plugin-jsx-a11y` with all rules set to `error`
- Each lint message is mapped to a WCAG 2.2 criterion and level via a rule-to-WCAG mapping table maintained in the codebase
- Libraries: `eslint`, `eslint-plugin-jsx-a11y`, `@typescript-eslint/parser`

**Pass 2 — Custom AST checks**

Handles gaps not covered by `jsx-a11y`:

- `<Link>` and `<NavLink>` (React Router) without discernible text
- `role` + `aria-*` mismatches (e.g. `role="button"` without `onKeyDown`)
- Interactive elements without visible focus indicator patterns (detects `outline: none` in inline style props)
- Missing `<title>` or `aria-label` on SVG elements
- `<table>` without `<caption>` or `summary`
- `<iframe>` without `title`
- Libraries: `@babel/parser`, `@babel/traverse`

**WCAG 2.2 Rule Coverage (planned for v1):**

| Criterion | Level | Check method |
|-----------|-------|-------------|
| 1.1.1 Non-text Content | A | eslint-plugin-jsx-a11y/alt-text |
| 1.3.1 Info and Relationships | A | role/aria attribute checks |
| 1.3.5 Identify Input Purpose | AA | autocomplete attribute check |
| 2.1.1 Keyboard | A | custom AST (onClick without onKeyDown) |
| 2.4.3 Focus Order | A | tabIndex > 0 detection |
| 2.4.6 Headings and Labels | AA | heading hierarchy check |
| 2.4.7 Focus Visible | AA | inline style outline:none check |
| 2.4.11 Focus Appearance (min) | AA | WCAG 2.2 new |
| 2.4.12 Focus Appearance | AAA | WCAG 2.2 new |
| 2.5.3 Label in Name | A | jsx-a11y/label-has-associated-control |
| 2.5.8 Target Size (min) | AA | WCAG 2.2 new — size prop heuristics |
| 3.1.1 Language of Page | A | html lang attribute check |
| 3.3.1 Error Identification | A | form error pattern check |
| 4.1.2 Name, Role, Value | A | jsx-a11y/aria-* rules |
| 4.1.3 Status Messages | AA | aria-live region check |

#### Report Generator

- Aggregates all `Issue` objects from the Analysis Engine
- Computes summary statistics: pass rates, issue counts by severity and WCAG level
- Determines `overall_level`:
  - `AAA` — zero issues at any level
  - `AA` — zero A and AA issues, some AAA
  - `Partial AA` — some A or AA issues present
  - `Non-compliant` — critical density above threshold (configurable)
- Serializes to the `ReportResult` JSON schema
- Renders a Markdown summary for human-readable output (`format: "markdown"`)
- Generates a multi-page formatted PDF via `pdfkit` with cover page, compliance banner, stats grid, and per-issue entries (`format: "pdf"`)
- Generates an Excel workbook via `exceljs` with three sheets (`format: "excel"`):
  - **Summary** — overall compliance metrics
  - **Issues** — all violations with colour-coded severity and auto-filter
  - **WCAG Coverage** — violations grouped by criterion

---

## Project Structure

```
a11y-static-scanner/
├── src/
│   ├── index.ts                  # MCP server entry point
│   ├── a11y-scan.ts                    # CLI entry point (a11y-scan binary)
│   ├── tools/
│   │   ├── analyze-repo.ts       # analyze_repo tool handler
│   │   └── wcag-detail.ts        # get_wcag_rule_detail tool handler
│   ├── fetcher/
│   │   ├── index.ts              # Fetcher interface
│   │   ├── github.ts             # GitHub API client
│   │   └── gitlab.ts             # GitLab API client
│   ├── discovery/
│   │   └── file-discoverer.ts    # File discovery logic
│   ├── analysis/
│   │   ├── engine.ts             # Orchestrates both passes
│   │   ├── eslint-pass.ts        # ESLint runner
│   │   ├── ast-pass.ts           # Custom Babel AST checks
│   │   └── wcag-map.ts           # rule ID → WCAG criterion mapping
│   ├── report/
│   │   ├── generator.ts          # ReportResult builder + Markdown renderer
│   │   ├── pdf-renderer.ts       # PDF report generation (pdfkit)
│   │   └── excel-renderer.ts     # Excel workbook generation (exceljs)
│   └── types.ts                  # Shared TypeScript types
├── tests/
│   ├── fixtures/                 # Sample React files for test cases
│   └── *.test.ts
├── package.json
├── tsconfig.json
└── spec.md
```

---

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server framework |
| `@octokit/rest` | GitHub REST API client |
| `simple-git` | Git clone fallback |
| `adm-zip` | Zip archive extraction |
| `fast-glob` | File system traversal |
| `ignore` | .gitignore parsing |
| `eslint` | Linting engine |
| `eslint-plugin-jsx-a11y` | JSX accessibility rules |
| `@typescript-eslint/parser` | TSX/JSX parsing for ESLint |
| `@babel/parser` | AST parsing for custom checks |
| `@babel/traverse` | AST traversal |
| `tmp-promise` | Temporary directory management |
| `zod` | Input schema validation |
| `uuid` | Issue ID generation |
| `pdfkit` | PDF report generation |
| `exceljs` | Excel workbook generation |

---

## Security Considerations

- Tokens are never logged or included in report output
- Temporary directories are deleted after each scan (including on error)
- Repository code is never executed — analysis is purely static
- Token scope required: `repo` (read-only) for GitHub; `read_repository` for GitLab
- Input URLs are validated against an allowlist of known hosts before any network call

---

## Open Questions / Future Work

- **v2: Runtime analysis** — Spin up a headless browser (Playwright), render components in a Storybook-like harness, run axe-core for contrast and dynamic a11y issues not detectable statically
- **Incremental scanning** — Cache results by file hash; re-scan only changed files (useful for large monorepos)
- **Remediation suggestions** — For each issue, generate a concrete code fix suggestion
- **CI integration** — GitHub Actions / GitLab CI job wrapper that calls this MCP tool and fails the build on AA violations
- **SARIF output** — Export issues in SARIF format for GitHub Advanced Security integration
