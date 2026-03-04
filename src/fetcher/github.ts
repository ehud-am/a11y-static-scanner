import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { dir } from 'tmp-promise';
import type { FetchedRepo, RepoFetcher } from '../types.js';

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const { pathname } = new URL(url);
  const parts = pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error(`Cannot parse owner/repo from GitHub URL: "${url}"`);
  }

  return { owner: parts[0], repo: parts[1] };
}

export class GitHubFetcher implements RepoFetcher {
  async fetch(url: string, token?: string, branch?: string): Promise<FetchedRepo> {
    const { owner, repo } = parseGitHubUrl(url);

    const octokit = new Octokit({ auth: token });

    if (!branch) {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      branch = data.default_branch;
    }

    const archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(archiveUrl, { headers, redirect: 'follow' });

    if (!response.ok) {
      throw new Error(
        `Failed to download GitHub archive for ${owner}/${repo}@${branch}: ` +
          `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const tmpDir = await dir({ unsafeCleanup: true });

    try {
      const zipPath = path.join(tmpDir.path, 'archive.zip');
      await fs.writeFile(zipPath, buffer);

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tmpDir.path, true);

      const entries = await fs.readdir(tmpDir.path);
      const subdir = entries.find((e) => e !== 'archive.zip');

      if (!subdir) {
        throw new Error('No extracted directory found in zip archive');
      }

      const localPath = path.join(tmpDir.path, subdir);

      return { localPath, branch, cleanup: tmpDir.cleanup };
    } catch (err) {
      await tmpDir.cleanup();
      throw err;
    }
  }
}
