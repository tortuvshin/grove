/**
 *  Source of truth: `data/generated/records.{full,index,json}` and
 *  `data/generated/site-config.json`, produced at build time by
 *  `grove generate` from `data/records/*.yml` and `grove.config.ts`.
 *
 *  Three flavors of records are written by the generator:
 *
 *    - `records.full.json`   — every record, all visibility. Carries
 *      every normalized field (including `content`, `bestFor`,
 *      `whyListed`, `caveats`, full `github.repository`, ...).
 *      Use this for the detail page.
 *    - `records.index.json`  — slim projection, visible-only. Use
 *      this for the list page and any home-page sectioning. Shape
 *      is the `IndexRecord` discriminated union from `@grove-dev/core`.
 *    - `records.json`        — alias of `records.full.json`.
 *
 *  The YML files are the human-edited source; this module is a
 *  typed re-export so pages can import the records without parsing
 *  JSON inline.
 *
 *  Blueprint-aware helpers (`indexSlug`, `itemLabel`, `itemsByKind`,
 *  `items` default export) read from `data/generated/site-config.json`'s
 *  `blueprintConfig` block, so the same module works for all three
 *  blueprints — `project-directory` (default), `resource-hub`, and
 *  `ecosystem-map` — without per-blueprint forks.
 *
 *  JSON imports are static at the top of this module so Vite
 *  resolves them at build time. A fresh scaffold that has not yet
 *  run `grove generate` will fail the build with a clear Vite
 *  resolution error, which is the correct signal — a build that
 *  silently renders an empty directory hides real config mistakes.
 */
import fullPayload from "../../data/generated/records.full.json";
import indexPayload from "../../data/generated/records.index.json";
import siteConfigPayload from "../../data/generated/site-config.json";
import type {
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  Resource,
  IndexRecord,
  IndexProjectRecord,
  IndexResourceRecord,
  IndexEntityRecord,
} from "@grove-dev/core";

interface FullPayload {
  schemaVersion?: number;
  blueprint?: string;
  generatedAt?: string;
  totalRecords?: number;
  visibleRecords?: number;
  records?: Resource[];
}

interface IndexPayload {
  schemaVersion?: number;
  blueprint?: string;
  generatedAt?: string;
  totalRecords?: number;
  records?: IndexRecord[];
}

interface SiteConfigPayload {
  blueprint?: string;
  blueprintConfig?: {
    id?: string;
    kind?: "project" | "resource" | "entity";
    routeSlug?: string;
    itemSlug?: string;
    /** V1 canonical field name for the record detail slug
     * (replaces the V0 `itemSlug` field). */
    recordSlug?: string;
    labelSingular?: string;
    labelPlural?: string;
  };
  name?: string;
}

const fullRecordsRaw: Resource[] = (fullPayload as FullPayload).records ?? [];
const indexRecordsRaw: IndexRecord[] = (indexPayload as IndexPayload).records ?? [];
const siteConfigRaw: SiteConfigPayload = siteConfigPayload as SiteConfigPayload;

/** Full records (every record, all visibility). Use this for the
 *  detail page (where you need `content`, `bestFor`, `whyListed`,
 *  `caveats`, the full `github.repository` block, ...) and for
 *  the V0-published alias page at `/apps/[recordSlug]` that
 *  enumerates all records for `getStaticPaths`. */
export const fullRecords: Resource[] = fullRecordsRaw;

/** Index-payload records (visible-only slim shape). */
export const records: IndexRecord[] = indexRecordsRaw;

/** Resource-kind records — slim shape. */
/** Project-kind records — slim shape, ready for list pages. */
export const projects = records.filter(
  (r): r is IndexProjectRecord => r.kind === "project",
);

export const resources = records.filter(
  (r): r is IndexResourceRecord => r.kind === "resource",
);

/** Entity-kind records — slim shape. */
export const entities = records.filter(
  (r): r is IndexEntityRecord => r.kind === "entity",
);

const bySlug = new Map(fullRecords.map((r) => [r.slug, r]));

export function recordBySlug(slug: string): Resource | undefined {
  return bySlug.get(slug);
}

/**
 *  Generic slug lookup. The spec name is `findRecord`; this is an
 *  alias of `recordBySlug` so consumers can use either spelling.
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

// ──────────────────────────────────────────────────────────────────────
// Blueprint-aware generic helpers
// ──────────────────────────────────────────────────────────────────────
//
// Every page (home, list, detail, submit) needs to know the
// route slug, the kind filter, and the human label. Rather than
// hardcode "project" / "projects" / "kind: project" at every
// call-site, we derive them once from `site-config.json`'s
// `blueprintConfig` block (populated by `grove generate`).
//
// `indexSlug()` and `itemLabel()` retain their old signatures
// (zero-arg) so existing pages keep working — they now read from
// the JSON instead of a switch statement.

const blueprintConfig = siteConfigRaw.blueprintConfig ?? {};
const blueprintKind = (blueprintConfig.kind ?? "project") as
  | "project"
  | "resource"
  | "entity";
const blueprintId = (blueprintConfig.id ?? "project-directory") as
  | "project-directory"
  | "resource-hub"
  | "ecosystem-map";

/**
 * URL slug for the directory index page (e.g. `/projects/`,
 * `/resources/`, `/entities/`). Override in `grove.config.ts`
 * via `routes.directory` — reflected through to here at generate
 * time.
 */
export function indexSlug(): string {
  return blueprintConfig.routeSlug ?? "projects";
}

/** URL slug for a single record detail page (the dynamic
 * `[recordSlug]` segment). Default "project" for backwards-compat
 * with V0-published configs that exposed the field as `itemSlug`. */
export function recordSlugConfig(): string {
  return blueprintConfig.recordSlug ?? blueprintConfig.itemSlug ?? "project";
}

/** Singular human label, e.g. "project", "resource", "entity". */
export function itemLabel(): string {
  return blueprintConfig.labelSingular ?? "project";
}

/** Plural human label, e.g. "projects", "resources", "entities". */
export function itemLabelPlural(): string {
  return blueprintConfig.labelPlural ?? "projects";
}

/** Active blueprint id. */
export function blueprintIdFn(): string {
  return blueprintId;
}

/** Active record kind discriminator. */
export function activeKind(): "project" | "resource" | "entity" {
  return blueprintKind;
}

/**
 * Generic items alias. Defaults to the kind this blueprint
 * produces (project/resource/entity). Use this for all
 * "list"-flavoured pages so a single template works for every
 * blueprint.
 */
export const items: IndexRecord[] = (() => {
  switch (blueprintKind) {
    case "resource":
      return resources;
    case "entity":
      return entities;
    case "project":
    default:
      return projects;
  }
})();

/** Generic full-record alias. */
export const fullItems: Resource[] = (() => {
  return fullRecords.filter((r) => r.kind === blueprintKind);
})();
