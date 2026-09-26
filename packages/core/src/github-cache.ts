import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseDocument, parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { GroveConfig } from './schema.js';

/**
 * The GitHub sync cache: one JSON file per record, owned by
 * `grove sync github`.
 *
 * Records (`paths.recordsDir`) belong to curators and
 * `paths.decisions` to reviewers. What the sync bot observes on GitHub
 * — repository metadata, the derived health block, when it last
 * succeeded and what went wrong since — lives here instead, so the
 * three layers never write into each other and a sync PR only ever
 * touches this directory.
 *
 * Every reader (build, validate, cleanup, README) resolves a record's
 * `github` / `health` through {@link resolveRecordGithub}, with
 * precedence cache > inline (legacy) > `paths.health`.
 */

export const GITHUB_CACHE_SCHEMA_VERSION = 1;

/** How many failed or partial fetches a cache entry remembers. */
export const GITHUB_CACHE_MAX_FAILURES = 5;

const cacheSourceSchema = z.enum(['api', 'html']);

const githubCacheFailureSchema = z.object({
  at: z.string(),
  source: cacheSourceSchema,
  reason: z.string(),
});

export const githubCacheEntrySchema = z.object({
  schemaVersion: z.literal(GITHUB_CACHE_SCHEMA_VERSION),
  slug: z.string().min(1),
  repoUrl: z.string().optional(),
  /** Which fetch path delivered the data currently in `github`. */
  source: cacheSourceSchema.optional(),
  /** When the GitHub API last delivered a full refresh. Never moved by a failure or HTML fallback. */
  lastSuccessAt: z.string().nullable().default(null),
  /** Most recent failed fetches, oldest first, capped at {@link GITHUB_CACHE_MAX_FAILURES}. */
  partialFailures: z.array(githubCacheFailureSchema).default([]),
  /** Repository description as GitHub reports it. Not merged into the record. */
  sourceDescription: z.string().optional(),
  github: z.record(z.string(), z.unknown()).optional(),
  health: z.record(z.string(), z.unknown()).optional(),
});

export type GithubCacheSource = z.infer<typeof cacheSourceSchema>;
export type GithubCacheFailure = z.infer<typeof githubCacheFailureSchema>;
export type GithubCacheEntry = z.infer<typeof githubCacheEntrySchema>;

export interface GithubCache {
  /** Absolute cache directory. */
  dir: string;
  /** Cache entries keyed by file name (the record slug). */
  entries: Map<string, GithubCacheEntry>;
  /** Files that exist but could not be read as a cache entry. */
  errors: Array<{ file: string; message: string }>;
}

/**
 * Absolute directory of the GitHub sync cache for a project. Falls
 * back to the schema default for configs built by hand rather than
 * through `defineConfig` / `loadConfig`.
 */
export function githubCacheDir(config: GroveConfig, cwd = process.cwd()): string {
  return resolve(cwd, config.paths.githubCache ?? 'data/cache/github');
}

/**
 * Read every `<slug>.json` under `paths.githubCache`. A missing
 * directory is an empty cache; an unreadable file is reported in
 * `errors` and left out of `entries`, so readers fall back to inline
 * data for that record instead of failing the build.
 */
export async function loadGithubCache(
  config: GroveConfig,
  cwd = process.cwd(),
): Promise<GithubCache> {
  const dir = githubCacheDir(config, cwd);
  const entries = new Map<string, GithubCacheEntry>();
  const errors: GithubCache['errors'] = [];
  const files = (await readdir(dir).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of files) {
    const slug = basename(file, '.json');
    try {
      const entry = githubCacheEntrySchema.parse(
        JSON.parse(await readFile(join(dir, file), 'utf8')),
      );
      if (entry.slug !== slug) {
        errors.push({ file, message: `slug "${entry.slug}" does not match the file name` });
        continue;
      }
      entries.set(slug, entry);
    } catch (err) {
      const message =
        err instanceof z.ZodError
          ? err.issues
              .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
              .join('; ')
          : (err as Error).message;
      errors.push({ file, message });
    }
  }
  return { dir, entries, errors };
}

// ── Resolution ─────────────────────────────────────────────────────

export type GithubFieldSource = 'cache' | 'inline' | 'none';

export interface ResolvedRecordGithub {
  /** Shallow copy of the record with `github` / `health` taken from the cache when it has them. */
  record: Record<string, unknown>;
  github: GithubFieldSource;
  health: GithubFieldSource;
  /**
   * One line per field where the record's own (legacy) `github` /
   * `health` disagrees with the cache. The cache wins; these exist so
   * `grove check` can say so instead of picking silently.
   */
  conflicts: string[];
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function sameInstant(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta === tb;
  }
  return a === b;
}

/** The observable GitHub signals a reader would show; sync bookkeeping is ignored. */
function githubSignals(github: Record<string, unknown>): Record<string, unknown> {
  const repository = asObject(github.repository) ?? {};
  return {
    stars: repository.stargazers_count ?? github.stars,
    forks: repository.forks_count ?? github.forks,
    pushed_at: repository.pushed_at ?? github.pushedAt,
    archived: repository.archived ?? github.archived,
    license: asObject(repository.license)?.spdx_id ?? github.license,
  };
}

const HEALTH_SIGNALS = ['status', 'tier', 'visibility'] as const;

function describe(value: unknown): string {
  return value === undefined ? 'unset' : String(value);
}

/**
 * Field-level differences between a record's inline `github` /
 * `health` and its cache entry. Only fields both sides know are
 * compared — a value missing on one side is not a disagreement.
 */
export function githubCacheConflicts(
  record: Record<string, unknown>,
  entry: GithubCacheEntry | undefined,
): string[] {
  const conflicts: string[] = [];
  if (!entry) return conflicts;
  const inlineGithub = asObject(record.github);
  if (inlineGithub && entry.github) {
    const inline = githubSignals(inlineGithub);
    const cached = githubSignals(entry.github);
    for (const field of Object.keys(inline)) {
      const a = inline[field];
      const b = cached[field];
      if (a === undefined || a === null || b === undefined || b === null) continue;
      const equal = field === 'pushed_at' ? sameInstant(a, b) : a === b;
      if (!equal)
        conflicts.push(`github ${field} ${describe(a)} (inline) vs ${describe(b)} (cache)`);
    }
  }
  const inlineHealth = asObject(record.health);
  if (inlineHealth && entry.health) {
    for (const field of HEALTH_SIGNALS) {
      const a = inlineHealth[field];
      const b = entry.health[field];
      if (a === undefined || b === undefined || a === b) continue;
      conflicts.push(`health ${field} ${describe(a)} (inline) vs ${describe(b)} (cache)`);
    }
  }
  return conflicts;
}

/**
 * Resolve a raw record's `github` and `health` blocks: the cache entry
 * wins for each block it carries, the record's own inline block is the
 * legacy fallback. The input is not mutated.
 */
export function resolveRecordGithub(
  record: Record<string, unknown>,
  entry: GithubCacheEntry | undefined,
): ResolvedRecordGithub {
  const out = { ...record };
  let github: GithubFieldSource = record.github === undefined ? 'none' : 'inline';
  let health: GithubFieldSource = record.health === undefined ? 'none' : 'inline';
  if (entry?.github) {
    out.github = entry.github;
    github = 'cache';
  }
  if (entry?.health) {
    out.health = entry.health;
    health = 'cache';
  }
  return { record: out, github, health, conflicts: githubCacheConflicts(record, entry) };
}

// ── Writing ────────────────────────────────────────────────────────

const ENTRY_KEY_ORDER = [
  'schemaVersion',
  'slug',
  'repoUrl',
  'source',
  'lastSuccessAt',
  'partialFailures',
  'sourceDescription',
  'github',
  'health',
] as const satisfies ReadonlyArray<keyof GithubCacheEntry>;

/**
 * Serialize a cache entry: fixed top-level key order, two-space
 * indent, trailing newline. Nested blocks keep the order sync builds
 * them in, so re-running sync on unchanged data rewrites the same bytes
 * apart from its timestamps.
 */
export function serializeGithubCacheEntry(entry: GithubCacheEntry): string {
  const ordered: Record<string, unknown> = {};
  for (const key of ENTRY_KEY_ORDER) {
    if (entry[key] !== undefined) ordered[key] = entry[key];
  }
  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/**
 * Write one cache entry to `<dir>/<slug>.json`. Returns false when the
 * file already held exactly these bytes and was left alone.
 */
export async function writeGithubCacheEntry(
  dir: string,
  entry: GithubCacheEntry,
): Promise<boolean> {
  const path = join(dir, `${entry.slug}.json`);
  const text = serializeGithubCacheEntry(entry);
  const existing = await readFile(path, 'utf8').catch(() => undefined);
  if (existing === text) return false;
  await mkdir(dir, { recursive: true });
  await writeFile(path, text, 'utf8');
  return true;
}

/** The outcome of one `grove sync github` attempt for one record. */
export interface GithubSyncAttempt {
  slug: string;
  at: string;
  repoUrl?: string;
  /** Fetch path that delivered data; undefined when nothing did. */
  source?: GithubCacheSource;
  /** The full `github` block to cache when `source` is set. */
  github?: Record<string, unknown>;
  /** A freshly derived health block; the previous one is kept when absent. */
  health?: Record<string, unknown>;
  sourceDescription?: string;
  /** What failed on the way, in order. */
  failures: Array<{ source: GithubCacheSource; reason: string }>;
}

/**
 * Fold one sync attempt into the previous cache entry.
 *
 * - An API refresh replaces `github` (and `health` when given) and
 *   moves `lastSuccessAt`.
 * - An HTML fallback replaces `github` but not `lastSuccessAt`: it is a
 *   partial refresh, and the API failure is recorded.
 * - A failure keeps every previous value and only appends to
 *   `partialFailures`, so stale data is never presented as fresh —
 *   `lastSuccessAt` older than the newest failure says so.
 */
export function nextGithubCacheEntry(
  previous: GithubCacheEntry | undefined,
  attempt: GithubSyncAttempt,
): GithubCacheEntry {
  const base: GithubCacheEntry = previous ?? {
    schemaVersion: GITHUB_CACHE_SCHEMA_VERSION,
    slug: attempt.slug,
    lastSuccessAt: null,
    partialFailures: [],
  };
  const partialFailures = [
    ...base.partialFailures,
    ...attempt.failures.map((failure) => ({ at: attempt.at, ...failure })),
  ].slice(-GITHUB_CACHE_MAX_FAILURES);
  const next: GithubCacheEntry = {
    ...base,
    schemaVersion: GITHUB_CACHE_SCHEMA_VERSION,
    slug: attempt.slug,
    ...(attempt.repoUrl ? { repoUrl: attempt.repoUrl } : {}),
    partialFailures,
  };
  if (!attempt.source) return next;
  next.source = attempt.source;
  if (attempt.github) next.github = attempt.github;
  if (attempt.health) next.health = attempt.health;
  if (attempt.sourceDescription) next.sourceDescription = attempt.sourceDescription;
  if (attempt.source === 'api') next.lastSuccessAt = attempt.at;
  return next;
}

/**
 * Build a cache entry from the `github` / `health` blocks a record
 * still carries inline (written by Grove ≤ 0.12). `lastSuccessAt` is
 * only set when the inline block records an API sync — an HTML-only
 * sync was never a full refresh.
 */
export function seedGithubCacheEntry(
  slug: string,
  record: Record<string, unknown>,
): GithubCacheEntry {
  const github = asObject(record.github);
  const health = asObject(record.health);
  const sync = asObject(github?.sync);
  const source = cacheSourceSchema.safeParse(sync?.source);
  const links = asObject(record.links);
  const repoUrl =
    typeof record.repoUrl === 'string'
      ? record.repoUrl
      : typeof links?.github === 'string'
        ? links.github
        : undefined;
  return {
    schemaVersion: GITHUB_CACHE_SCHEMA_VERSION,
    slug,
    ...(repoUrl ? { repoUrl } : {}),
    ...(source.success ? { source: source.data } : {}),
    lastSuccessAt:
      source.success && source.data === 'api' && typeof sync?.syncedAt === 'string'
        ? sync.syncedAt
        : null,
    partialFailures: [],
    ...(github ? { github } : {}),
    ...(health ? { health } : {}),
  };
}

// ── Migration ──────────────────────────────────────────────────────

const MIGRATED_KEYS = ['github', 'health'] as const;

const TOP_LEVEL_KEY = /^(?:"([^"]+)"|'([^']+)'|([^\s#:][^:]*?))\s*:(?:\s|$)/;

function withoutKeys(value: unknown, keys: readonly string[]): unknown {
  const obj = asObject(value);
  if (!obj) return value;
  const out = { ...obj };
  for (const key of keys) delete out[key];
  return out;
}

function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Remove top-level mapping keys from a YAML document's text, leaving
 * every other byte alone: a block runs from its key line through the
 * indented (or blank) lines that follow it. Comments at column 0 belong
 * to whatever comes next and are kept. Falls back to a comment-
 * preserving document edit if the line cut would change any other
 * value.
 */
export function removeTopLevelYamlKeys(text: string, keys: readonly string[]): string {
  const lines = text.split('\n');
  const kept: string[] = [];
  let dropping = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const atColumnZero = line.length > 0 && !/^\s/.test(line);
    if (atColumnZero) {
      const match = TOP_LEVEL_KEY.exec(line);
      const key = match ? (match[1] ?? match[2] ?? match[3]) : undefined;
      dropping = key !== undefined && keys.includes(key);
      if (dropping) continue;
      kept.push(line);
      continue;
    }
    if (dropping) {
      if (line.trim() !== '') continue;
      // A blank line inside a dropped block goes with it only when the
      // block continues after it.
      const nextContent = lines.slice(i + 1).find((next) => next.trim() !== '');
      if (nextContent !== undefined && /^\s/.test(nextContent)) continue;
      dropping = false;
    }
    kept.push(line);
  }
  const cut = kept.join('\n');
  const expected = withoutKeys(parseYaml(text, { schema: 'core' }), keys);
  if (sameData(parseYaml(cut, { schema: 'core' }), expected)) return cut;

  const doc = parseDocument(text, { schema: 'core' });
  for (const key of keys) doc.delete(key);
  return doc.toString({ lineWidth: 100, singleQuote: false, defaultStringType: 'PLAIN' });
}

export interface GithubCacheMigration {
  /** Record text with inline `github` / `health` removed (unchanged when there was nothing to move). */
  text: string;
  /** The cache entry to write, or undefined when the record carried nothing to move. */
  entry?: GithubCacheEntry;
  /** Which inline blocks were moved out of the record. */
  moved: Array<(typeof MIGRATED_KEYS)[number]>;
  /** Inline values that were dropped in favour of a disagreeing existing cache entry. */
  conflicts: string[];
}

/**
 * Codemod one record: move its inline `github` / `health` into a cache
 * entry and strip them from the YAML text. An existing cache entry is
 * newer than the inline copy, so it wins; inline blocks only fill what
 * it lacks.
 */
export function migrateRecordGithub(
  slug: string,
  text: string,
  existing?: GithubCacheEntry,
): GithubCacheMigration {
  const raw = asObject(parseYaml(text, { schema: 'core' })) ?? {};
  const moved = MIGRATED_KEYS.filter((key) => raw[key] !== undefined);
  if (moved.length === 0) return { text, moved, conflicts: [] };
  const seeded = seedGithubCacheEntry(slug, raw);
  const entry: GithubCacheEntry = existing
    ? {
        ...existing,
        ...(existing.repoUrl || !seeded.repoUrl ? {} : { repoUrl: seeded.repoUrl }),
        ...(existing.github || !seeded.github ? {} : { github: seeded.github }),
        ...(existing.health || !seeded.health ? {} : { health: seeded.health }),
      }
    : seeded;
  return {
    text: removeTopLevelYamlKeys(text, moved),
    entry,
    moved,
    conflicts: githubCacheConflicts(raw, existing),
  };
}
