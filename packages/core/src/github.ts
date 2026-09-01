import type { GithubMetadata } from './schema.js';

export interface GithubRepoRef {
  owner: string;
  repo: string;
}

export function parseGithubRepoUrl(url: string | undefined): GithubRepoRef | undefined {
  if (!url) return undefined;
  const match = url.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/#?\s]+)(?:[/?#].*)?$/i);
  if (!match) return undefined;
  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return undefined;
  return {
    owner,
    repo: repo.replace(/\.git$/, ''),
  };
}

async function githubJson(path: string, token?: string): Promise<unknown | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'grove',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (response.status === 404) return null;
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    throw new Error('GitHub API rate limit reached. Set GITHUB_TOKEN and rerun analyze.');
  }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} ${response.statusText} for ${path}`);
  }
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Resolve a GitHub token from the environment. `GH_TOKEN` is checked
 * first because that is the name the GitHub CLI and the scaffolded
 * workflows use; `GITHUB_TOKEN` is the Actions-provided name. Reading
 * only one of the two meant `sync-github.yml` — which passes
 * `GH_TOKEN` — silently ran unauthenticated.
 */
export function resolveGithubToken(): string | undefined {
  return process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? undefined;
}

export async function fetchGithubMetadata(
  ref: GithubRepoRef,
  token = resolveGithubToken(),
): Promise<GithubMetadata | undefined> {
  const repo = asRecord(await githubJson(`/repos/${ref.owner}/${ref.repo}`, token));
  if (Object.keys(repo).length === 0) return undefined;

  const latestRelease = asRecord(
    await githubJson(`/repos/${ref.owner}/${ref.repo}/releases/latest`, token),
  );
  const license = asRecord(repo.license);

  return {
    fullName: asString(repo.full_name),
    stars: asNumber(repo.stargazers_count) ?? 0,
    forks: asNumber(repo.forks_count) ?? 0,
    openIssues: asNumber(repo.open_issues_count),
    watchers: asNumber(repo.watchers_count),
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    private: Boolean(repo.private),
    fork: Boolean(repo.fork),
    visibility: asString(repo.visibility),
    pushedAt: asString(repo.pushed_at) ?? null,
    updatedAt: asString(repo.updated_at) ?? null,
    createdAt: asString(repo.created_at) ?? null,
    latestReleaseAt: asString(latestRelease.published_at) ?? null,
    license: asString(license.spdx_id) ?? asString(license.name) ?? null,
    topics: Array.isArray(repo.topics)
      ? repo.topics.filter((topic): topic is string => typeof topic === 'string')
      : [],
    language: asString(repo.language) ?? null,
    defaultBranch: asString(repo.default_branch),
    htmlUrl: asString(repo.html_url),
    description: asString(repo.description),
    homepage: asString(repo.homepage),
    size: asNumber(repo.size),
  };
}

/**
 * Build the patch that `sync github` writes to `record.github`.
 *
 * Merges fetched metadata into the existing `record.github.repository`
 * block rather than replacing it — sync only owns the fields it
 * explicitly writes. Every other field (curator-written `description`,
 * once-fetched `id`/`node_id`, manually-added metadata, etc.) survives.
 *
 * `latestReleaseAt` and `homepage` live at the top level of `github`
 * (the schema's `githubMetadataSchema` shape), not nested inside
 * `repository`.
 */
export function buildGithubSyncPatch(
  metadata: GithubMetadata,
  existingGithub: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const existingRepository =
    (existingGithub?.repository as Record<string, unknown> | undefined) ?? {};
  const patch: Record<string, unknown> = {
    repository: {
      ...existingRepository,
      full_name: metadata.fullName,
      stargazers_count: metadata.stars,
      forks_count: metadata.forks,
      open_issues_count: metadata.openIssues,
      language: metadata.language,
      pushed_at: metadata.pushedAt,
      updated_at: metadata.updatedAt,
      archived: metadata.archived,
      disabled: metadata.disabled,
      default_branch: metadata.defaultBranch,
      license: metadata.license ? { spdx_id: metadata.license, name: metadata.license } : null,
      topics: metadata.topics,
    },
  };
  if (metadata.latestReleaseAt) {
    patch.latestReleaseAt = metadata.latestReleaseAt;
  }
  if (metadata.homepage) {
    patch.homepage = metadata.homepage;
  }
  return patch;
}

/**
 * Fields under `record.github` that an older `sync github` wrote but
 * that nothing reads today. `github.languages` and
 * `github.activity.monthlyCommits` are still read by the astro
 * package's record page and are deliberately not in this list.
 * `github.latestRelease` in particular is the full GitHub REST
 * "latest release" response — its `assets` array alone can run to
 * tens of KB per record — so a record that was ever synced by that
 * older version carries it forward on every re-run unless something
 * drops it.
 */
const LEGACY_GITHUB_FIELDS = ['latestRelease', 'files', 'labels'] as const;

/**
 * Drop the fields in {@link LEGACY_GITHUB_FIELDS} from a record's
 * existing `github` block before `sync github` merges its patch on
 * top. Self-heals a record on its next sync instead of letting the
 * dead weight compound — everything else (including keys `sync`
 * doesn't know about) passes through untouched.
 */
export function pruneLegacyGithubFields(
  existingGithub: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const pruned = { ...existingGithub };
  for (const field of LEGACY_GITHUB_FIELDS) delete pruned[field];
  return pruned;
}
