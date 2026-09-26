import { basename } from 'node:path';
import {
  buildGithubSyncPatch,
  classifyHealth,
  enrichFromGithubHtml,
  fetchGithubMetadata,
  type GithubCacheSource,
  type GroveConfig,
  loadGithubCache,
  nextGithubCacheEntry,
  normalizeGithubIntegration,
  parseGithubRepoUrl,
  pruneLegacyGithubFields,
  readRecordSources,
  seedGithubCacheEntry,
  writeGithubCacheEntry,
} from '@grove-dev/core';
import { type SyncOutcome, shortReason } from './sync-summary.js';

export interface GithubSyncOptions {
  cwd: string;
  config: GroveConfig;
  limit?: number;
  /** Injected for tests; default to the real GitHub fetchers. */
  fetchMetadata?: typeof fetchGithubMetadata;
  fetchHtml?: typeof enrichFromGithubHtml;
  now?: () => Date;
  log?: (line: string) => void;
}

export interface GithubSyncRun {
  outcomes: SyncOutcome[];
  /** Records that still carry an inline `github` / `health` block. */
  inlineRecords: string[];
  cacheDir: string;
}

/**
 * `grove sync github`: fetch each record's repository and write the
 * result to the GitHub sync cache (`paths.githubCache`), one JSON file
 * per record. Record files (YAML or Markdown) are read, never written.
 *
 * The previous cache entry — or, before `grove migrate github-cache`
 * has run, the record's inline blocks — seeds the merge, so fields sync
 * does not own survive and a failed fetch keeps the last known data
 * with the failure recorded next to it.
 */
export async function runGithubSync(options: GithubSyncOptions): Promise<GithubSyncRun> {
  const { cwd, config } = options;
  const fetchMetadata = options.fetchMetadata ?? fetchGithubMetadata;
  const fetchHtml = options.fetchHtml ?? enrichFromGithubHtml;
  const now = options.now ?? (() => new Date());
  const log = options.log ?? console.log;
  const githubFlags = normalizeGithubIntegration(config.integrations?.github);

  // Both record formats: YAML under `paths.recordsDir` and Markdown
  // records under `paths.bodiesDir`, discovered exactly as the build
  // discovers them.
  const { sources } = await readRecordSources(config, cwd);
  const selected = options.limit === undefined ? sources : sources.slice(0, options.limit);
  const cache = await loadGithubCache(config, cwd);
  const outcomes: SyncOutcome[] = [];
  const inlineRecords: string[] = [];

  for (const record of selected) {
    const { slug } = record;
    const file = basename(record.path);
    const raw = record.data ?? {};
    if (raw.github !== undefined || raw.health !== undefined) inlineRecords.push(slug);
    const links = (raw.links as Record<string, string> | undefined) ?? {};
    const repoUrl = (raw.repoUrl as string | undefined) ?? links.github;
    if (!repoUrl) {
      log(`[sync github] ${file}: no repository, skipped`);
      continue;
    }
    const ref = parseGithubRepoUrl(repoUrl);
    if (!ref) {
      log(`[sync github] ${file}: invalid GitHub URL, skipped`);
      continue;
    }

    const previous = cache.entries.get(slug) ?? seedGithubCacheEntry(slug, raw);
    const github = previous.github ?? {};
    const patch: Record<string, unknown> = {};
    let health: Record<string, unknown> | undefined;
    let sourceDescription: string | undefined;
    let source: GithubCacheSource | undefined;
    // Why the API path didn't deliver, then why the fallback didn't —
    // recorded on the cache entry and reported per record at the end.
    const failures: Array<{ source: GithubCacheSource; reason: string }> = [];
    try {
      const metadata = await fetchMetadata(ref);
      if (metadata) {
        if (githubFlags.health) health = classifyHealth(slug, metadata).health;
        // Merge into the existing repository block rather than
        // replacing it wholesale: sync only owns the fields it writes.
        Object.assign(patch, buildGithubSyncPatch(metadata, github));
        if (metadata.description) sourceDescription = metadata.description;
        source = 'api';
      } else {
        failures.push({ source: 'api', reason: 'repository not found' });
      }
    } catch (error) {
      // The token-free HTML fallback below keeps scheduled syncs useful.
      failures.push({ source: 'api', reason: shortReason(error) });
    }
    if (!source) {
      try {
        const enriched = await fetchHtml(repoUrl);
        if (!enriched.notFound && !enriched.rateLimited && !enriched.error) {
          // HTML fallback only fills fields the API didn't reach.
          if (enriched.fields.homepage) patch.homepage = enriched.fields.homepage;
          patch.html = {
            license: enriched.fields.license,
            language: enriched.fields.language,
            topics: enriched.fields.topics,
          };
          source = 'html';
        } else {
          failures.push({
            source: 'html',
            reason: enriched.notFound
              ? 'not found'
              : enriched.rateLimited
                ? 'rate limited'
                : shortReason(enriched.error),
          });
        }
      } catch (error) {
        failures.push({ source: 'html', reason: shortReason(error) });
      }
    }

    const at = now().toISOString();
    if (source) patch.sync = { syncedAt: at, source };
    const entry = nextGithubCacheEntry(previous, {
      slug,
      at,
      repoUrl,
      ...(source ? { source, github: { ...pruneLegacyGithubFields(github), ...patch } } : {}),
      ...(health ? { health } : {}),
      ...(sourceDescription ? { sourceDescription } : {}),
      failures,
    });
    await writeGithubCacheEntry(cache.dir, entry);

    const reason =
      failures.length > 0
        ? failures
            .map((failure) => `${failure.source === 'api' ? 'API' : 'HTML'}: ${failure.reason}`)
            .join('; ')
        : undefined;
    outcomes.push({ slug, outcome: source ?? 'failed', ...(reason ? { reason } : {}) });
    log(`[sync github] ${file}: ${source ?? 'unavailable'}`);
  }
  return { outcomes, inlineRecords, cacheDir: cache.dir };
}
