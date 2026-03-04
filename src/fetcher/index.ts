import type { RepoFetcher } from '../types.js';
import { GitHubFetcher } from './github.js';
import { GitLabFetcher } from './gitlab.js';

export function createFetcher(url: string): RepoFetcher {
  let hostname: string;

  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid repository URL: "${url}"`);
  }

  if (hostname === 'github.com') {
    return new GitHubFetcher();
  }

  if (hostname === 'gitlab.com' || hostname.includes('gitlab')) {
    return new GitLabFetcher();
  }

  throw new Error(
    `Unsupported host "${hostname}". Only github.com and GitLab instances are supported.`,
  );
}
