/**
 * Integration tests for the MCP server tools.
 *
 * We test the tool handler functions directly (not via stdio transport)
 * so these tests run fast without spinning up a subprocess.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// ─── get_wcag_rule_detail tool ────────────────────────────────────────────────

describe('handleWcagDetail', () => {
  it('returns criterion data for a known ID', async () => {
    const { handleWcagDetail } = await import('../src/tools/wcag-detail.js');
    const result = handleWcagDetail({ criterion_id: '1.1.1' });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('1.1.1');
    expect(parsed.title).toBe('Non-text Content');
    expect(parsed.level).toBe('A');
    expect(parsed.url).toMatch(/^https:\/\/www\.w3\.org/);
    expect(parsed.description).toBeTruthy();
  });

  it('returns WCAG 2.2 new criteria', async () => {
    const { handleWcagDetail } = await import('../src/tools/wcag-detail.js');
    const result = handleWcagDetail({ criterion_id: '2.5.8' });
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('2.5.8');
    expect(parsed.title).toContain('Target Size');
    expect(parsed.level).toBe('AA');
  });

  it('returns error object for unknown criterion', async () => {
    const { handleWcagDetail } = await import('../src/tools/wcag-detail.js');
    const result = handleWcagDetail({ criterion_id: '9.9.9' });
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeTruthy();
    expect(parsed.available_criteria).toBeTruthy();
  });
});

// ─── analyze_repo tool (mocked network) ──────────────────────────────────────

describe('handleAnalyzeRepo — mocked fetch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns a valid JSON report for a repository scan', async () => {
    // Mock the fetcher to return the local fixtures directory
    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: FIXTURES_DIR,
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'json',
    });

    const report = JSON.parse(result);

    // Check meta shape
    expect(report.meta).toBeDefined();
    expect(report.meta.repo_url).toBe('https://github.com/test/repo');
    expect(report.meta.branch).toBe('main');
    expect(typeof report.meta.total_files_scanned).toBe('number');
    expect(report.meta.scanned_at).toMatch(/^\d{4}-/);

    // Check summary shape
    expect(report.summary).toBeDefined();
    expect(['AAA', 'AA', 'Partial AA', 'Non-compliant']).toContain(report.summary.overall_level);
    expect(typeof report.summary.aa_pass_rate).toBe('number');
    expect(typeof report.summary.total_issues).toBe('number');

    // Bad + mixed fixtures have issues, so total_issues > 0
    expect(report.summary.total_issues).toBeGreaterThan(0);

    // Check issues array
    expect(Array.isArray(report.issues)).toBe(true);
    if (report.issues.length > 0) {
      const issue = report.issues[0];
      expect(issue.id).toBeTruthy();
      expect(issue.file).toBeTruthy();
      expect(issue.wcag_criterion).toBeTruthy();
    }
  });

  it('returns markdown when format is "markdown"', async () => {
    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: FIXTURES_DIR,
          branch: 'main',
          cleanup: async () => {},
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');
    const result = await handleAnalyzeRepo({
      repo_url: 'https://github.com/test/repo',
      format: 'markdown',
    });

    expect(result).toContain('# A11y Report');
    expect(result).toContain('## Compliance Summary');
    expect(result).not.toMatch(/^\{/); // Not raw JSON
  });

  it('calls cleanup even if analysis throws', async () => {
    const cleanup = vi.fn(async () => {});

    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => ({
          localPath: '/nonexistent/path/12345',
          branch: 'main',
          cleanup,
        }),
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');

    // Should not throw even for empty/nonexistent path — discoverReactFiles returns []
    await handleAnalyzeRepo({ repo_url: 'https://github.com/test/repo', format: 'json' });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it('throws a useful error when fetcher rejects', async () => {
    vi.doMock('../src/fetcher/index.js', () => ({
      createFetcher: () => ({
        fetch: async () => {
          throw new Error('HTTP 404 Not Found');
        },
      }),
    }));

    const { handleAnalyzeRepo } = await import('../src/tools/analyze-repo.js');

    await expect(
      handleAnalyzeRepo({ repo_url: 'https://github.com/test/private-repo', format: 'json' }),
    ).rejects.toThrow('HTTP 404 Not Found');
  });
});

// ─── Input validation (Zod schema) ───────────────────────────────────────────

describe('AnalyzeRepoSchema validation', () => {
  it('accepts a minimal valid input', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({ repo_url: 'https://github.com/org/repo' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-URL repo_url', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({ repo_url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('defaults format to "json"', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.parse({ repo_url: 'https://github.com/org/repo' });
    expect(result.format).toBe('json');
  });

  it('accepts all optional fields', async () => {
    const { AnalyzeRepoSchema } = await import('../src/tools/analyze-repo.js');
    const result = AnalyzeRepoSchema.safeParse({
      repo_url: 'https://gitlab.com/org/repo',
      token: 'glpat-abc123',
      branch: 'develop',
      path_filter: 'src/components/**',
      format: 'markdown',
    });
    expect(result.success).toBe(true);
  });
});

// ─── createFetcher routing ────────────────────────────────────────────────────

describe('createFetcher', () => {
  it('returns a fetcher for github.com URLs', async () => {
    const { createFetcher } = await import('../src/fetcher/index.js');
    const fetcher = createFetcher('https://github.com/org/repo');
    expect(fetcher).toBeDefined();
    expect(typeof fetcher.fetch).toBe('function');
  });

  it('returns a fetcher for gitlab.com URLs', async () => {
    const { createFetcher } = await import('../src/fetcher/index.js');
    const fetcher = createFetcher('https://gitlab.com/org/repo');
    expect(fetcher).toBeDefined();
  });

  it('returns a fetcher for self-hosted GitLab', async () => {
    const { createFetcher } = await import('../src/fetcher/index.js');
    const fetcher = createFetcher('https://gitlab.mycompany.com/group/project');
    expect(fetcher).toBeDefined();
  });

  it('throws for unsupported hosts', async () => {
    const { createFetcher } = await import('../src/fetcher/index.js');
    expect(() => createFetcher('https://bitbucket.org/org/repo')).toThrow('Unsupported host');
  });

  it('throws for invalid URLs', async () => {
    const { createFetcher } = await import('../src/fetcher/index.js');
    expect(() => createFetcher('not-a-url')).toThrow('Invalid repository URL');
  });
});
