---
name: a11y-static-scanner
description: >
  Run WCAG 2.2 AA/AAA accessibility audits on React codebases — local folders, GitHub repos, or GitLab repos.
  Use this skill whenever the user mentions: accessibility audit, a11y, WCAG, accessibility compliance,
  accessibility violations, screen reader support, checking a React app for accessibility, auditing a
  codebase for ARIA issues, or wants to know if a project meets accessibility standards.
  Also trigger when the user asks to "scan" or "check" a repo/folder for accessibility, wants an accessibility
  report in PDF or Excel format, or asks about a specific WCAG criterion. If the user has a React project
  and mentions accessibility in any form, use this skill — don't wait for the exact phrase "WCAG audit".
---

# a11y-static-scanner

Static WCAG 2.2 AA/AAA accessibility auditing for React codebases via two analysis passes:
1. **ESLint pass** — `eslint-plugin-jsx-a11y` (30+ rules)
2. **Custom Babel AST pass** — SVG labels, table captions, focus outline removal, keyboard operability, etc.

No code is executed — analysis is entirely static.

## Choosing the right tool

| Situation | Tool |
|-----------|------|
| Project already on local disk | `analyze_local_path` |
| GitHub or GitLab repo URL | `analyze_repo` |
| User asks about a specific WCAG rule | `get_wcag_rule_detail` |

## `analyze_local_path` — scan a local folder

Use when the project is already on the filesystem (the common case in Claude Code).

```
local_path   (required) — absolute or relative path, e.g. /home/me/my-app or ./frontend
path_filter  (optional) — glob to scope the scan, e.g. "src/components/**"
format       (optional) — "json" (default) | "markdown" | "pdf" | "excel"
output_path  (optional) — absolute save path for pdf/excel; defaults to system temp
```

**When to use `path_filter`:** large monorepos, or when the user only cares about a specific subtree.

**Example prompts that should trigger this:**
- "Audit the React app in /Users/me/projects/my-app for accessibility"
- "Check my frontend folder for WCAG violations"
- "Run an a11y scan on ./src and save the results as a PDF"

## `analyze_repo` — scan a remote repo

Use when the user provides a GitHub or GitLab URL.

```
repo_url     (required) — full HTTPS URL, e.g. https://github.com/org/repo
token        (optional) — PAT for private repos (never log or store it)
branch       (optional) — defaults to repo default branch
path_filter  (optional) — glob to scope the scan
format       (optional) — "json" | "markdown" | "pdf" | "excel"
output_path  (optional) — absolute save path for pdf/excel
```

**Private repos:** the user must provide their own token. Accept it as-is and pass it through — never echo it back in output.

**Example prompts:**
- "Run a WCAG 2.2 audit on https://github.com/facebook/react and give me an Excel report"
- "Check accessibility on my private GitLab repo using token glpat-xxxx"

## `get_wcag_rule_detail` — look up a criterion

Use when the user asks what a specific WCAG rule means, or when explaining a violation found in a report.

```
criterion_id (required) — e.g. "1.1.1", "2.4.11", "2.5.8"
```

After a scan, proactively offer to explain any unfamiliar criterion IDs from the results.

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Programmatic use, further processing (default) |
| `markdown` | Readable summary in chat |
| `pdf` | Sharing a polished report |
| `excel` | Stakeholder reporting — three sheets: Summary, Issues, WCAG Coverage |

Default to `json` unless the user asks for something else. If they say "give me a report", prefer `markdown` for quick sharing in chat, or ask if they'd like a PDF/Excel file.

## Interpreting results

**Overall compliance levels:**

| Level | Meaning |
|-------|---------|
| `AAA` | Zero issues across all WCAG 2.2 criteria |
| `AA` | Zero A and AA violations; some AAA issues |
| `Partial AA` | Some Level A or AA violations present |
| `Non-compliant` | High density of critical violations |

**Severity mapping:**

| Severity | WCAG Level | Impact |
|----------|-----------|--------|
| `critical` | A | Blocks AA compliance |
| `serious` | AA | Breaks AA compliance |
| `moderate` | AAA | Below AAA |
| `minor` | — | Best-practice deviations |

## Presenting results to the user

After a scan, always summarize:
1. Overall compliance level and what it means
2. Total issue count broken down by severity
3. The top 3–5 most critical violations (file, line, message, WCAG criterion)
4. Offer to explain any WCAG criterion using `get_wcag_rule_detail`
5. For `json` output, offer to reformat as `markdown`, `pdf`, or `excel` if the user wants to share the report

If the scan returns zero issues, confirm that all scanned React files passed both ESLint and AST passes.

## Scope and limitations

**What this scanner covers:**
- JSX/TSX files and `.js`/`.ts` files with JSX heuristics
- Missing alt text, ARIA attributes, keyboard handlers, focus indicators, form labels, lang attributes, table captions, SVG accessibility

**What it does NOT cover (out of scope):**
- Color contrast (requires computed styles — not available statically)
- Runtime/dynamic behavior (screen reader announcements, focus management)
- Non-React frameworks (Vue, Angular, Svelte)
- CSS-in-JS or external stylesheets (only inline `style` prop checks)

If the user asks about something outside this scope, explain the limitation and suggest a runtime tool like axe-core or browser-based testing.
