import { type CandidateEntry, extractCandidates } from './candidate.js';
import { canonicalRepoKey, inspectRepositories, type RepositoryEvidence } from './evidence.js';
import { parseGithubRepoUrl } from './github.js';
import { classifyRepositoryHealth, type RepositoryHealthResult } from './repository-health.js';

export interface ReadmeHealthEntryResult {
  candidate: CandidateEntry;
  repositoryUrl?: string;
  evidence?: RepositoryEvidence;
  health?: RepositoryHealthResult;
  isDuplicate: boolean;
}

export interface ReadmeHealthSummary {
  entriesDetected: number;
  repositoriesResolved: number;
  archived: number;
  unavailable: number;
  moved: number;
  duplicates: number;
  likelyStale: number;
  unresolved: number;
  healthyPercent: number;
}

export interface ReadmeHealthReport {
  entries: ReadmeHealthEntryResult[];
  summary: ReadmeHealthSummary;
}

export interface RunReadmeHealthCheckOptions {
  file?: string;
  sourceUrl?: string;
  token?: string;
  concurrency?: number;
}

export async function runReadmeHealthCheck(
  markdown: string,
  options: RunReadmeHealthCheckOptions = {},
): Promise<ReadmeHealthReport> {
  const candidates = extractCandidates(markdown, {
    ...(options.file ? { file: options.file } : {}),
    ...(options.sourceUrl ? { sourceUrl: options.sourceUrl } : {}),
  });

  const repositoryUrls = candidates.map(
    (candidate) => candidate.links.find((link) => link.kind === 'repository')?.url,
  );
  const urlsToInspect = repositoryUrls.filter((url): url is string => Boolean(url));

  const evidenceList =
    urlsToInspect.length > 0
      ? await inspectRepositories(urlsToInspect, {
          ...(options.token ? { token: options.token } : {}),
          ...(options.concurrency !== undefined ? { concurrency: options.concurrency } : {}),
        })
      : [];
  const evidenceByUrl = new Map(urlsToInspect.map((url, index) => [url, evidenceList[index]]));

  const seenRepoKeys = new Set<string>();
  const entries: ReadmeHealthEntryResult[] = candidates.map((candidate, index) => {
    const repositoryUrl = repositoryUrls[index];
    if (!repositoryUrl) {
      return { candidate, isDuplicate: false };
    }

    const evidence = evidenceByUrl.get(repositoryUrl);
    const identity = parseGithubRepoUrl(repositoryUrl);
    const key = identity ? canonicalRepoKey(identity.owner, identity.repo) : repositoryUrl;
    const isDuplicate = seenRepoKeys.has(key);
    seenRepoKeys.add(key);

    return {
      candidate,
      repositoryUrl,
      isDuplicate,
      ...(evidence ? { evidence, health: classifyRepositoryHealth(evidence) } : {}),
    };
  });

  return { entries, summary: summarize(entries) };
}

function summarize(entries: ReadmeHealthEntryResult[]): ReadmeHealthSummary {
  let repositoriesResolved = 0;
  let archived = 0;
  let unavailable = 0;
  let moved = 0;
  let duplicates = 0;
  let likelyStale = 0;
  let unresolved = 0;
  let healthyCount = 0;

  for (const entry of entries) {
    if (entry.evidence?.status === 'ok') repositoriesResolved++;
    if (entry.evidence?.redirected) moved++;
    if (entry.isDuplicate) duplicates++;

    switch (entry.health?.status) {
      case 'archived':
        archived++;
        break;
      case 'broken':
        unavailable++;
        break;
      case 'likely-stale':
        likelyStale++;
        break;
      case 'active':
      case 'maintained':
      case 'stable':
        healthyCount++;
        break;
      default:
        break;
    }
    if (!entry.repositoryUrl || entry.health?.status === 'unknown') unresolved++;
  }

  return {
    entriesDetected: entries.length,
    repositoriesResolved,
    archived,
    unavailable,
    moved,
    duplicates,
    likelyStale,
    unresolved,
    healthyPercent:
      repositoriesResolved > 0 ? Math.round((100 * healthyCount) / repositoriesResolved) : 0,
  };
}
