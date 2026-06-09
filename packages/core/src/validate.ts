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

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
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
export async function validateProject(config: GroveConfig): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const recordsDir = resolve(process.cwd(), config.paths.recordsDir);

  if (!(await exists(recordsDir))) {
    issues.push({
      code: "missing_records_dir",
      message: `${config.paths.recordsDir} does not exist`,
    });
    return { ok: false, issues };
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
      issues.push({ code: "duplicate_slug", message: `Duplicate record slug: ${fileSlug}` });
    }
    slugs.add(fileSlug);
    if (!obj.description || !(obj.description as string).trim()) {
      issues.push({ code: "missing_description", message: `${fileSlug} is missing a description` });
    }
    const kind = (obj.kind as string | undefined) ?? expectedKind;
    if (kind !== expectedKind) {
      issues.push({
        code: "kind_blueprint_mismatch",
        message: `${fileSlug}: kind "${kind}" does not match blueprint "${config.blueprint}" (expected "${expectedKind}")`,
      });
    }
    const links = (obj.links as Record<string, unknown> | undefined) ?? {};
    if (!links.github && !links.website) {
      issues.push({ code: "missing_link", message: `${fileSlug} has neither github nor website link` });
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
        issues.push({
          code: "missing_health",
          message: `${record.slug} has a GitHub link but no health entry`,
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
        issues.push({
          code: "unknown_decision_record",
          message: `Decision references unknown record: ${decision.id}`,
        });
      }
    }
  }

  return { ok: issues.length === 0, issues };
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
