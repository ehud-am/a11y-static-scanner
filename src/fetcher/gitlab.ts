import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { dir } from 'tmp-promise';
import type { FetchedRepo, RepoFetcher } from '../types.js';

function parseGitLabUrl(url: string): { host: string; projectPath: string } {
  const parsed = new URL(url);
  const host = `${parsed.protocol}//${parsed.host}`;
  const projectPath = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '');

  if (!projectPath) {
    throw new Error(`Cannot parse project path from GitLab URL: "${url}"`);
  }

  return { host, projectPath };
}

export class GitLabFetcher implements RepoFetcher {
  async fetch(url: string, token?: string, branch?: string): Promise<FetchedRepo> {
    const { host, projectPath } = parseGitLabUrl(url);
    const encodedPath = encodeURIComponent(projectPath);

    const baseHeaders: Record<string, string> = {};
    if (token) {
      baseHeaders['PRIVATE-TOKEN'] = token;
    }

    if (!branch) {
      const projectUrl = `${host}/api/v4/projects/${encodedPath}`;
      const projectRes = await fetch(projectUrl, { headers: baseHeaders });

      if (!projectRes.ok) {
        throw new Error(
          `Failed to fetch GitLab project info for "${projectPath}": ` +
            `HTTP ${projectRes.status} ${projectRes.statusText}`,
        );
      }

      const projectData = (await projectRes.json()) as { default_branch: string };
      branch = projectData.default_branch;

      if (!branch) {
        throw new Error(`GitLab project "${projectPath}" did not return a default_branch`);
      }
    }

    const archiveUrl =
      `${host}/api/v4/projects/${encodedPath}/repository/archive` +
      `?sha=${encodeURIComponent(branch)}&format=zip`;

    const archiveRes = await fetch(archiveUrl, { headers: baseHeaders, redirect: 'follow' });

    if (!archiveRes.ok) {
      throw new Error(
        `Failed to download GitLab archive for "${projectPath}@${branch}": ` +
          `HTTP ${archiveRes.status} ${archiveRes.statusText}`,
      );
    }

    const buffer = Buffer.from(await archiveRes.arrayBuffer());
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
