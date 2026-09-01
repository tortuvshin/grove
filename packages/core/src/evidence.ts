import { enrichFromGithubHtml } from './enrich.js';
import { fetchGithubMetadata, parseGithubRepoUrl, resolveGithubToken } from './github.js';
import { pLimit } from './github-client.js';
import type { GithubMetadata } from './schema.js';

export type RepositoryFetchStatus = 'ok' | 'not-found' | 'invalid-url' | 'rate-limited' | 'error';

export interface RepositoryEvidence {
  requestedUrl: string;
  status: RepositoryFetchStatus;
  identity?: { owner: string; repo: string };
  canonicalUrl?: string;
  redirected: boolean;
  source: 'api' | 'html' | 'none';
  github?: GithubMetadata;
  error?: string;
  warnings: string[];
  fetchedAt: string;
}

export interface RepositoryEvidenceCache {
  get(key: string): RepositoryEvidence | undefined;
  set(key: string, value: RepositoryEvidence): void;
}

export function createMemoryCache(): RepositoryEvidenceCache {
  const store = new Map<string, RepositoryEvidence>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      store.set(key, value);
    },
  };
}

export function canonicalRepoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

export interface InspectRepositoryOptions {
  token?: string;
  cache?: RepositoryEvidenceCache;
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof Error && /rate limit/i.test(error.message);
}

// Only `ok`/`not-found`/`invalid-url` are cached — a transient `rate-limited`/
// `error` result shouldn't poison the rest of a batch run just because this
// particular repo happened to be the one that tripped the limit.
function isCacheable(status: RepositoryFetchStatus): boolean {
  return status === 'ok' || status === 'not-found' || status === 'invalid-url';
}

async function inspectViaHtmlFallback(
  requestedUrl: string,
  identity: { owner: string; repo: string },
  warnings: string[],
): Promise<RepositoryEvidence> {
  const fetchedAt = new Date().toISOString();
  const result = await enrichFromGithubHtml(requestedUrl);

  if (result.notFound) {
    return {
      requestedUrl,
      status: 'not-found',
      identity,
      redirected: false,
      source: 'html',
      warnings,
      fetchedAt,
    };
  }
  if (result.rateLimited) {
    return {
      requestedUrl,
      status: 'rate-limited',
      identity,
      redirected: false,
      source: 'none',
      warnings,
      fetchedAt,
    };
  }
  if (result.error) {
    return {
      requestedUrl,
      status: 'error',
      identity,
      redirected: false,
      source: 'none',
      error: result.error,
      warnings,
      fetchedAt,
    };
  }

  const github: GithubMetadata = {
    stars: 0,
    forks: 0,
    archived: false,
    topics: result.fields.topics,
    license: result.fields.license,
    language: result.fields.language,
    homepage: result.fields.homepage,
  };

  return {
    requestedUrl,
    status: 'ok',
    identity,
    canonicalUrl: `https://github.com/${identity.owner}/${identity.repo}`,
    redirected: false,
    source: 'html',
    github,
    warnings: [...warnings, 'partial-evidence-html-fallback'],
    fetchedAt,
  };
}

export async function inspectRepository(
  url: string,
  options: InspectRepositoryOptions = {},
): Promise<RepositoryEvidence> {
  const identity = parseGithubRepoUrl(url);
  if (!identity) {
    return {
      requestedUrl: url,
      status: 'invalid-url',
      redirected: false,
      source: 'none',
      warnings: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  const cache = options.cache;
  const key = canonicalRepoKey(identity.owner, identity.repo);
  const cached = cache?.get(key);
  if (cached) return cached;

  const evidence = await fetchViaApiThenFallback(url, identity, options.token);
  if (cache && isCacheable(evidence.status)) cache.set(key, evidence);
  return evidence;
}

async function fetchViaApiThenFallback(
  requestedUrl: string,
  identity: { owner: string; repo: string },
  token: string | undefined,
): Promise<RepositoryEvidence> {
  const fetchedAt = new Date().toISOString();
  try {
    const metadata = await fetchGithubMetadata(identity, token ?? resolveGithubToken());
    if (!metadata) {
      return {
        requestedUrl,
        status: 'not-found',
        identity,
        redirected: false,
        source: 'none',
        warnings: [],
        fetchedAt,
      };
    }

    const canonical = metadata.fullName;
    const requestedFullName = `${identity.owner}/${identity.repo}`;
    const redirected =
      Boolean(canonical) && canonical?.toLowerCase() !== requestedFullName.toLowerCase();

    return {
      requestedUrl,
      status: 'ok',
      identity,
      canonicalUrl: `https://github.com/${canonical ?? requestedFullName}`,
      redirected,
      source: 'api',
      github: metadata,
      warnings: [],
      fetchedAt,
    };
  } catch (error) {
    if (isRateLimitError(error)) {
      return inspectViaHtmlFallback(requestedUrl, identity, ['github-api-rate-limited']);
    }
    return {
      requestedUrl,
      status: 'error',
      identity,
      redirected: false,
      source: 'none',
      error: (error as Error).message,
      warnings: [],
      fetchedAt,
    };
  }
}

export interface InspectRepositoriesOptions extends InspectRepositoryOptions {
  concurrency?: number;
}

export async function inspectRepositories(
  urls: string[],
  options: InspectRepositoriesOptions = {},
): Promise<RepositoryEvidence[]> {
  const cache = options.cache ?? createMemoryCache();
  const concurrency = options.concurrency ?? 4;

  const keyForUrl = (url: string): string => {
    const identity = parseGithubRepoUrl(url);
    return identity ? canonicalRepoKey(identity.owner, identity.repo) : url;
  };

  const byKey = new Map<string, string>();
  for (const url of urls) {
    const key = keyForUrl(url);
    if (!byKey.has(key)) byKey.set(key, url);
  }
  const entries = [...byKey.entries()];

  const results = await pLimit(concurrency, entries, ([, uniqueUrl]) =>
    inspectRepository(uniqueUrl, { cache, ...(options.token ? { token: options.token } : {}) }),
  );
  const byKeyEvidence = new Map<string, RepositoryEvidence>();
  entries.forEach(([key], index) => {
    const evidence = results[index];
    if (evidence) byKeyEvidence.set(key, evidence);
  });

  return urls.map((url) => {
    const evidence = byKeyEvidence.get(keyForUrl(url));
    if (!evidence) {
      // Unreachable: every url's key is present in `entries` by construction.
      throw new Error(`inspectRepositories: missing evidence for ${url}`);
    }
    return { ...evidence, requestedUrl: url };
  });
}
