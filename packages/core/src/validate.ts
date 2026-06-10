import { access, readdir, readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  blueprintKind,
  decisionsFileSchema,
  healthFileSchema,
  recordsFileSchema,
  unwrapDecisions,
  unwrapHealth,
  unwrapRecords,
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

/**
 * Validate a Grove project: read every record YAML under
 * `config.paths.recordsDir`, check for duplicate slugs, missing
 * required fields, taxonomy reference problems, and dangling health
 * or decision references.
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
  const records: Resource[] = [];
  const slugs = new Set<string>();

  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    const text = await readFile(join(recordsDir, file), "utf8");
    const raw = parseYaml(text) as Record<string, unknown> | null;
    const obj = (raw ?? {}) as Record<string, unknown>;
    if (slugs.has(fileSlug)) {
      errors.push({
        code: "duplicate_slug",
        message: `Duplicate record slug: ${fileSlug}`,
        severity: "error",
      });
    }
    slugs.add(fileSlug);
    if (!obj.description || !(obj.description as string).trim()) {
      errors.push({
        code: "missing_description",
        message: `${fileSlug} is missing a description`,
        severity: "error",
      });
    }
    const kind = (obj.kind as string | undefined) ?? expectedKind;
    if (kind !== expectedKind) {
      errors.push({
        code: "kind_blueprint_mismatch",
        message: `${fileSlug}: kind "${kind}" does not match blueprint "${config.blueprint}" (expected "${expectedKind}")`,
        severity: "error",
      });
    }
    const links = (obj.links as Record<string, unknown> | undefined) ?? {};
    // Blueprint-aware link check: each blueprint has a different
    // canonical "where does this record live" answer.
    //   project-directory → github OR website
    //   resource-hub      → source OR github OR website
    //   ecosystem-map     → website
    const linkOk =
      config.blueprint === "project-directory"
        ? Boolean(links.github || links.website)
        : config.blueprint === "resource-hub"
          ? Boolean(links.source || links.github || links.website)
          : Boolean(links.website);
    if (!linkOk) {
      const required =
        config.blueprint === "project-directory"
          ? "github or website"
          : config.blueprint === "resource-hub"
            ? "source, github, or website"
            : "website";
      errors.push({
        code: "missing_link",
        message: `${fileSlug} has no ${required} link`,
        severity: "error",
      });
    }
    records.push(obj as unknown as Resource);
  }

  if (await exists(resolve(process.cwd(), config.paths.health))) {
    const health = unwrapHealth(
      healthFileSchema.parse(await readYamlFile(config.paths.health)),
    );
    const healthIds = new Set(health.map((entry) => entry.id));
    for (const record of records) {
      const links = (record as { links?: { github?: string } }).links;
      if (links?.github && !healthIds.has(record.slug)) {
        errors.push({
          code: "missing_health",
          message: `${record.slug} has a GitHub link but no health entry`,
          severity: "error",
        });
      }
    }
  }

  if (await exists(resolve(process.cwd(), config.paths.decisions))) {
    const decisions = unwrapDecisions(
      decisionsFileSchema.parse(await readYamlFile(config.paths.decisions)),
    );
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
 * Records that fail validation are skipped silently — use
 * `validateProject` to surface the failures.
 */
export async function loadRecords(config: GroveConfig): Promise<Resource[]> {
  const recordsDir = resolve(process.cwd(), config.paths.recordsDir);
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".yml")).sort();
  const expectedKind = blueprintKind[config.blueprint];
  const out: Resource[] = [];
  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    const text = await readFile(join(recordsDir, file), "utf8");
    const raw = parseYaml(text) as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") continue;
    if (!raw.kind) raw.kind = expectedKind;
    try {
      out.push(unwrapRecords(recordsFileSchema.parse([raw]))[0]);
    } catch {
      // skip — validation should have caught this
    }
  }
  return out;
}
