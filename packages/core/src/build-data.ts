import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  blueprintKind,
  toIndexRecord,
  type GroveConfig,
  type Resource,
} from "./schema.js";
import { loadConfig } from "./config.js";
import { loadRecords } from "./validate.js";

/**
 * The full payload written to data/generated/records.full.json.
 * Carries every normalized record, regardless of visibility.
 */
export interface RecordsFullPayload {
  schemaVersion: number;
  blueprint: string;
  generatedAt: string;
  totalRecords: number;
  visibleRecords: number;
  records: Array<Record<string, unknown>>;
}

/**
 * The slim payload written to data/generated/records.index.json.
 * Carries only what list and search pages need.
 */
export interface RecordsIndexPayload {
  schemaVersion: number;
  blueprint: string;
  generatedAt: string;
  totalRecords: number;
  records: Array<Record<string, unknown>>;
}

/**
 * Read every records/*.yml in the project, normalize, and build:
 *  - data/generated/records.full.json   (full records, all visibility)
 *  - data/generated/records.index.json  (slim, visible-only)
 *  - data/generated/records.json        (compatibility alias of records.full.json)
 */
export interface BuildDataResult {
  totalRecords: number;
  visibleRecords: number;
  fullPath: string;
  indexPath: string;
  aliasPath: string;
  errors: string[];
}

export async function buildData(
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<BuildDataResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const recordsDir = resolve(cwd, cfg.paths.recordsDir);
  const outDir = resolve(cwd, cfg.paths.generatedDir);
  await mkdir(outDir, { recursive: true });

  const expectedKind = blueprintKind[cfg.blueprint];
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".yml")).sort();

  const records: Resource[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    try {
      const text = await readFile(join(recordsDir, file), "utf8");
      const { parse } = await import("yaml");
      const raw = (parse(text) ?? {}) as Record<string, unknown>;
      if (!raw.kind) raw.kind = expectedKind;
      const records = (await import("./schema.js")).recordsFileSchema;
      const normalized = (await import("./schema.js")).unwrapRecords(
        records.parse([raw]),
      )[0];
      normalized.slug = fileSlug;
      records.push(normalized);
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`);
    }
  }
  if (errors.length > 0) {
    const e = new Error(`generate failed: ${errors.length} schema error(s)`);
    (e as Error & { details?: string[] }).details = errors;
    throw e;
  }

  records.sort((a, b) => {
    const na = nameOf(a);
    const nb = nameOf(b);
    return na.localeCompare(nb);
  });

  const indexRecords = records
    .map((record) => toIndexRecord(record))
    .filter((r) => {
      const vis = (r as { visibility?: string }).visibility;
      return vis !== "hide" && vis !== "remove";
    });

  const generatedAt = new Date().toISOString();
  const fullPayload: RecordsFullPayload = {
    schemaVersion: 1,
    blueprint: cfg.blueprint,
    generatedAt,
    totalRecords: records.length,
    visibleRecords: indexRecords.length,
    records: records as unknown as Array<Record<string, unknown>>,
  };
  const indexPayload: RecordsIndexPayload = {
    schemaVersion: 1,
    blueprint: cfg.blueprint,
    generatedAt,
    totalRecords: indexRecords.length,
    records: indexRecords as unknown as Array<Record<string, unknown>>,
  };

  const fullPath = join(outDir, "records.full.json");
  const indexPath = join(outDir, "records.index.json");
  const aliasPath = join(outDir, "records.json");
  await writeFile(fullPath, JSON.stringify(fullPayload, null, 2), "utf8");
  await writeFile(indexPath, JSON.stringify(indexPayload, null, 2), "utf8");
  await writeFile(aliasPath, JSON.stringify(fullPayload, null, 2), "utf8");

  return {
    totalRecords: records.length,
    visibleRecords: indexRecords.length,
    fullPath,
    indexPath,
    aliasPath,
    errors,
  };
}

function nameOf(record: Resource): string {
  if (record.kind === "resource") return record.title;
  return record.name;
}

/**
 * `generate` is the V1 name for what was previously `build-data`.
 * Reads records, normalizes them, writes the slim + full JSON
 * payloads, and returns the file paths for downstream steps
 * (sitemap, llms, etc).
 */
export const generate = buildData;
