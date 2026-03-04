# Installation Guide

## Prerequisites

- **Node.js 20+** (required for native `fetch` and `fs.promises` APIs)
- **npm 9+**
- An MCP client ([Claude Desktop](https://claude.ai/download), [claude-code](https://github.com/anthropics/claude-code), etc.) **or** use the `a11y-scan` CLI directly — no AI client required

---

## 1 — Install from source

```bash
git clone https://github.com/your-org/a11y-static-scanner
cd a11y-static-scanner
npm install
npm run build
```

Verify the build:

```bash
node dist/index.js --help
# → [a11y-static-scanner] Server running on stdio

node dist/a11y-scan.js --help
# → a11y-scan — WCAG 2.2 accessibility audit for React codebases …
```

The MCP server is at `dist/index.js`; the CLI is at `dist/a11y-scan.js`.

---

## 2 — Use the CLI (`a11y-scan`)

The `a11y-scan` CLI exposes the same analysis engine without requiring any MCP client or AI assistant. It is designed for build pipelines, pre-commit hooks, and terminal use.

### Run directly

```bash
# Scan a local project and fail the build if it is not AA compliant
node dist/a11y-scan.js scan ./my-app --fail-on AA

# Print a Markdown summary to stdout
node dist/a11y-scan.js scan ./my-app --format markdown

# Scan a remote GitHub repo, save an Excel report
node dist/a11y-scan.js repo https://github.com/org/repo --format excel --output ./a11y.xlsx

# Look up WCAG criterion 2.4.11
node dist/a11y-scan.js wcag 2.4.11
```

### Link globally (optional)

`npm link` registers both binaries (`a11y-static-scanner` and `a11y-scan`) in your PATH:

```bash
npm link
a11y-scan scan ./my-app --fail-on AA
```

### Development mode (no build step)

```bash
npm run dev:cli -- scan ./my-app --format markdown
```

### All options

| Flag | Description |
|------|-------------|
| `--format <f>` | `json` (default), `markdown`, `pdf`, `excel` |
| `--output <path>` | Save path for `pdf` / `excel` (default: system temp dir) |
| `--filter <glob>` | Restrict scan, e.g. `"src/components/**"` |
| `--token <token>` | PAT for private GitHub / GitLab repos |
| `--branch <name>` | Branch to scan (`repo` only; default: repo HEAD) |
| `--fail-on <level>` | Exit `1` if compliance is below `AA` or `AAA` |
| `--quiet` | Suppress progress messages (report still goes to stdout) |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success — compliance meets `--fail-on` threshold (or no threshold set) |
| `1` | Compliance is **below** the `--fail-on` threshold — **fail the build** |
| `2` | Execution error (bad args, path not found, network error, etc.) |

> Progress messages go to **stderr**; the report goes to **stdout**. You can safely redirect or pipe stdout without capturing progress noise.

### Build pipeline integration

**GitHub Actions**

```yaml
jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install a11y-static-scanner
        run: |
          git clone https://github.com/your-org/a11y-static-scanner /tmp/a11y
          cd /tmp/a11y && npm ci && npm run build

      - name: Accessibility audit
        run: |
          node /tmp/a11y/dist/a11y-scan.js scan ./src \
            --format markdown \
            --fail-on AA \
            --quiet \
            > a11y-report.md

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: a11y-report
          path: a11y-report.md
```

**GitLab CI**

```yaml
a11y-audit:
  stage: test
  image: node:20
  before_script:
    - git clone https://github.com/your-org/a11y-static-scanner /tmp/a11y
    - cd /tmp/a11y && npm ci && npm run build
  script:
    - node /tmp/a11y/dist/a11y-scan.js scan ./src --format json --fail-on AA > a11y-report.json
  artifacts:
    paths:
      - a11y-report.json
    when: always
```

**Pre-commit hook** (`.git/hooks/pre-commit`)

```bash
#!/usr/bin/env bash
set -e
node /path/to/a11y-static-scanner/dist/a11y-scan.js scan ./src --fail-on AA --quiet
```

---

## 3 — Configure your MCP client

### Claude Desktop (`claude_desktop_config.json`)

Open your Claude Desktop configuration file:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add the server entry under `mcpServers`:

```json
{
  "mcpServers": {
    "a11y-static-scanner": {
      "command": "node",
      "args": ["/absolute/path/to/a11y-static-scanner/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see `a11y-static-scanner` listed under **Connected MCP Servers**.

---

### claude-code (CLI)

Add to your project's `.mcp.json` or to the global configuration at `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "a11y-static-scanner": {
      "command": "node",
      "args": ["/absolute/path/to/a11y-static-scanner/dist/index.js"]
    }
  }
}
```

Or register it directly from the command line:

```bash
claude mcp add a11y-static-scanner -- node /absolute/path/to/a11y-static-scanner/dist/index.js
```

---

### Development mode (no build step)

If you want to run the server without building first (useful during development):

```json
{
  "mcpServers": {
    "a11y-static-scanner": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/a11y-static-scanner/src/index.ts"]
    }
  }
}
```

This uses `tsx` to run the TypeScript source directly.

---

## 4 — Output formats

Both `analyze_local_path` and `analyze_repo` support four output formats via the `format` parameter:

| Format | Description |
|--------|-------------|
| `json` | Structured `ReportResult` object (default) |
| `markdown` | Human-readable text summary |
| `pdf` | Formatted multi-page PDF saved to disk |
| `excel` | Excel workbook (.xlsx) with three sheets saved to disk |

For `pdf` and `excel`, the tool returns the saved file path plus a brief text summary. By default the file is written to a timestamped path in the system temp directory. Use `output_path` to specify a custom location:

```
Scan https://github.com/org/repo and save the report as a PDF at /tmp/my-report.pdf
```

```
Audit the local folder /Users/me/my-app and save the report as an Excel file at /tmp/my-report.xlsx
```

The Excel workbook contains three sheets: **Summary** (compliance metrics), **Issues** (all violations with colour-coded severity and auto-filter), and **WCAG Coverage** (violations grouped by WCAG criterion).

---

## 5 — Authenticate with private repositories

Tokens are passed per-call as the `token` parameter — they are **never stored** by the server.

### GitHub personal access token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Create a token with **Contents: Read-only** permission on the target repository
3. Pass it as `token` when calling `analyze_repo`:

```
Analyse https://github.com/my-org/my-private-repo using token ghp_xxxx
```

### GitLab personal access token

1. Go to **GitLab → User Settings → Access Tokens**
2. Create a token with the `read_repository` scope
3. Pass it as `token` when calling `analyze_repo`

---

## 6 — Verify installation

Ask Claude (or your MCP client):

```
What MCP tools are available?
```

You should see `analyze_local_path`, `analyze_repo`, and `get_wcag_rule_detail` listed.

Run a quick test against a local folder:

```
Run an accessibility audit on /path/to/any/react/project
```

Or against a public repo:

```
Run an accessibility audit on https://github.com/facebook/create-react-app
```

---

## 7 — Run the test suite

```bash
npm test                   # One-time run
npm run test:watch         # Watch mode during development
npm run test:coverage      # Coverage report (HTML output in coverage/)
```

Expected output:

```
✓ tests/wcag-map.test.ts (11)
✓ tests/file-discoverer.test.ts (9)
✓ tests/analysis-engine.test.ts (17)
✓ tests/report-generator.test.ts (14)
✓ tests/mcp-server.test.ts (12)

Test Files  5 passed (5)
Tests       63 passed (63)
```

---

## Troubleshooting

**`Cannot find module '@modelcontextprotocol/sdk'`**
→ Run `npm install` to install dependencies.

**`Error: Unsupported host "github.com"`**
→ This should not happen. File an issue — it means the URL parser returned an unexpected hostname.

**`HTTP 404` when scanning a private repo**
→ Your token does not have access to the repository, or the repo URL is incorrect.

**`HTTP 401` when scanning a private repo**
→ Your token is invalid or expired. Generate a new one.

**ESLint parse errors on valid files**
→ The `@typescript-eslint/parser` supports all TSX/JSX syntax. If you see parse errors, the file may use a very new syntax feature. Open an issue with the file contents.

**The server produces no output on stdio**
→ The server only writes to `stderr` (startup message) and responds to MCP JSON-RPC on `stdout`. No output on stdout during startup is expected behaviour.

**`a11y-scan: command not found`**
→ Run `npm link` from the project root, or call the binary directly: `node dist/a11y-scan.js`.

**CLI exits with code `2` unexpectedly**
→ Check stderr for the error message. Code `2` always indicates a usage or execution error, not a compliance failure (that is code `1`).

**Want CI to always upload the report even when the scan fails**
→ In GitHub Actions add `if: always()` to the upload step. In GitLab CI set `when: always` on the artifact.

---

## Token security

- Tokens are passed as call arguments and are **never logged to disk or stored**
- The server writes only to `stderr` for diagnostics; no tokens appear there
- Temporary directories used during analysis are deleted immediately after each scan (including on error)
- The server never executes any code from the scanned repository — analysis is entirely static
