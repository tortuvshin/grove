import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  blueprintKind,
  recordsFileSchema,
  toIndexRecord,
  unwrapDecisions,
  decisionsFileSchema,
  type GroveConfig,
  type Resource,
} from "./schema.js";
import { loadConfig } from "./config.js";

/**
 * Apply a minimal decisions.yml override to a normalized record. The
 * human curation layer is the single source of truth for visibility:
 *   - For project records: decision.visibility (when present) wins
 *     over record.health.visibility. The health block's other fields
 *     (status, tier, etc.) are untouched.
 *   - For resource-hub and ecosystem-map records: decision.visibility
 *     is written to the record's top-level `visibility` field (these
 *     blueprints have no `health` block).
 *
 * The full override pipeline (with reasons surfaced in the index
 * payload) is a V2 feature; V1 keeps the merge intentional and small.
 */
function applyDecision(
  record: Resource,
  visibilityById: Map<string, string>,
): Resource {
  const override = visibilityById.get(record.slug);
  if (!override) return record;
  if (record.kind === "project") {
    const existing = record.health;
    const fallback = {
      status: "unknown" as const,
      maturity: "unknown" as const,
      tier: "listed" as const,
      visibility: "keep" as const,
      cleanupCandidate: false,
      staleReason: null,
      confidence: "medium" as const,
      reasons: [] as string[],
    };
    const merged = { ...(existing ?? fallback), visibility: override as typeof fallback.visibility };
    return { ...record, health: merged };
  }
  // Resource-hub / ecosystem-map: no `health` block; the top-level
  // `visibility` field on the base schema is the source of truth.
  return { ...record, visibility: override as typeof record.visibility };
}

async function loadDecisionVisibility(
  decisionsPath: string,
  cwd: string,
): Promise<Map<string, string>> {
  try {
    const raw = await readFile(resolve(cwd, decisionsPath), "utf8");
    const parsed = decisionsFileSchema.parse(parseYaml(raw) ?? {});
    const decisions = unwrapDecisions(parsed);
    const out = new Map<string, string>();
    for (const d of decisions) out.set(d.id, d.decision.visibility);
    return out;
  } catch {
    // missing or invalid decisions.yml → no overrides
    return new Map();
  }
}

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
 * `generate` reads every records/*.yml in the project, normalizes them
 * via the blueprint schema, and writes:
 *  - data/generated/records.full.json   (full records, all visibility)
 *  - data/generated/records.index.json  (slim, visible-only)
 *  - data/generated/records.json        (alias of records.full.json)
 *
 * Returns file paths and counters; throws on schema errors.
 */
export interface GenerateResult {
  totalRecords: number;
  visibleRecords: number;
  fullPath: string;
  indexPath: string;
  aliasPath: string;
  errors: string[];
}

export async function generate(
  cwd = process.cwd(),
  config?: GroveConfig,
): Promise<GenerateResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const recordsDir = resolve(cwd, cfg.paths.recordsDir);
  const outDir = resolve(cwd, cfg.paths.generatedDir);
  await mkdir(outDir, { recursive: true });

  const expectedKind = blueprintKind[cfg.blueprint];
  const entries = await readdir(recordsDir).catch(() => [] as string[]);
  const files = entries.filter((f) => f.endsWith(".yml")).sort();

  // Load human curation decisions once; missing file → empty map.
  const visibilityById = await loadDecisionVisibility(cfg.paths.decisions, cwd);

  const out: Resource[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const fileSlug = basename(file, ".yml");
    try {
      const text = await readFile(join(recordsDir, file), "utf8");
      const raw = (parseYaml(text) ?? {}) as Record<string, unknown>;
      if (!raw.kind) raw.kind = expectedKind;
      const normalized = recordsFileSchema.parse(raw);
      normalized.slug = fileSlug;
      // Apply decisions.yml visibility override on top of the record.
      // The index payload then derives visibility from record.health,
      // which is now the merged result.
      out.push(applyDecision(normalized, visibilityById));
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`);
    }
  }
  if (errors.length > 0) {
    const e = new Error(`generate failed: ${errors.length} schema error(s)`);
    (e as Error & { details?: string[] }).details = errors;
    throw e;
  }

  out.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const indexRecords = out
    .map((record) => toIndexRecord(record))
    .filter((r) => {
      const vis = (r as { visibility?: string }).visibility;
      return vis !== "hide" && vis !== "remove";
    });

  // ── Derive directory stats from the records themselves ──────────
  // Single source of truth for the hero/origin/contributors counts.
  // Pages and components read this from site-config.json so the
  // numbers are guaranteed to match what's actually rendered.
  const projects = indexRecords.filter((r) => r.kind === "project");
  const resources = indexRecords.filter((r) => r.kind === "resource");
  const entities = indexRecords.filter((r) => r.kind === "entity");

  const categories = new Set<string>();
  const stacks = new Set<string>();
  const platforms = new Set<string>();
  const owners = new Set<string>();
  let totalStars = 0;
  for (const r of indexRecords) {
    const cat = (r as { category?: string }).category;
    if (cat) categories.add(cat);
    const s1 = (r as { stack?: string }).stack;
    if (s1) stacks.add(s1);
    const s2 = (r as { stacks?: string[] }).stacks ?? [];
    for (const s of s2) stacks.add(s);
    const ps = (r as { platforms?: string[] }).platforms ?? [];
    for (const p of ps) platforms.add(p);
    const gh = (r as { github?: { fullName?: string; stars?: number } }).github;
    if (gh?.fullName && gh.fullName.includes("/")) {
      owners.add(gh.fullName.split("/")[0]);
    }
    if (typeof gh?.stars === "number") totalStars += gh.stars;
  }

  // Try to merge in the optional repo-stats.json (origin / source repo).
  // This file is produced by the `sync:repo-stats` workflow, but the
  // generate step must not require it — fallback to a sane empty shape.
  const repoStatsPath = join(outDir, "repo-stats.json");
  let repoStats: {
    originalRepo?: string;
    stars?: number;
    forks?: number;
    contributors?: number;
    description?: string;
  } = {};
  try {
    repoStats = JSON.parse(await readFile(repoStatsPath, "utf8"));
  } catch {
    /* not present — pages render gracefully */
  }

  // Re-emit the site config as JSON alongside the records so the
  // Astro (or any framework) template can pick up the user's
  // branding, theme, and nav without parsing `grove.config.ts`
  // at render time. The CLI runs `generate` ahead of `build`,
  // so this stays in sync with the consumer's config edits.
  //
  // `stats` carries directory-level aggregates so the hero,
  // origin card, and contributors page all read the same numbers
  // without re-deriving them.
  //
  // `blueprintConfig` is the generic-naming layer: every name
  // (route slug, kind, singular/plural labels) is derived from the
  // blueprint so the same template works for project directories,
  // resource hubs, and ecosystem maps without per-blueprint forks.
  const kind = expectedKind;
  const blueprintConfig = {
    id: cfg.blueprint,
    kind,
    // Slug used in URLs (e.g. /projects/, /resources/, /entities/).
    // Override in `grove.config.ts` via `routes.directory` if you
    // want a custom path that doesn't match the blueprint id.
    routeSlug:
      (cfg as { routes?: { directory?: string } }).routes?.directory ??
      ({
        project: "projects",
        resource: "resources",
        entity: "entities",
      }[kind] ?? "items"),
    itemSlug:
      (cfg as { routes?: { item?: string } }).routes?.item ??
      ({
        project: "project",
        resource: "resource",
        entity: "entity",
      }[kind] ?? "item"),
    // Human-facing labels (e.g. "Browse projects", "Submit a project").
    labelSingular:
      (cfg as { labels?: { singular?: string } }).labels?.singular ??
      ({
        project: "project",
        resource: "resource",
        entity: "entity",
      }[kind] ?? "item"),
    labelPlural:
      (cfg as { labels?: { plural?: string } }).labels?.plural ??
      ({
        project: "projects",
        resource: "resources",
        entity: "entities",
      }[kind] ?? "items"),
  };

  const siteConfigPayload = {
    blueprint: cfg.blueprint,
    blueprintConfig,
    name: cfg.site.name,
    tagline: cfg.site.tagline,
    description: cfg.site.description ?? cfg.site.tagline,
    siteUrl: cfg.site.url ?? "https://example.com",
    repoUrl: cfg.site.repoUrl ?? "",
    nav: cfg.nav,
    theme: cfg.theme,
    integrations: cfg.integrations,
    stats: {
      totalRecords: indexRecords.length,
      totalApps: projects.length,
      totalResources: resources.length,
      totalEntities: entities.length,
      totalCategories: categories.size,
      totalStacks: stacks.size,
      totalPlatforms: platforms.size,
      totalOwners: owners.size,
      totalStars,
      // origin / source repo — only present when sync:repo-stats has run
      originalRepo: repoStats.originalRepo ?? cfg.site.repoUrl ?? "",
      originalStars: repoStats.stars ?? 0,
      originalForks: repoStats.forks ?? 0,
      originalContributors: repoStats.contributors ?? 0,
    },
  };
  await writeFile(
    join(outDir, "site-config.json"),
    JSON.stringify(siteConfigPayload, null, 2),
    "utf8",
  );

  const generatedAt = new Date().toISOString();
  const fullPayload: RecordsFullPayload = {
    schemaVersion: 1,
    blueprint: cfg.blueprint,
    generatedAt,
    totalRecords: out.length,
    visibleRecords: indexRecords.length,
    records: out as unknown as Array<Record<string, unknown>>,
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
    totalRecords: out.length,
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
