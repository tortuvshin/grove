import type { GithubMetadata } from "./schema.js";

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

export function parseGithubRepoUrl(url: string | undefined): GithubRepoRef | undefined {
  if (!url) return undefined;
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#].*)?$/i);
  if (!match) return undefined;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
  };
}

async function githubJson(path: string, token?: string): Promise<unknown | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "open-curated",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (response.status === 404) return null;
  if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze.");
  }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText} for ${path}`);
  }
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export async function fetchGithubMetadata(ref: GithubRepoRef, token = process.env.GITHUB_TOKEN): Promise<GithubMetadata | undefined> {
  const repo = asRecord(await githubJson(`/repos/${ref.owner}/${ref.repo}`, token));
  if (Object.keys(repo).length === 0) return undefined;

  const latestRelease = asRecord(await githubJson(`/repos/${ref.owner}/${ref.repo}/releases/latest`, token));
  const license = asRecord(repo.license);

  return {
    fullName: asString(repo.full_name),
    stars: asNumber(repo.stargazers_count) ?? 0,
    forks: asNumber(repo.forks_count) ?? 0,
    openIssues: asNumber(repo.open_issues_count),
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    pushedAt: asString(repo.pushed_at) ?? null,
    updatedAt: asString(repo.updated_at) ?? null,
    latestReleaseAt: asString(latestRelease.published_at) ?? null,
    license: asString(license.spdx_id) ?? asString(license.name) ?? null,
    topics: Array.isArray(repo.topics) ? repo.topics.filter((topic): topic is string => typeof topic === "string") : [],
    language: asString(repo.language) ?? null,
    defaultBranch: asString(repo.default_branch),
  };
}
