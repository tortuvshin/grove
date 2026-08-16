import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import {
  blueprintKind,
  decisionsFileSchema,
  healthFileSchema,
  knownNestedKeys,
  knownRecordKeys,
  recordsFileSchema,
  unwrapDecisions,
  unwrapHealth,
  type GroveConfig,
  type Resource,
} from "./schema.js";
import { readYamlFile } from "./io.js";

export type ValidationSeverity = "error" | "warning";

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

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function taxonomyIds(path: string): Promise<Set<string>> {
  try {
    const raw = parseYaml(await readFile(path, "utf8"), { schema: "core" });
    if (!Array.isArray(raw)) return new Set();
    return new Set(
      raw
        .map((entry) =>
          entry && typeof entry === "object"
            ? (entry as { id?: unknown }).id
            : undefined,
        )
        .filter((id): id is string => typeof id === "string"),
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
      code: "missing_records_dir",
      message: `${config.paths.recordsDir} does not exist`,
      severity: "error",
    });
    return finalize(errors, warnings);
  }

  const expectedKind = blueprintKind[config.blueprint];
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".yml")).sort();
  const slugs = new Set<string>();
  /** Slugs that have a github link and therefore need a health entry. */
  const slugsNeedingHealth = new Set<string>();
  /** `alternatives[].slug` references, resolved once every slug is known. */
  const alternativeSlugRefs: { from: string; to: string }[] = [];
  const taxonomyDir = config.paths.taxonomyDir ?? "data/taxonomy";
  const taxonomy = {
    categories: await taxonomyIds(
      resolve(process.cwd(), taxonomyDir, "categories.yml"),
    ),
    stacks: await taxonomyIds(resolve(process.cwd(), taxonomyDir, "stacks.yml")),
    platforms: await taxonomyIds(
      resolve(process.cwd(), taxonomyDir, "platforms.yml"),
    ),
  };

  const warnUnknownTaxonomy = (
    fileSlug: string,
    field: string,
    value: string,
    ids: Set<string>,
    filename: string,
  ) => {
    if (ids.size === 0 || ids.has(value)) return;
    warnings.push({
      code: "unknown_taxonomy_value",
      message: `${fileSlug}: ${field} "${value}" is not defined in ${taxonomyDir}/${filename}`,
      severity: "warning",
    });
  };

  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    const text = await readFile(join(recordsDir, file), "utf8");
    // `schema: 'core'` disables custom-tag interpretation; a malicious
    // record with `!!binary` / `!!js/function` would otherwise be parsed
    // into a host object by the YAML package's default schema.
    // Implementation-checklist.md #27.
    const raw = parseYaml(text, { schema: "core" }) as Record<string, unknown> | null;
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push({
        code: "schema_error",
        message: `${fileSlug}: record file is empty or not a YAML mapping`,
        severity: "error",
      });
      slugs.add(fileSlug);
      continue;
    }
    const obj = raw as Record<string, unknown>;

    // Slug uniqueness — even if a record later fails Zod parse, we
    // still need to flag a duplicate filename as an error.
    if (slugs.has(fileSlug)) {
      errors.push({
        code: "duplicate_slug",
        message: `Duplicate record slug: ${fileSlug}`,
        severity: "error",
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
          const where = issue.path.length > 0 ? issue.path.join(".") : "(root)";
          errors.push({
            code: "zod_error",
            message: `${fileSlug}: ${where} ${issue.message}`,
            severity: "error",
          });
        }
      } else {
        errors.push({
          code: "schema_error",
          message: `${fileSlug}: ${(err as Error).message}`,
          severity: "error",
        });
      }
      continue;
    }
    // Fields the schema does not define parse cleanly and are then
    // dropped by Zod's default strip behaviour, so they never reach
    // `data/generated/` or a template. Without this warning that data
    // loss is completely silent — the record looks accepted.
    const knownTop = knownRecordKeys(String(obj.kind));
    for (const key of Object.keys(obj)) {
      if (knownTop.has(key)) continue;
      warnings.push({
        code: "unknown_field",
        message: `${fileSlug}: "${key}" is not defined in the record schema and will be discarded`,
        severity: "warning",
      });
    }
    for (const [block, value] of Object.entries(obj)) {
      const knownNested = knownNestedKeys(block);
      if (!knownNested || !value || typeof value !== "object" || Array.isArray(value)) {
        continue;
      }
      for (const key of Object.keys(value as Record<string, unknown>)) {
        if (knownNested.has(key)) continue;
        warnings.push({
          code: "unknown_field",
          message: `${fileSlug}: "${block}.${key}" is not defined in the record schema and will be discarded`,
          severity: "warning",
        });
      }
    }

    // Override the filename-derived slug with the record's own slug
    // before downstream checks (links/health) consume it. Filename
    // and record.slug must agree; mismatch is itself a warning.
    if (parsed.slug !== fileSlug) {
      warnings.push({
        code: "slug_mismatch",
        message: `${fileSlug}: record slug "${parsed.slug}" does not match filename`,
        severity: "warning",
      });
    }
    warnUnknownTaxonomy(
      fileSlug,
      "category",
      parsed.category,
      taxonomy.categories,
      "categories.yml",
    );
    if (parsed.kind === "project") {
      // `stack` is the canonical browse taxonomy. `stacks` contains
      // supporting technologies and is intentionally open-ended.
      if (parsed.stack) {
        warnUnknownTaxonomy(
          fileSlug,
          "stack",
          parsed.stack,
          taxonomy.stacks,
          "stacks.yml",
        );
      }
      for (const platform of parsed.platforms) {
        warnUnknownTaxonomy(
          fileSlug,
          "platform",
          platform,
          taxonomy.platforms,
          "platforms.yml",
        );
      }
    }
    // Tier gates. A tier is a public claim about how much human work
    // stands behind a record, so it must not outrun the data: these
    // are errors, not warnings.
    if (parsed.kind === "project") {
      const editorial = parsed.editorial;
      const tier = editorial.tier;
      const failTier = (message: string) => {
        errors.push({
          code: "tier_requirements_unmet",
          message: `${fileSlug}: ${message}`,
          severity: "error",
        });
      };
      if (tier === "reviewed" || tier === "featured") {
        if (!editorial.reviewedAt) {
          failTier(`tier "${tier}" requires editorial.reviewedAt`);
        }
        if (!editorial.reviewedBy) {
          failTier(`tier "${tier}" requires editorial.reviewedBy`);
        }
        if (!editorial.verdict) {
          failTier(`tier "${tier}" requires editorial.verdict`);
        }
        if (parsed.bestFor.length === 0) {
          failTier(`tier "${tier}" requires at least one bestFor entry`);
        }
        if (parsed.caveats.length === 0) {
          failTier(`tier "${tier}" requires at least one caveat`);
        }
        if (parsed.evidence.length === 0) {
          failTier(`tier "${tier}" requires at least one evidence entry`);
        }
      }
      if (tier === "featured") {
        if (parsed.screenshots.length === 0) {
          failTier('tier "featured" requires at least one screenshot');
        }
        if (parsed.alternatives.length === 0) {
          failTier('tier "featured" requires at least one alternative');
        }
      }
      // A review cannot have happened in the future, and a next review
      // cannot fall before the review it follows.
      const reviewedAt = editorial.reviewedAt;
      if (reviewedAt && isFutureDate(reviewedAt)) {
        failTier(`editorial.reviewedAt "${reviewedAt}" is in the future`);
      }
      if (
        reviewedAt &&
        editorial.nextReviewAt &&
        editorial.nextReviewAt < reviewedAt
      ) {
        failTier(
          `editorial.nextReviewAt "${editorial.nextReviewAt}" precedes reviewedAt "${reviewedAt}"`,
        );
      }
      // Evidence ids must be unique so markdown bodies can reference
      // a claim unambiguously.
      const seenEvidence = new Set<string>();
      for (const entry of parsed.evidence) {
        if (seenEvidence.has(entry.id)) {
          errors.push({
            code: "duplicate_evidence_id",
            message: `${fileSlug}: duplicate evidence id "${entry.id}"`,
            severity: "error",
          });
        }
        seenEvidence.add(entry.id);
      }
      // An alternative that names a record by slug must point at one
      // that exists; cross-checked after every file is read.
      for (const alt of parsed.alternatives) {
        if (alt.slug) alternativeSlugRefs.push({ from: fileSlug, to: alt.slug });
      }
    }

    // Records that link to a GitHub repo need a matching health entry
    // so list/detail UIs can render staleness signals. Track here and
    // cross-check against health.yml below.
    const repoUrl = (parsed as { repoUrl?: string }).repoUrl;
    const linksGithub = (parsed.links as { github?: string } | undefined)?.github;
    if (repoUrl || linksGithub) {
      slugsNeedingHealth.add(fileSlug);
    }
  }

  for (const ref of alternativeSlugRefs) {
    if (slugs.has(ref.to)) continue;
    warnings.push({
      code: "unknown_alternative_record",
      message: `${ref.from}: alternatives references unknown record "${ref.to}"`,
      severity: "warning",
    });
  }

  if (await exists(resolve(process.cwd(), config.paths.health))) {
    let health: ReturnType<typeof unwrapHealth> = [];
    try {
      health = unwrapHealth(
        healthFileSchema.parse(await readYamlFile(config.paths.health)),
      );
    } catch (err) {
      errors.push({
        code: "health_file_invalid",
        message: `${config.paths.health}: ${(err as Error).message}`,
        severity: "error",
      });
    }
    const healthIds = new Set(health.map((entry) => entry.id));
    for (const slug of slugsNeedingHealth) {
      if (healthIds.has(slug)) continue;
      errors.push({
        code: "missing_health",
        message: `${slug} has a GitHub link but no health entry`,
        severity: "error",
      });
    }
  } else if (slugsNeedingHealth.size > 0) {
    // Health file is optional, but if any record points at a GitHub
    // repo we expect a health file to exist (or `sync github` to
    // produce one). Flag it as a warning so the operator knows.
    warnings.push({
      code: "missing_health_file",
      message: `${config.paths.health} is missing but ${slugsNeedingHealth.size} record(s) link to GitHub repos`,
      severity: "warning",
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
        code: "decisions_file_invalid",
        message: `${config.paths.decisions}: ${(err as Error).message}`,
        severity: "error",
      });
    }
    for (const decision of decisions) {
      if (!slugs.has(decision.id)) {
        errors.push({
          code: "unknown_decision_record",
          message: `Decision references unknown record: ${decision.id}`,
          severity: "error",
        });
      }
    }
  }

  return finalize(errors, warnings, opts.strict);
}

/**
 * True when `value` parses as a date after today. Unparseable strings
 * are not treated as future — the schema only requires a non-empty
 * string, and a malformed date is a separate concern from a dishonest
 * one.
 */
function isFutureDate(value: string): boolean {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return parsed > today.getTime();
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
  opts: { onError?: "skip" | "throw"; cwd?: string } = {},
): Promise<Resource[]> {
  const onError = opts.onError ?? "skip";
  const cwd = opts.cwd ?? process.cwd();
  const recordsDir = resolve(cwd, config.paths.recordsDir);
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".yml")).sort();
  const expectedKind = blueprintKind[config.blueprint];
  const out: Resource[] = [];
  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    const text = await readFile(join(recordsDir, file), "utf8");
    // `schema: 'core'` disables custom-tag interpretation. Same
    // rationale as the `readRecords` block above.
    const raw = parseYaml(text, { schema: "core" }) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") {
      if (onError === "throw") {
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
      if (onError === "throw") throw err;
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
  return loadRecords(config, { ...opts, onError: "throw" });
}
