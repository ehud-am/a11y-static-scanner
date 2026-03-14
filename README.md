# a11y-static-scanner

An MCP (Model Context Protocol) server that audits React codebases for **WCAG 2.2 AA and AAA** accessibility compliance.

Point it at a GitHub or GitLab repo — public or private — **or at a local folder on disk** — and get back a structured report detailing every accessibility issue found via static analysis, mapped to the exact WCAG 2.2 success criterion.

---

## Installation & Setup

See **[INSTALL.md](INSTALL.md)** for the full operational guide, covering:

| Topic | Section |
|-------|---------|
| Install from source (Node.js 20+) | § 1 |
| CLI usage and build pipeline integration | § 2 |
| Docker deployment on macOS | § 3 |
| Claude Desktop and claude-code configuration | § 4 |
| Output formats (JSON, Markdown, PDF, Excel) | § 5 |
| Private repo authentication (GitHub / GitLab tokens) | § 6 |
| Verifying the installation | § 7 |
| Running the test suite | § 8 |

---

## Scanning Engine

Every file goes through **two independent passes**, each chosen for what it does best:

### Pass 1 — ESLint + `eslint-plugin-jsx-a11y`

[`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) is the de-facto standard for React accessibility linting. It covers 30+ WCAG-mapped rules and is used by Create React App, Next.js, and most large-scale React projects.

**Why it's the right tool here:**
- Rules are written by accessibility experts and vetted against the WCAG spec
- Handles JSX-specific patterns (prop spreading, conditional rendering, dynamic `className`) that generic HTML linters miss
- Produces precise file/line/column locations with actionable messages
- Actively maintained with WCAG 2.2 updates tracked

It catches the broad surface area: missing `alt` text, invalid ARIA roles and props, unlabelled form controls, inaccessible links, missing language attributes, and more.

### Pass 2 — Custom Babel AST analysis

ESLint rules are intentionally scoped and conservative — they avoid false positives by not reasoning across component boundaries or about inline styles. The custom Babel AST pass fills those gaps by walking the full JSX syntax tree with project-specific logic.

**Why Babel's parser is the right tool here:**
- Parses `.tsx`/`.jsx` with full fidelity — no transpilation, no execution
- Exposes the raw AST so checks can look at attribute values, child nodes, and style objects simultaneously
- Runs in the same process as the ESLint pass with no additional toolchain overhead

It catches patterns the ESLint plugin intentionally leaves out: SVGs rendered without accessible names, tables missing `<caption>`, focus outlines removed via inline styles (`outline: 'none'`), and `role="button"` elements missing keyboard handlers.

**Together, the two passes provide defence-in-depth:** ESLint covers breadth across the WCAG ruleset; the AST pass covers depth on the patterns most commonly introduced by React developers that slip past linting.

---

## Features

- **Two analysis passes per file**
  - ESLint pass with `eslint-plugin-jsx-a11y` (30+ rules)
  - Custom Babel AST pass for gaps not covered by the plugin (SVG names, table captions, focus outline removal, keyboard operability of `role="button"`, etc.)
- **Full WCAG 2.2 coverage** including the four new criteria: 2.4.11, 2.5.7, 2.5.8, 3.3.8
- **Three scan sources** — GitHub repos, GitLab repos, or a local folder on disk
- **GitHub and GitLab support** — public (anonymous) and private (token) repos
- **Four output formats** — structured JSON, human-readable Markdown, formatted PDF, or Excel workbook (.xlsx)
- **Zero execution of repo code** — purely static analysis
- **Two usage modes** — MCP server (for AI assistants) or `a11y-scan` CLI (for build pipelines)

---

## MCP Tools

### `analyze_local_path`

Scans a **local folder** already on disk and returns a compliance report. No network access required.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `local_path` | string | ✅ | Absolute or relative path to the folder (e.g. `/home/user/my-app` or `./frontend`) |
| `path_filter` | string | — | Glob to restrict scan (e.g. `src/components/**`) |
| `format` | `"json"` \| `"markdown"` \| `"pdf"` \| `"excel"` | — | Output format (default: `"json"`) |
| `output_path` | string | — | Absolute path for the saved file — only used with `"pdf"` or `"excel"`. Defaults to a timestamped file in the system temp directory. |

**Example prompts:**

```
Audit the React app in /Users/me/projects/my-app for accessibility issues
```

```
Run a WCAG 2.2 audit on ./frontend and save the results as a PDF at /tmp/report.pdf
```

---

### `analyze_repo`

Downloads and scans a repository, returning a compliance report.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `repo_url` | string | ✅ | Full HTTPS URL (e.g. `https://github.com/org/repo`) |
| `token` | string | — | Personal access token for private repos |
| `branch` | string | — | Branch to scan (defaults to repo default) |
| `path_filter` | string | — | Glob to restrict scan (e.g. `src/components/**`) |
| `format` | `"json"` \| `"markdown"` \| `"pdf"` \| `"excel"` | — | Output format (default: `"json"`) |
| `output_path` | string | — | Absolute path for the saved file — only used with `"pdf"` or `"excel"`. Defaults to a timestamped file in the system temp directory. |

**JSON report shape:**

```json
{
  "meta": {
    "repo_url": "https://github.com/org/repo",
    "branch": "main",
    "scanned_at": "2024-01-15T10:30:00.000Z",
    "total_files_found": 42,
    "total_files_scanned": 42
  },
  "summary": {
    "overall_level": "Partial AA",
    "aa_pass_rate": 72,
    "aaa_pass_rate": 60,
    "total_issues": 18,
    "issues_by_severity": { "critical": 5, "serious": 8, "moderate": 3, "minor": 2 },
    "issues_by_wcag_level": { "A": 10, "AA": 6, "AAA": 2 }
  },
  "issues": [
    {
      "id": "3f4a...",
      "file": "src/components/Hero.tsx",
      "line": 23,
      "column": 6,
      "rule_id": "jsx-a11y/alt-text",
      "wcag_criterion": "1.1.1",
      "wcag_level": "A",
      "severity": "critical",
      "message": "img elements must have an alt prop",
      "code_snippet": "<img src={heroImage} />",
      "wcag_title": "Non-text Content",
      "wcag_url": "https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html"
    }
  ]
}
```

**PDF and Excel output**

When `format` is `"pdf"` or `"excel"`, the tool writes the report to disk and returns the file path plus a text summary. The Excel workbook contains three sheets: **Summary** (overall compliance metrics), **Issues** (all violations with colour-coded severity and auto-filter), and **WCAG Coverage** (violations grouped by criterion).

**Overall level meanings:**

| Level | Meaning |
|-------|---------|
| `AAA` | Zero issues across all WCAG 2.2 criteria |
| `AA` | Zero A and AA violations; some AAA issues |
| `Partial AA` | Some A or AA violations detected |
| `Non-compliant` | High density of critical violations |

---

### `get_wcag_rule_detail`

Returns the full description and W3C documentation link for any WCAG 2.2 criterion.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `criterion_id` | string | ✅ | e.g. `"1.1.1"`, `"2.4.11"`, `"2.5.8"` |

---

## CLI (`a11y-scan`)

The `a11y-scan` command exposes the same analysis engine as a standalone CLI, designed for build pipelines, pre-commit hooks, and terminal use. No MCP client or AI assistant required.

### Commands

```
a11y-scan scan <path>  [options]     Scan a local directory
a11y-scan repo <url>   [options]     Download and scan a remote repository
a11y-scan wcag <id>                  Look up a WCAG 2.2 criterion
```

### Options

| Flag | Description |
|------|-------------|
| `--format <f>` | Output format: `json`, `markdown`, `pdf`, `excel` (default: `json`) |
| `--output <path>` | Save location for `pdf` / `excel` reports (default: system temp dir) |
| `--filter <glob>` | Restrict scan to matching files (e.g. `src/components/**`) |
| `--token <token>` | Personal access token for private GitHub / GitLab repos |
| `--branch <name>` | Branch to scan — `repo` command only (default: repo HEAD) |
| `--fail-on <level>` | Exit `1` if compliance is below `AA` or `AAA` |
| `--quiet` | Suppress progress messages; only print the report |
| `--version`, `-v` | Print version and exit |
| `--help`, `-h` | Print help and exit |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Scan completed; compliance meets `--fail-on` threshold (or no threshold set) |
| `1` | Compliance is **below** the `--fail-on` threshold — use this to fail the build |
| `2` | Execution error (bad arguments, path not found, network failure, etc.) |

> Progress messages go to **stderr**; the report goes to **stdout**. You can safely redirect or pipe stdout without capturing progress noise.

### Examples

```bash
# Fail the build if the project is not fully AA compliant
a11y-scan scan ./my-app --fail-on AA

# Print a Markdown report without saving a file
a11y-scan scan ./my-app --format markdown

# Scope the scan to one directory
a11y-scan scan ./my-app --filter "src/components/**" --fail-on AA

# Scan a public GitHub repo and save an Excel workbook
a11y-scan repo https://github.com/org/repo --format excel --output ./a11y.xlsx

# Scan a private repo on a specific branch
a11y-scan repo https://github.com/org/private \
  --token ghp_xxxxxxxxxxxx --branch staging --fail-on AA

# Look up WCAG 2.4.11
a11y-scan wcag 2.4.11
```

### GitHub Actions

```yaml
- name: Accessibility audit
  run: |
    node dist/a11y-scan.js scan ./src --format markdown --fail-on AA | tee a11y-report.md

- name: Upload accessibility report
  uses: actions/upload-artifact@v4
  with:
    name: a11y-report
    path: a11y-report.md
```

### GitLab CI

```yaml
a11y-audit:
  stage: test
  script:
    - node dist/a11y-scan.js scan ./src --format json --fail-on AA > a11y-report.json
  artifacts:
    paths:
      - a11y-report.json
```

---

## WCAG 2.2 Rule Coverage

### ESLint pass (`eslint-plugin-jsx-a11y`)

| Rule | WCAG Criterion | Level |
|------|---------------|-------|
| `alt-text` | 1.1.1 Non-text Content | A |
| `anchor-has-content` | 2.4.4 Link Purpose | A |
| `anchor-is-valid` | 2.4.4 Link Purpose | A |
| `aria-role` | 4.1.2 Name, Role, Value | A |
| `aria-props` | 4.1.2 Name, Role, Value | A |
| `click-events-have-key-events` | 2.1.1 Keyboard | A |
| `mouse-events-have-key-events` | 2.1.1 Keyboard | A |
| `interactive-supports-focus` | 2.1.1 Keyboard | A |
| `label-has-associated-control` | 1.3.1 Info and Relationships | A |
| `heading-has-content` | 1.3.1 Info and Relationships | A |
| `html-has-lang` | 3.1.1 Language of Page | A |
| `iframe-has-title` | 4.1.2 Name, Role, Value | A |
| `tabindex-no-positive` | 2.4.3 Focus Order | A |
| `autocomplete-valid` | 1.3.5 Identify Input Purpose | AA |
| … and 16 more | | |

### AST pass (custom Babel checks)

| Check | WCAG Criterion | Level |
|-------|---------------|-------|
| SVG without `aria-label`/`aria-labelledby`/`<title>` | 1.1.1 | A |
| `<table>` without `<caption>` or `aria-label` | 1.3.1 | A |
| `onClick` on non-interactive element without keyboard handler | 2.1.1 | A |
| `role="button"` without `onKeyDown`/`tabIndex` | 2.1.1 | A |
| Inline `style={{ outline: 'none' }}` or `{{ outline: 0 }}` | 2.4.7 | AA |

---

## Architecture

```
┌──────────────────────────────────────┐   ┌────────────────────────────────┐
│  MCP Client                          │   │  CLI  (src/a11y-scan.ts)             │
│  (Claude / claude-code / agent)      │   │  a11y-scan scan / repo / wcag  │
└──────────────────┬───────────────────┘   └───────────────┬────────────────┘
                   │  stdio / SSE                          │  direct import
                   ▼                                       │
          ┌────────────────┐                               │
          │  MCP Server    │                               │
          │  src/index.ts  │                               │
          └───────┬────────┘                               │
                  │                                        │
        ┌─────────┴──────────────────────────────────────┐│
        │                Analysis Engine                  ││
        │                                                 ││
        │  Repo Fetcher ──► File Discoverer ──► ESLint   ◄┘│
        │  (GitHub/GitLab)  (fast-glob +       + Babel   │
        │                    JSX heuristics)   AST pass  │
        │                                         │       │
        │                                  Report Generator
        │                                  (JSON / Markdown /
        │                                   PDF / Excel)
        └─────────────────────────────────────────────────┘
```

Both the MCP server and the CLI call the same underlying modules — there is no duplication of analysis logic.

---

## Development

```bash
npm install
npm run dev          # Run MCP server in development mode (tsx, no build needed)
npm run dev:cli      # Run CLI in development mode (tsx, no build needed)
npm run build        # Compile TypeScript → dist/
npm test             # Run full test suite
npm run test:watch   # Watch mode
npm run typecheck    # Type-check without emitting
```

---

## Project Structure

```
src/
├── index.ts                  # MCP server entry point
├── a11y-scan.ts                    # CLI entry point (a11y-scan binary)
├── types.ts                  # Shared TypeScript interfaces
├── tools/
│   ├── analyze-local.ts      # analyze_local_path handler + Zod schema
│   ├── analyze-repo.ts       # analyze_repo handler + Zod schema
│   └── wcag-detail.ts        # get_wcag_rule_detail handler
├── fetcher/
│   ├── index.ts              # Factory: GitHub vs GitLab detection
│   ├── github.ts             # GitHub zip archive download
│   └── gitlab.ts             # GitLab zip archive download
├── discovery/
│   └── file-discoverer.ts    # React file discovery with JSX heuristics
├── analysis/
│   ├── wcag-map.ts           # WCAG criterion DB + rule→WCAG mapping
│   ├── eslint-pass.ts        # Programmatic ESLint runner
│   ├── ast-pass.ts           # Custom Babel AST checks
│   └── engine.ts             # Orchestrates both passes (concurrency-limited)
└── report/
    ├── generator.ts          # Builds ReportResult + Markdown renderer
    ├── pdf-renderer.ts       # PDF report generation (pdfkit)
    └── excel-renderer.ts     # Excel workbook generation (exceljs)

tests/
├── fixtures/
│   ├── good-component.tsx    # Fully accessible component (zero critical issues)
│   ├── bad-component.tsx     # Many deliberate violations
│   └── mixed-component.tsx   # Partially accessible
├── wcag-map.test.ts
├── file-discoverer.test.ts
├── analysis-engine.test.ts
├── report-generator.test.ts
└── mcp-server.test.ts        # Integration tests (mocked network)
```
