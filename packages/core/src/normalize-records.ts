/**
 * The record normalizer: the one place that turns the three record
 * layers into the record every output is built from.
 *
 *   1. Human source   — a record file (see "Formats" below), patched by
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
 * Formats — all supported permanently, and mixable within one site:
 *
 *   - YAML only: `paths.recordsDir/<slug>.yml`, for data-only sites.
 *   - YAML + pointer: the same file with `content: ./…/<slug>.md`
 *     pointing at a Markdown body. `records.deprecateContentPointer`
 *     opts in to a `record_format_deprecated` warning for these.
 *   - Markdown: `paths.bodiesDir/<slug>.md`, YAML frontmatter (at least
 *     `name`, or `title` on a resource hub) plus the review body. A `.md`
 *     file a YAML record points at through `content:` is that record's
 *     body, never a record of its own.
 *
 * `generate()` (browse, collections, SEO, sitemap, llms), `grove check`,
 * `grove cleanup` and `grove readme generate` all read records through
 * {@link loadNormalizedRecords}, so they cannot disagree about a
 * record's fields or whether it is visible.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { readContentFile, splitFrontmatter } from './content-body.js';
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

/**
 * How a record is stored on disk:
 * - `yaml`: `paths.recordsDir/<slug>.yml` with no body;
 * - `yaml+content`: the same, with a `content:` pointer to a Markdown body;
 * - `markdown`: `paths.bodiesDir/<slug>.md`, frontmatter plus body.
 */
export type RecordFormat = 'yaml' | 'yaml+content' | 'markdown';

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

/** A problem found while reading or normalizing one record file. */
export interface RecordIssue {
  code:
    | 'schema_error'
    | 'zod_error'
    | 'github_cache_mismatch'
    | 'duplicate_slug_format'
    | 'markdown_content_pointer'
    | 'record_format_deprecated';
  severity: 'error' | 'warning';
  /** Record slug (the file name without its extension). */
  slug: string;
  /** Record file, relative to `cwd`. */
  file: string;
  /** Human-readable message, already prefixed with the slug. */
  message: string;
}

/**
 * A record file as read from disk, before any layer is merged: the
 * parsed YAML mapping, or a Markdown record's frontmatter. Also what
 * `grove sync github` iterates over.
 */
export interface RecordSource {
  slug: string;
  format: RecordFormat;
  /** Absolute path of the record file. */
  path: string;
  /** Record file, relative to `cwd`. */
  file: string;
  /** The YAML mapping or frontmatter; absent when the file failed to parse. */
  data?: Record<string, unknown>;
  /** A Markdown record's body (frontmatter stripped). */
  body?: string;
  /** Read and parse problems with this file. */
  issues: RecordIssue[];
}

export interface RecordSources {
  /** Every record file, sorted by file name. */
  sources: RecordSource[];
}

export interface NormalizedRecord {
  /** Canonical slug: always the file name without its extension. */
  slug: string;
  /** Record file, relative to `cwd`. */
  file: string;
  format: RecordFormat;
  /**
   * The review body: a Markdown record's own body, or the file a YAML
   * record's `content:` points at, frontmatter stripped. Absent for a
   * data-only record, a Markdown record whose body is blank, or a
   * pointer that does not resolve.
   */
  body?: string;
  /**
   * The record after every layer: source, GitHub cache (or legacy
   * inline copy), overrides, `paths.health` and decisions. This is
   * what the build serializes and every output renders. For a Markdown
   * record with a body, `content` points at the record's own file, so
   * every renderer that reads `content` finds the body unchanged.
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
  /**
   * The `slug` value written in the file, which the file name
   * overrides. `undefined` when a Markdown record leaves it out.
   */
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
  format: RecordFormat;
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

function isMapping(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** True when a Markdown record's body holds anything but whitespace. */
function hasBody(body: string | undefined): body is string {
  return body !== undefined && /\S/.test(body);
}

/** `./`-prefixed, `/`-separated path relative to `cwd`: the form `content:` pointers use. */
function contentPointerFor(cwd: string, path: string): string {
  return `./${relative(cwd, path).split(sep).join('/')}`;
}

/** Candidate absolute paths for a `content:` pointer, as the build resolves it. */
function pointerCandidates(cwd: string, pointer: string): string[] {
  return [resolve(cwd, pointer), resolve(cwd, 'apps', 'example', pointer)];
}

/**
 * Discover and read every record file, in both formats, without merging
 * any layer. A file that cannot be parsed is returned with an issue and
 * no `data`. The same slug in both formats is a `duplicate_slug_format`
 * error on both files: neither silently wins.
 */
export async function readRecordSources(
  config: GroveConfig,
  cwd = process.cwd(),
): Promise<RecordSources> {
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const bodiesDir = resolve(cwd, config.paths.bodiesDir ?? 'content/records');
  // The field every record of this blueprint must have: frontmatter
  // without it belongs to some other document.
  const labelKey = blueprintKind[config.blueprint] === 'resource' ? 'title' : 'name';
  const sources: RecordSource[] = [];
  const issue = (
    source: Pick<RecordSource, 'slug' | 'file'>,
    code: RecordIssue['code'],
    message: string,
    severity: RecordIssue['severity'] = 'error',
  ): RecordIssue => ({
    code,
    severity,
    slug: source.slug,
    file: source.file,
    message: `${source.slug}: ${message}`,
  });

  // ── YAML records ───────────────────────────────────────────────────
  // Their `content:` pointers are collected first: a Markdown file one
  // of them points at is that record's body, not a record.
  const pointedAt = new Set<string>();
  const yamlFiles = (await readdir(recordsDir).catch(() => [] as string[]))
    .filter((name) => name.endsWith('.yml'))
    .sort();
  for (const name of yamlFiles) {
    const path = join(recordsDir, name);
    const source: RecordSource = {
      slug: basename(name, '.yml'),
      format: 'yaml',
      path,
      file: relative(cwd, path),
      issues: [],
    };
    sources.push(source);
    // `schema: 'core'` disables custom-tag interpretation: a record with
    // `!!binary` / `!!js/function` must not become a host object.
    let raw: unknown;
    try {
      raw = parseYaml(await readFile(path, 'utf8'), { schema: 'core' });
    } catch (err) {
      source.issues.push(issue(source, 'schema_error', (err as Error).message));
      continue;
    }
    if (!isMapping(raw)) {
      source.issues.push(
        issue(source, 'schema_error', 'record file is empty or not a YAML mapping'),
      );
      continue;
    }
    source.data = raw;
    if (typeof raw.content === 'string' && raw.content) {
      source.format = 'yaml+content';
      for (const candidate of pointerCandidates(cwd, raw.content)) pointedAt.add(candidate);
    }
  }

  // ── Markdown records ───────────────────────────────────────────────
  const markdownFiles = (await readdir(bodiesDir).catch(() => [] as string[]))
    .filter((name) => name.endsWith('.md'))
    .sort();
  for (const name of markdownFiles) {
    const path = join(bodiesDir, name);
    if (pointedAt.has(path)) continue;
    const { frontmatter, body, hasFrontmatter } = splitFrontmatter(await readFile(path, 'utf8'));
    // No frontmatter: a body nothing points at, or an unrelated page.
    // Neither is a record.
    if (!hasFrontmatter) continue;
    const source: RecordSource = {
      slug: basename(name, '.md'),
      format: 'markdown',
      path,
      file: relative(cwd, path),
      issues: [],
    };
    let raw: unknown;
    try {
      raw = parseYaml(frontmatter, { schema: 'core' });
    } catch (err) {
      source.issues.push(issue(source, 'schema_error', `frontmatter: ${(err as Error).message}`));
      sources.push(source);
      continue;
    }
    // A record declares at least its name (`title` on a resource hub);
    // frontmatter without it is some other document's.
    if (!isMapping(raw) || raw[labelKey] === undefined) continue;
    source.data = raw;
    source.body = body;
    sources.push(source);
  }

  // ── One slug, one format ───────────────────────────────────────────
  const bySlug = new Map<string, RecordSource[]>();
  for (const source of sources) {
    bySlug.set(source.slug, [...(bySlug.get(source.slug) ?? []), source]);
  }
  for (const group of bySlug.values()) {
    if (group.length < 2) continue;
    const files = group.map((source) => source.file).join(' and ');
    for (const source of group) {
      source.issues.push(
        issue(
          source,
          'duplicate_slug_format',
          `record is defined twice (${files}); keep one format and delete the other`,
        ),
      );
    }
  }

  sources.sort((a, b) => {
    const nameA = basename(a.path);
    const nameB = basename(b.path);
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  return { sources };
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

/**
 * Discover, parse and merge every record, in either format (see
 * {@link readRecordSources}).
 *
 * Per record, lowest to highest precedence:
 *
 *   1. the record file (YAML, or a Markdown record's frontmatter)
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
  const expectedKind = blueprintKind[config.blueprint];
  const [{ sources }, githubCache, decisions, healthBySlug, patches] = await Promise.all([
    readRecordSources(config, cwd),
    loadGithubCache(config, cwd),
    loadDecisionVisibility(config, cwd),
    loadHealthEntries(config, cwd),
    loadOverridePatches(config, cwd),
  ]);
  const cachePath = relative(cwd, githubCache.dir) || '.';
  // A stale sync resolves as `status: unknown` rather than old values.
  const freshness = githubSyncFreshnessOptions(config);
  const warnPointer = config.records?.deprecateContentPointer === true;

  const entries: RecordEntry[] = [];
  for (const source of sources) {
    const { slug, file, format } = source;
    const entry: RecordEntry = {
      slug,
      file,
      format,
      issues: [...source.issues],
      syncStale: false,
    };
    entries.push(entry);
    const push = (code: RecordIssue['code'], message: string, severity: RecordIssue['severity']) =>
      entry.issues.push({ code, severity, slug, file, message: `${slug}: ${message}` });
    const data = source.data;
    if (!data || entry.issues.some((issue) => issue.severity === 'error')) continue;

    const raw = { ...data };
    if (format === 'markdown') {
      // The file is the record's body. A pointer elsewhere would give it
      // two bodies, so it is an error rather than silently ignored.
      if (raw.content !== undefined) {
        push(
          'markdown_content_pointer',
          'a Markdown record is its own body; remove `content:` from its frontmatter',
          'error',
        );
        continue;
      }
      // `content` points at the record's own file, so every renderer that
      // reads a body through `content` works unchanged. A blank body is
      // no body: the record then reads exactly like a YAML record with
      // no pointer (no "no notes yet" fallback, no skeleton warning).
      if (hasBody(source.body)) raw.content = contentPointerFor(cwd, source.path);
      if (raw.slug === undefined) raw.slug = slug;
    } else if (format === 'yaml+content' && warnPointer) {
      push(
        'record_format_deprecated',
        `YAML record with a \`content:\` pointer; move it to one Markdown file with frontmatter (${config.paths.bodiesDir ?? 'content/records'}/${slug}.md)`,
        'warning',
      );
    }

    // Cache wins over a legacy inline copy; a disagreement is a second
    // source of truth, so name the fields.
    const resolved = resolveRecordGithub(raw, githubCache.entries.get(slug), freshness);
    entry.syncStale = resolved.syncStale !== undefined;
    if (resolved.conflicts.length > 0) {
      push(
        'github_cache_mismatch',
        `inline github/health disagrees with ${cachePath}/${slug}.json — ${resolved.conflicts.join(', ')}. The cache wins; run \`grove migrate github-cache\` to drop the inline copy.`,
        'warning',
      );
    }
    const merged = resolved.record;
    if (!merged.kind) merged.kind = expectedKind;
    const patch = patches.get(slug);
    const input = patch ? { ...merged, ...patch } : merged;

    let base: Resource;
    try {
      base = recordsFileSchema.parse(input);
    } catch (err) {
      if (err instanceof ZodError) {
        for (const zodIssue of err.issues) {
          const where = zodIssue.path.length > 0 ? zodIssue.path.join('.') : '(root)';
          push('zod_error', `${where} ${zodIssue.message}`, 'error');
        }
      } else {
        push('schema_error', (err as Error).message, 'error');
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

    let body: string | undefined;
    if (format === 'markdown') body = hasBody(source.body) ? source.body : undefined;
    else if (base.content) {
      body = readContentFile(base.content, pointerCandidates(cwd, base.content))?.body;
    }

    entry.record = {
      slug,
      file,
      format,
      ...(body !== undefined ? { body } : {}),
      record,
      base,
      visibility: recordVisibility(record),
      declaredSlug: format === 'markdown' ? data.slug : input.slug,
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
