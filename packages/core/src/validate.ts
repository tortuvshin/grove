import { access, readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ZodError } from 'zod';
import { type CollectionSourceRecord, toCollectionEntries } from './collection-entries.js';
import { CollectionFileError, parseCollectionFile } from './collections-io.js';
import { runCollection } from './collector.js';
import { readYamlFile } from './io.js';
import {
  blueprintKind,
  decisionsFileSchema,
  type GroveConfig,
  type HealthEntry,
  healthFileSchema,
  type Resource,
  recordsFileSchema,
  subjectSchema,
  unwrapDecisions,
  unwrapHealth,
} from './schema.js';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Flattened list of all issues (errors first, then warnings). */
  issues: ValidationIssue[];
}

/** Related records a subject needs before a missing hub is worth a warning. */
const SUBJECT_HUB_MIN_RECORDS = 3;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface HealthParityValues {
  status: string;
  tier: string;
  visibility: string;
  lastCommitAt: string | null;
}

const HEALTH_PARITY_FIELDS = ['status', 'tier', 'visibility', 'lastCommitAt'] as const;

function sameInstant(a: string | null, b: string | null): boolean {
  // Only compare when both sides know a date — a missing one is not drift.
  if (a === null || b === null) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  return Number.isNaN(ta) || Number.isNaN(tb) ? a === b : ta === tb;
}

/**
 * Compare inline record health against `paths.health` entries:
 * differing values, inline records the file lacks, and file entries
 * with no record at all.
 */
function healthParityIssues(
  healthPath: string,
  entries: HealthEntry[],
  inline: Map<string, HealthParityValues>,
  recordSlugs: Set<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const [slug, values] of inline) {
    const entry = byId.get(slug);
    if (!entry) {
      issues.push({
        code: 'health_source_missing_entry',
        message: `${slug}: has inline health but no entry in ${healthPath}`,
        severity: 'warning',
      });
      continue;
    }
    const fileValues: HealthParityValues = {
      status: entry.health.status,
      tier: entry.health.tier,
      visibility: entry.health.visibility,
      lastCommitAt: entry.github?.pushedAt ?? null,
    };
    const differing = HEALTH_PARITY_FIELDS.filter((field) =>
      field === 'lastCommitAt'
        ? !sameInstant(values.lastCommitAt, fileValues.lastCommitAt)
        : values[field] !== fileValues[field],
    );
    if (differing.length === 0) continue;
    const detail = differing
      .map((field) => `${field} ${values[field]} (inline) vs ${fileValues[field]} (file)`)
      .join(', ');
    issues.push({
      code: 'health_source_mismatch',
      message: `${slug}: inline health disagrees with ${healthPath} — ${detail}`,
      severity: 'warning',
    });
  }
  for (const entry of entries) {
    if (recordSlugs.has(entry.id)) continue;
    issues.push({
      code: 'health_file_orphan_entry',
      message: `${healthPath}: entry "${entry.id}" has no matching record`,
      severity: 'warning',
    });
  }
  return issues;
}

async function taxonomyIds(path: string): Promise<Set<string>> {
  try {
    const raw = parseYaml(await readFile(path, 'utf8'), { schema: 'core' });
    if (!Array.isArray(raw)) return new Set();
    return new Set(
      raw
        .map((entry) =>
          entry && typeof entry === 'object' ? (entry as { id?: unknown }).id : undefined,
        )
        .filter((id): id is string => typeof id === 'string'),
    );
  } catch {
    return new Set();
  }
}

/**
 * Validate a Grove project: read every record YAML under
 * `config.paths.recordsDir`, run full Zod parsing, and surface any
 * schema, slug, link, health, or decision reference issues.
 *
 * Each record is run through the same Zod schema the build pipeline
 * uses (see `recordsFileSchema`). Validation catches both schema
 * problems (missing fields, wrong types) and reference problems
 * (duplicate slugs, missing health entries, dangling decision ids).
 */
export async function validateProject(
  config: GroveConfig,
  opts: { strict?: boolean } = {},
): Promise<ValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const recordsDir = resolve(process.cwd(), config.paths.recordsDir);

  if (!(await exists(recordsDir))) {
    errors.push({
      code: 'missing_records_dir',
      message: `${config.paths.recordsDir} does not exist`,
      severity: 'error',
    });
    return finalize(errors, warnings);
  }

  const expectedKind = blueprintKind[config.blueprint];
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith('.yml')).sort();
  const slugs = new Set<string>();
  /** Slugs that have a github link and therefore need a health entry. */
  const slugsNeedingHealth = new Set<string>();
  /** Inline health per slug, compared against health.yml once it is read. */
  const inlineHealth = new Map<string, HealthParityValues>();
  const taxonomyDir = config.paths.taxonomyDir ?? 'data/taxonomy';
  const taxonomy = {
    categories: await taxonomyIds(resolve(process.cwd(), taxonomyDir, 'categories.yml')),
    stacks: await taxonomyIds(resolve(process.cwd(), taxonomyDir, 'stacks.yml')),
    platforms: await taxonomyIds(resolve(process.cwd(), taxonomyDir, 'platforms.yml')),
  };
  // ── Subjects ───────────────────────────────────────────────────────
  // `data/taxonomy/subjects.yml` is optional. When a site has none, a
  // record relation or a collection `subject` has nothing to resolve
  // against, which is an error rather than something to skip quietly.
  const subjectsFile = `${taxonomyDir}/subjects.yml`;
  const subjectIds = new Set<string>();
  if (await exists(resolve(process.cwd(), subjectsFile))) {
    let rawSubjects: unknown;
    try {
      rawSubjects = parseYaml(await readFile(resolve(process.cwd(), subjectsFile), 'utf8'), {
        schema: 'core',
      });
    } catch (err) {
      errors.push({
        code: 'subject_invalid',
        message: `${subjectsFile}: ${(err as Error).message}`,
        severity: 'error',
      });
    }
    if (rawSubjects !== undefined && rawSubjects !== null && !Array.isArray(rawSubjects)) {
      errors.push({
        code: 'subject_invalid',
        message: `${subjectsFile}: expected a YAML list of subjects`,
        severity: 'error',
      });
    }
    for (const [index, item] of (Array.isArray(rawSubjects) ? rawSubjects : []).entries()) {
      const parsedSubject = subjectSchema.safeParse(item);
      if (!parsedSubject.success) {
        for (const issue of parsedSubject.error.issues) {
          errors.push({
            code: 'subject_invalid',
            message: `${subjectsFile}[${index}]: ${issue.path.join('.') || '(root)'} ${issue.message}`,
            severity: 'error',
          });
        }
        continue;
      }
      if (subjectIds.has(parsedSubject.data.id)) {
        errors.push({
          code: 'duplicate_subject',
          message: `${subjectsFile}: subject "${parsedSubject.data.id}" is defined twice`,
          severity: 'error',
        });
      }
      subjectIds.add(parsedSubject.data.id);
    }
  }
  /** Subject id → slugs of the records related to it. */
  const relatedRecords = new Map<string, Set<string>>();

  /** Every record that parsed — the stream collections are checked against. */
  const parsedRecords: Resource[] = [];

  const warnUnknownTaxonomy = (
    fileSlug: string,
    field: string,
    value: string,
    ids: Set<string>,
    filename: string,
  ) => {
    if (ids.size === 0 || ids.has(value)) return;
    warnings.push({
      code: 'unknown_taxonomy_value',
      message: `${fileSlug}: ${field} "${value}" is not defined in ${taxonomyDir}/${filename}`,
      severity: 'warning',
    });
  };

  for (const file of files) {
    const fileSlug = basename(file, '.yml');
    const text = await readFile(join(recordsDir, file), 'utf8');
    // `schema: 'core'` disables custom-tag interpretation; a malicious
    // record with `!!binary` / `!!js/function` would otherwise be parsed
    // into a host object by the YAML package's default schema.
    // Implementation-checklist.md #27.
    const raw = parseYaml(text, { schema: 'core' }) as Record<string, unknown> | null;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({
        code: 'schema_error',
        message: `${fileSlug}: record file is empty or not a YAML mapping`,
        severity: 'error',
      });
      slugs.add(fileSlug);
      continue;
    }
    const obj = raw as Record<string, unknown>;

    // Slug uniqueness — even if a record later fails Zod parse, we
    // still need to flag a duplicate filename as an error.
    if (slugs.has(fileSlug)) {
      errors.push({
        code: 'duplicate_slug',
        message: `Duplicate record slug: ${fileSlug}`,
        severity: 'error',
      });
    }
    slugs.add(fileSlug);

    // Full Zod parse — this is the source of truth for "is this a
    // valid record". Each issue becomes a `zod_error` validation
    // issue with the issue path baked into the message. If the
    // parse throws something that isn't a ZodError (e.g. file
    // doesn't exist anymore), surface it as a generic schema error.
    if (!obj.kind) obj.kind = expectedKind;
    let parsed: Resource;
    try {
      parsed = recordsFileSchema.parse(obj);
    } catch (err) {
      if (err instanceof ZodError) {
        for (const issue of err.issues) {
          const where = issue.path.length > 0 ? issue.path.join('.') : '(root)';
          errors.push({
            code: 'zod_error',
            message: `${fileSlug}: ${where} ${issue.message}`,
            severity: 'error',
          });
        }
      } else {
        errors.push({
          code: 'schema_error',
          message: `${fileSlug}: ${(err as Error).message}`,
          severity: 'error',
        });
      }
      continue;
    }
    parsedRecords.push({ ...parsed, slug: fileSlug });
    for (const relation of parsed.relations) {
      if (!subjectIds.has(relation.to)) {
        errors.push({
          code: 'unknown_subject',
          message: `${fileSlug}: relations → "${relation.to}" is not defined in ${subjectsFile}`,
          severity: 'error',
        });
        continue;
      }
      const related = relatedRecords.get(relation.to) ?? new Set<string>();
      related.add(fileSlug);
      relatedRecords.set(relation.to, related);
    }
    // Override the filename-derived slug with the record's own slug
    // before downstream checks (links/health) consume it. Filename
    // and record.slug must agree; mismatch is itself a warning.
    if (parsed.slug !== fileSlug) {
      warnings.push({
        code: 'slug_mismatch',
        message: `${fileSlug}: record slug "${parsed.slug}" does not match filename`,
        severity: 'warning',
      });
    }
    // A record with no `addedAt` still builds — `recordAddedAt` falls
    // back — but it can never sort correctly in `recently-added`, and
    // nothing else in the pipeline will ever fill the field in. Say so
    // once, at the point the record is read.
    if (!parsed.addedAt) {
      warnings.push({
        code: 'missing_added_at',
        message: `${fileSlug}: no addedAt — the recently-added sort will fall back to the review or repo date`,
        severity: 'warning',
      });
    }
    warnUnknownTaxonomy(
      fileSlug,
      'category',
      parsed.category,
      taxonomy.categories,
      'categories.yml',
    );
    if (parsed.kind === 'project') {
      // `stack` is the canonical browse taxonomy. `stacks` contains
      // supporting technologies and is intentionally open-ended.
      if (parsed.stack) {
        warnUnknownTaxonomy(fileSlug, 'stack', parsed.stack, taxonomy.stacks, 'stacks.yml');
      }
      for (const platform of parsed.platforms) {
        warnUnknownTaxonomy(fileSlug, 'platform', platform, taxonomy.platforms, 'platforms.yml');
      }
    }
    // Records that link to a GitHub repo need a health entry — either
    // inline on the record itself (what `sync github` now writes) or,
    // for records synced before that change, in health.yml — so
    // list/detail UIs can render staleness signals.
    const repoUrl = (parsed as { repoUrl?: string }).repoUrl;
    const linksGithub = (parsed.links as { github?: string } | undefined)?.github;
    const hasInlineHealth = parsed.kind === 'project' && Boolean(parsed.health);
    if ((repoUrl || linksGithub) && !hasInlineHealth) {
      slugsNeedingHealth.add(fileSlug);
    }
    if (parsed.kind === 'project' && parsed.health) {
      const github = parsed.github as
        | { pushedAt?: string | null; repository?: { pushed_at?: string | null } }
        | undefined;
      inlineHealth.set(fileSlug, {
        status: parsed.health.status,
        tier: parsed.health.tier,
        visibility: parsed.health.visibility,
        // Same fallback chain the sitemap/index use for lastCommitAt.
        lastCommitAt:
          (parsed as { lastCommitAt?: string | null }).lastCommitAt ??
          github?.pushedAt ??
          github?.repository?.pushed_at ??
          null,
      });
    }
  }

  if (await exists(resolve(process.cwd(), config.paths.health))) {
    let health: ReturnType<typeof unwrapHealth> = [];
    let healthParsed = false;
    try {
      health = unwrapHealth(healthFileSchema.parse(await readYamlFile(config.paths.health)));
      healthParsed = true;
    } catch (err) {
      errors.push({
        code: 'health_file_invalid',
        message: `${config.paths.health}: ${(err as Error).message}`,
        severity: 'error',
      });
    }
    // The build prefers inline health and only falls back to health.yml,
    // so a file that drifts from the records is a second source of truth
    // nobody reads. Flag the drift; skip it when the file didn't parse.
    if (healthParsed)
      warnings.push(...healthParityIssues(config.paths.health, health, inlineHealth, slugs));
    const healthIds = new Set(health.map((entry) => entry.id));
    for (const slug of slugsNeedingHealth) {
      if (healthIds.has(slug)) continue;
      errors.push({
        code: 'missing_health',
        message: `${slug} has a GitHub link but no health entry`,
        severity: 'error',
      });
    }
  } else if (slugsNeedingHealth.size > 0) {
    // Health file is optional, but if any record points at a GitHub
    // repo we expect a health file to exist (or `sync github` to
    // produce one). Flag it as a warning so the operator knows.
    warnings.push({
      code: 'missing_health_file',
      message: `${config.paths.health} is missing but ${slugsNeedingHealth.size} record(s) link to GitHub repos`,
      severity: 'warning',
    });
  }

  if (await exists(resolve(process.cwd(), config.paths.decisions))) {
    let decisions: ReturnType<typeof unwrapDecisions> = [];
    try {
      decisions = unwrapDecisions(
        decisionsFileSchema.parse(await readYamlFile(config.paths.decisions)),
      );
    } catch (err) {
      errors.push({
        code: 'decisions_file_invalid',
        message: `${config.paths.decisions}: ${(err as Error).message}`,
        severity: 'error',
      });
    }
    for (const decision of decisions) {
      if (!slugs.has(decision.id)) {
        errors.push({
          code: 'unknown_decision_record',
          message: `Decision references unknown record: ${decision.id}`,
          severity: 'error',
        });
      }
    }
  }

  // ── Collections ────────────────────────────────────────────────────
  // Parsed with the same function the build uses, so a file that would
  // throw during `astro build` fails here first, with every problem
  // listed instead of only the first.
  const collectionsDir = resolve(process.cwd(), 'data/collections');
  const collectionFiles = (await readdir(collectionsDir).catch(() => [] as string[]))
    .filter((f) => f.endsWith('.yml'))
    .sort();
  const collectionSlugs = new Map<string, string>();
  const collectionEntries = toCollectionEntries(parsedRecords as CollectionSourceRecord[], {
    routeSlug: config.routes?.directory ?? 'projects',
  });
  const inStream = new Set(collectionEntries.map((entry) => entry.slug));
  /** Subject id → the collection file that is its hub. */
  const hubs = new Map<string, string>();
  for (const file of collectionFiles) {
    const where = `collections/${file}`;
    let collection: ReturnType<typeof parseCollectionFile>;
    try {
      collection = parseCollectionFile(file, await readFile(join(collectionsDir, file), 'utf8'));
    } catch (err) {
      const problems = err instanceof CollectionFileError ? err.problems : [(err as Error).message];
      for (const problem of problems) {
        errors.push({
          code: 'collection_invalid',
          message: `${where}: ${problem}`,
          severity: 'error',
        });
      }
      continue;
    }
    const firstFile = collectionSlugs.get(collection.slug);
    if (firstFile) {
      errors.push({
        code: 'duplicate_collection_slug',
        message: `${where}: slug "${collection.slug}" is already used by collections/${firstFile}`,
        severity: 'error',
      });
      continue;
    }
    collectionSlugs.set(collection.slug, file);
    if (collection.slug !== basename(file, '.yml')) {
      warnings.push({
        code: 'collection_slug_mismatch',
        message: `${where}: slug "${collection.slug}" does not match the file name`,
        severity: 'warning',
      });
    }
    const referenced = [
      ...(collection.subject ? [collection.subject] : []),
      ...(collection.query.relatedTo?.subjects ?? []),
    ];
    for (const id of new Set(referenced)) {
      if (!subjectIds.has(id)) {
        errors.push({
          code: 'collection_unknown_subject',
          message: `${where}: subject "${id}" is not defined in ${subjectsFile}`,
          severity: 'error',
        });
      }
    }
    if (collection.subject) {
      const otherHub = hubs.get(collection.subject);
      if (otherHub) {
        errors.push({
          code: 'duplicate_subject_hub',
          message: `${where}: subject "${collection.subject}" already has a hub, collections/${otherHub}`,
          severity: 'error',
        });
      } else {
        hubs.set(collection.subject, file);
      }
    }
    for (const id of collection.query.categories ?? []) {
      warnUnknownTaxonomy(where, 'query.categories', id, taxonomy.categories, 'categories.yml');
    }
    for (const id of collection.query.stacks ?? []) {
      warnUnknownTaxonomy(where, 'query.stacks', id, taxonomy.stacks, 'stacks.yml');
    }
    for (const id of collection.query.platforms ?? []) {
      warnUnknownTaxonomy(where, 'query.platforms', id, taxonomy.platforms, 'platforms.yml');
    }
    for (const pick of collection.entries ?? []) {
      if (!slugs.has(pick.slug)) {
        errors.push({
          code: 'collection_unknown_entry',
          message: `${where}: entries lists "${pick.slug}", which is not a record`,
          severity: 'error',
        });
      } else if (!inStream.has(pick.slug)) {
        warnings.push({
          code: 'collection_hidden_entry',
          message: `${where}: entries lists "${pick.slug}", which is hidden or removed and will not render`,
          severity: 'warning',
        });
      }
    }
    if (collection.content && !(await exists(resolve(process.cwd(), collection.content)))) {
      errors.push({
        code: 'collection_body_missing',
        message: `${where}: content "${collection.content}" does not exist`,
        severity: 'error',
      });
    }
    if (runCollection(collection, collectionEntries).isEmpty) {
      warnings.push({
        code: 'collection_empty',
        message: `${where}: no record matches this collection's query`,
        severity: 'warning',
      });
    }
  }

  // A subject several records relate to, with no page that gathers
  // them: the records each say "alternative to X" and nothing answers
  // "what are the alternatives to X".
  for (const [subject, related] of relatedRecords) {
    if (related.size >= SUBJECT_HUB_MIN_RECORDS && !hubs.has(subject)) {
      warnings.push({
        code: 'subject_without_collection',
        message: `subject "${subject}" has ${related.size} related records and no collection declares \`subject: ${subject}\``,
        severity: 'warning',
      });
    }
  }

  return finalize(errors, warnings, opts.strict);
}

function finalize(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  strict = false,
): ValidationResult {
  // In strict mode, warnings also fail validation.
  const ok = errors.length === 0 && (!strict || warnings.length === 0);
  return {
    ok,
    errors,
    warnings,
    issues: [...errors, ...warnings],
  };
}

/**
 * Load and normalize every record YAML under `config.paths.recordsDir`.
 *
 * @param config Grove config (provides `paths.recordsDir` and `blueprint`)
 * @param opts.onError 'skip' (default) silently drops schema failures;
 *   'throw' raises on the first failure with the file slug and the
 *   Zod issue path in the error message.
 * @param opts.cwd Working directory to resolve `paths.recordsDir`
 *   against. Defaults to `process.cwd()`.
 *
 * For callers that want the strict-by-default behaviour, see
 * `loadRecordsOrThrow`. `validateProject` is the recommended
 * surface for surfacing failures with full error reporting.
 */
export async function loadRecords(
  config: GroveConfig,
  opts: { onError?: 'skip' | 'throw'; cwd?: string } = {},
): Promise<Resource[]> {
  const onError = opts.onError ?? 'skip';
  const cwd = opts.cwd ?? process.cwd();
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith('.yml')).sort();
  const expectedKind = blueprintKind[config.blueprint];
  const out: Resource[] = [];
  for (const file of files) {
    const fileSlug = basename(file, '.yml');
    const text = await readFile(join(recordsDir, file), 'utf8');
    // `schema: 'core'` disables custom-tag interpretation. Same
    // rationale as the `readRecords` block above.
    const raw = parseYaml(text, { schema: 'core' }) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      if (onError === 'throw') {
        throw new Error(`${fileSlug}: record file is empty or not a YAML mapping`);
      }
      continue;
    }
    if (!raw.kind) raw.kind = expectedKind;
    try {
      const parsed = recordsFileSchema.parse(raw);
      parsed.slug = fileSlug;
      out.push(parsed);
    } catch (err) {
      if (onError === 'throw') throw err;
      // skip — validation should have caught this
    }
  }
  return out;
}

/**
 * Strict variant of `loadRecords` — throws on the first schema failure
 * with the file slug and the Zod issue path in the error message.
 * Recommended for build pipelines; `loadRecords` is the lenient
 * helper for previews and dev-time inspection.
 */
export function loadRecordsOrThrow(
  config: GroveConfig,
  opts: { cwd?: string } = {},
): Promise<Resource[]> {
  return loadRecords(config, { ...opts, onError: 'throw' });
}
