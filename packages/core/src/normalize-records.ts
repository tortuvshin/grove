/**
 * The record normalizer: the one place that turns the three record
 * layers into the record every output is built from.
 *
 *   1. Human source   — `paths.recordsDir/<slug>.yml`, patched by
 *                       `paths.overrides`.
 *   2. Generated cache — `paths.githubCache/<slug>.json` (GitHub
 *                       metadata and health, written by
 *                       `grove sync github`), with a legacy inline
 *                       `github` / `health` block and `paths.health`
 *                       as fallbacks. Health from a stale sync resolves
 *                       as `status: unknown` (`sync.github.maxAgeDays`).
 *   3. Decisions      — `paths.decisions`, which has the final say on
 *                       visibility.
 *
 * `generate()` (browse, collections, SEO, sitemap, llms), `grove check`,
 * `grove cleanup` and `grove readme generate` all read records through
 * {@link loadNormalizedRecords}, so they cannot disagree about a
 * record's fields or whether it is visible.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import {
  type GithubCache,
  type GithubFieldSource,
  githubSyncFreshnessOptions,
  loadGithubCache,
  resolveRecordGithub,
} from './github-cache.js';
import { classifyHealth } from './health.js';
import {
  blueprintKind,
  type DecisionVisibility,
  decisionsFileSchema,
  type GroveConfig,
  type HealthEntry,
  healthFileSchema,
  overridesFileSchema,
  type Resource,
  recordsFileSchema,
  recordVisibility,
  unwrapDecisions,
  unwrapHealth,
  unwrapOverrides,
} from './schema.js';

/** Where a normalized record's `health` block came from. */
export type RecordHealthSource =
  /** `paths.githubCache/<slug>.json`. */
  | 'cache'
  /** A legacy `health` block written inline on the record. */
  | 'inline'
  /** A `paths.overrides` patch. */
  | 'override'
  /** The record's entry in `paths.health`. */
  | 'file'
  /** Fabricated as "unknown" so a decision has a block to carry its visibility. */
  | 'decision'
  | 'none';

/** A problem found while normalizing one record file. */
export interface RecordIssue {
  code: 'schema_error' | 'zod_error' | 'github_cache_mismatch';
  severity: 'error' | 'warning';
  /** Record slug (the file name without its extension). */
  slug: string;
  /** Record file, relative to `cwd`. */
  file: string;
  /** Human-readable message, already prefixed with the slug. */
  message: string;
}

export interface NormalizedRecord {
  /** Canonical slug: always the file name without its extension. */
  slug: string;
  /** Record file, relative to `cwd`. */
  file: string;
  /**
   * The record after every layer: source, GitHub cache (or legacy
   * inline copy), overrides, `paths.health` and decisions. This is
   * what the build serializes and every output renders.
   */
  record: Resource;
  /**
   * The record before `paths.health` and decisions are applied:
   * source + GitHub cache + overrides, schema-parsed, slug from the
   * file name. `grove check` compares this against `paths.health`.
   */
  base: Resource;
  /** Effective visibility: decision, then health, then the record's own field. */
  visibility: DecisionVisibility;
  /** The `slug` value written in the file, which the file name overrides. */
  declaredSlug: unknown;
  provenance: {
    github: GithubFieldSource;
    health: RecordHealthSource;
    /** True when `paths.decisions` has an entry for this record. */
    decision: boolean;
    /** True when `paths.overrides` has a patch for this record. */
    override: boolean;
  };
}

/** One record file in discovery order, whether or not it normalized. */
export interface RecordEntry {
  slug: string;
  file: string;
  /** Problems with this file; an `error` means `record` is absent. */
  issues: RecordIssue[];
  /**
   * True when the record's cached health came from a stale sync and
   * resolved as `status: unknown` (see `githubSyncFreshness`).
   */
  syncStale: boolean;
  /** Absent when the file failed to parse or validate. */
  record?: NormalizedRecord;
}

export interface NormalizedRecords {
  /** Records that normalized, sorted by file name. */
  records: NormalizedRecord[];
  /** Every record file, sorted by file name, with its issues. */
  entries: RecordEntry[];
  /** All issues from `entries`, flattened in the same order. */
  issues: RecordIssue[];
  /** The GitHub sync cache the records were resolved against. */
  githubCache: GithubCache;
}

/** Read an optional side file; a missing or invalid file yields `fallback`. */
async function readSideFile<T>(
  path: string,
  cwd: string,
  parse: (raw: unknown) => T,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(resolve(cwd, path), 'utf8');
    return parse(parseYaml(raw, { schema: 'core' }) ?? {});
  } catch {
    return fallback;
  }
}

function loadDecisionVisibility(config: GroveConfig, cwd: string) {
  return readSideFile(
    config.paths.decisions,
    cwd,
    (raw) =>
      new Map<string, DecisionVisibility>(
        unwrapDecisions(decisionsFileSchema.parse(raw)).map((d) => [d.id, d.decision.visibility]),
      ),
    new Map<string, DecisionVisibility>(),
  );
}

function loadHealthEntries(config: GroveConfig, cwd: string) {
  return readSideFile(
    config.paths.health,
    cwd,
    (raw) =>
      new Map<string, HealthEntry['health']>(
        unwrapHealth(healthFileSchema.parse(raw)).map((entry) => [entry.id, entry.health]),
      ),
    new Map<string, HealthEntry['health']>(),
  );
}

function loadOverridePatches(config: GroveConfig, cwd: string) {
  return readSideFile(
    config.paths.overrides,
    cwd,
    (raw) =>
      new Map<string, Record<string, unknown>>(
        unwrapOverrides(overridesFileSchema.parse(raw)).map((entry) => [entry.id, entry.patch]),
      ),
    new Map<string, Record<string, unknown>>(),
  );
}

/**
 * Apply a `paths.decisions` visibility to a record. For project records
 * the decision overwrites `health.visibility`; a project with no health
 * block gets a fabricated "unknown" one from {@link classifyHealth},
 * because list and index payloads read visibility from `health`. For
 * resource-hub and ecosystem-map records (no `health` block) it sets the
 * top-level `visibility`.
 */
export function applyDecisionVisibility(
  record: Resource,
  visibility: DecisionVisibility | undefined,
): Resource {
  if (!visibility) return record;
  if (record.kind === 'project') {
    const health = record.health ?? classifyHealth(record.slug).health;
    return { ...record, health: { ...health, visibility } };
  }
  return { ...record, visibility };
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Discover, parse and merge every record under `config.paths.recordsDir`.
 *
 * Per record, lowest to highest precedence:
 *
 *   1. the record file (`paths.recordsDir/<slug>.yml`)
 *   2. the GitHub sync cache, which supplies `github` / `health` over a
 *      legacy inline copy ({@link resolveRecordGithub})
 *   3. the `paths.overrides` patch (shallow, top-level fields)
 *   4. schema parse (`recordsFileSchema`); the slug is the file name
 *   5. the `paths.health` entry, for a project record nothing above
 *      gave a health block
 *   6. the `paths.decisions` visibility
 *
 * Effective visibility is then decision > health > the record's own
 * `visibility` field ({@link recordVisibility}).
 *
 * Never throws for a bad record: a file that cannot be parsed or fails
 * the schema is reported in `issues` and left out of `records`. Missing
 * or invalid side files are treated as empty; `grove check` reports them.
 */
export async function loadNormalizedRecords(
  config: GroveConfig,
  cwd = process.cwd(),
): Promise<NormalizedRecords> {
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const expectedKind = blueprintKind[config.blueprint];
  const files = (await readdir(recordsDir).catch(() => [] as string[]))
    .filter((file) => file.endsWith('.yml'))
    .sort();

  const [githubCache, decisions, healthBySlug, patches] = await Promise.all([
    loadGithubCache(config, cwd),
    loadDecisionVisibility(config, cwd),
    loadHealthEntries(config, cwd),
    loadOverridePatches(config, cwd),
  ]);
  const cachePath = relative(cwd, githubCache.dir) || '.';
  // A stale sync resolves as `status: unknown` rather than old values.
  const freshness = githubSyncFreshnessOptions(config);

  const entries: RecordEntry[] = [];
  for (const name of files) {
    const slug = basename(name, '.yml');
    const path = join(recordsDir, name);
    const file = relative(cwd, path);
    const entry: RecordEntry = { slug, file, issues: [], syncStale: false };
    entries.push(entry);
    const fail = (code: RecordIssue['code'], message: string) =>
      entry.issues.push({ code, severity: 'error', slug, file, message: `${slug}: ${message}` });

    // `schema: 'core'` disables custom-tag interpretation: a record with
    // `!!binary` / `!!js/function` must not become a host object.
    let raw: unknown;
    try {
      raw = parseYaml(await readFile(path, 'utf8'), { schema: 'core' });
    } catch (err) {
      fail('schema_error', (err as Error).message);
      continue;
    }
    if (!isMapping(raw)) {
      fail('schema_error', 'record file is empty or not a YAML mapping');
      continue;
    }

    // Cache wins over a legacy inline copy; a disagreement is a second
    // source of truth, so name the fields.
    const resolved = resolveRecordGithub(raw, githubCache.entries.get(slug), freshness);
    entry.syncStale = resolved.syncStale !== undefined;
    if (resolved.conflicts.length > 0) {
      entry.issues.push({
        code: 'github_cache_mismatch',
        severity: 'warning',
        slug,
        file,
        message: `${slug}: inline github/health disagrees with ${cachePath}/${slug}.json — ${resolved.conflicts.join(', ')}. The cache wins; run \`grove migrate github-cache\` to drop the inline copy.`,
      });
    }
    const merged = resolved.record;
    if (!merged.kind) merged.kind = expectedKind;
    const patch = patches.get(slug);

    let base: Resource;
    try {
      base = recordsFileSchema.parse(patch ? { ...merged, ...patch } : merged);
    } catch (err) {
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
          fail('zod_error', `${where} ${issue.message}`);
        }
      } else {
        fail('schema_error', (err as Error).message);
      }
      continue;
    }
    base.slug = slug;

    let healthSource: RecordHealthSource =
      patch && 'health' in patch
        ? 'override'
        : resolved.health === 'none'
          ? 'none'
          : resolved.health;
    let record: Resource = base;
    if (record.kind === 'project' && !record.health) {
      healthSource = 'none';
      const fromFile = healthBySlug.get(slug);
      if (fromFile) {
        record = { ...record, health: fromFile };
        healthSource = 'file';
      }
    }
    const decision = decisions.get(slug);
    if (decision && record.kind === 'project' && !record.health) healthSource = 'decision';
    record = applyDecisionVisibility(record, decision);

    entry.record = {
      slug,
      file,
      record,
      base,
      visibility: recordVisibility(record),
      declaredSlug: raw.slug,
      provenance: {
        github: resolved.github,
        health: healthSource,
        decision: decision !== undefined,
        override: patch !== undefined,
      },
    };
  }

  return {
    records: entries.flatMap((entry) => (entry.record ? [entry.record] : [])),
    entries,
    issues: entries.flatMap((entry) => entry.issues),
    githubCache,
  };
}
