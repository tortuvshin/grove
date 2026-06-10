/**
 * Source of truth: `data/generated/records.{full,index,json}`,
 * produced at build time by `grove generate` from
 * `data/records/*.yml`.
 *
 * Three flavors are written by the generator:
 *
 *   - `records.full.json`   — every record, all visibility. Carries
 *     every normalized field (including `content`, `bestFor`,
 *     `whyListed`, `caveats`, full `github.repository`, ...).
 *     Use this for the detail page.
 *   - `records.index.json`  — slim projection, visible-only. Use
 *     this for the list page and any home-page sectioning.
 *   - `records.json`        — alias of `records.full.json`.
 *
 * The YML files are the human-edited source; this module is a
 * typed re-export so pages can import the records without parsing
 * JSON inline. The shape is the V1 discriminated union from
 * `@grove-dev/core` — records have a `kind` field that selects
 * `ProjectRecord`, `ResourceRecord`, or `EntityRecord`. Pages cast
 * to the kind they expect based on the blueprint in
 * `grove.config.ts`.
 *
 * When the JSON files are missing (e.g. before `grove generate`
 * runs, or in a fresh scaffold with no records) this module falls
 * back to empty arrays so the Astro build still succeeds — every
 * page must render a graceful "no records yet" state.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ProjectRecord, ResourceRecord, EntityRecord, Resource } from "@grove-dev/core";

interface RecordsPayload {
  schemaVersion?: number;
  blueprint?: string;
  generatedAt?: string;
  totalRecords?: number;
  visibleRecords?: number;
  records?: Resource[];
}

function loadGenerated(filename: string): Resource[] {
  // The Astro build resolves JSON imports from `src/data/*.ts`, but
  // we want to be defensive about the order of operations: a fresh
  // scaffold runs `astro build` without first running
  // `grove generate`, in which case the JSON file does not exist.
  // Resolve the path relative to this module's URL, then fall back
  // to an empty list.
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, "..", "..", "data", "generated", filename),
      resolve(here, "..", "..", "..", "data", "generated", filename),
      resolve(process.cwd(), "data", "generated", filename),
    ];
    const path = candidates.find((p) => existsSync(p));
    if (!path) return [];
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as RecordsPayload;
    return (parsed.records ?? []) as Resource[];
  } catch {
    return [];
  }
}

const fullRecordsRaw = loadGenerated("records.full.json");
const indexRecordsRaw = loadGenerated("records.index.json");

/**
 * Full records (all visibility). Use this for the detail page,
 * where you need `content`, `bestFor`, `whyListed`, `caveats`,
 * the full `github.repository` block, etc.
 */
export const fullRecords: Resource[] = fullRecordsRaw;

/**
 * Index-payload records (visible only). Use this for the list
 * page and any home-page sectioning, where you only need the
 * slim search-index fields.
 */
export const records: Resource[] =
  indexRecordsRaw.length > 0 ? indexRecordsRaw : fullRecordsRaw;

/** Project-kind records only. */
export const projects = records.filter(
  (r): r is ProjectRecord => r.kind === "project",
);

/** Resource-kind records. */
export const resources = records.filter(
  (r): r is ResourceRecord => r.kind === "resource",
);

/** Entity-kind records. */
export const entities = records.filter(
  (r): r is EntityRecord => r.kind === "entity",
);

const bySlug = new Map(fullRecords.map((r) => [r.slug, r]));

export function recordBySlug(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

/**
 * Generic slug lookup. The spec name is `findRecord`; this is an
 * alias of `recordBySlug` so consumers can use either spelling.
 * The two-name pattern matches the rest of the module (we keep
 * `recordBySlug` for the typed `projectBySlug`/`resourceBySlug`/
 * `entityBySlug` family, and `findRecord` as the unified entry
 * point).
 */
export function findRecord(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

export function projectBySlug(slug: string): ProjectRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "project" ? r : undefined;
}

export function resourceBySlug(slug: string): ResourceRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "resource" ? r : undefined;
}

export function entityBySlug(slug: string): EntityRecord | undefined {
  const r = bySlug.get(slug);
  return r && r.kind === "entity" ? r : undefined;
}

/**
 * Page slug for the directory index page, derived from the
 * blueprint in `grove.config.ts` (mirrors the helper that used
 * to live in `data/site-config.ts`).
 */
export function indexSlug(blueprint: string | undefined): string {
  switch (blueprint) {
    case "resource-hub":
      return "resources";
    case "ecosystem-map":
      return "entities";
    case "project-directory":
    default:
      return "projects";
  }
}

/** Human label for items in the UI. */
export function itemLabel(blueprint: string | undefined): string {
  switch (blueprint) {
    case "resource-hub":
      return "resource";
    case "ecosystem-map":
      return "entity";
    case "project-directory":
    default:
      return "project";
  }
}
