import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from './config.js';
import { loadNormalizedRecords } from './normalize-records.js';
import { resolveOutboundRef } from './outbound.js';
import { blueprintKind, type GroveConfig, type Resource, toIndexRecord } from './schema.js';

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

type GeneratedTaxonomyItem = {
  id: string;
  name: string;
  [key: string]: unknown;
};

async function loadTaxonomyFile(
  cwd: string,
  taxonomyDir: string,
  filename: string,
): Promise<GeneratedTaxonomyItem[]> {
  try {
    const text = await readFile(resolve(cwd, taxonomyDir, filename), 'utf8');
    const raw = parseYaml(text, { schema: 'core' });
    if (!Array.isArray(raw)) return [];
    const items = raw
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.name === 'string',
      )
      .map(
        (item): GeneratedTaxonomyItem => ({
          ...item,
          id: item.id as string,
          name: item.name as string,
        }),
      );
    // Taxonomy YAML owns display order: file position by default, an
    // explicit numeric `order` field wins when present. The sorted
    // array serializes into site-config.json, so every downstream
    // surface (filter options, taxonomy pages) inherits it.
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const orderA = typeof a.item.order === 'number' ? a.item.order : Number.POSITIVE_INFINITY;
        const orderB = typeof b.item.order === 'number' ? b.item.order : Number.POSITIVE_INFINITY;
        return orderA - orderB || a.index - b.index;
      })
      .map(({ item }) => item);
  } catch {
    return [];
  }
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

export async function generate(cwd = process.cwd(), config?: GroveConfig): Promise<GenerateResult> {
  const cfg = config ?? (await loadConfig(cwd));
  const outDir = resolve(cwd, cfg.paths.generatedDir);
  await mkdir(outDir, { recursive: true });

  const expectedKind = blueprintKind[cfg.blueprint];

  // Every layer (record, GitHub cache, overrides, health.yml,
  // decisions) is merged by the shared normalizer, so the README,
  // `grove check` and `grove cleanup` see exactly these records.
  const normalized = await loadNormalizedRecords(cfg, cwd);
  const errors = normalized.issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
  if (errors.length > 0) {
    const e = new Error(`generate failed: ${errors.length} schema error(s)`);
    (e as Error & { details?: string[] }).details = errors;
    throw e;
  }
  const out: Resource[] = normalized.records.map((entry) => entry.record);

  out.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  const indexRecords = out
    .map((record) => toIndexRecord(record))
    .filter((r) => {
      const vis = (r as { visibility?: string }).visibility;
      return vis !== 'hide' && vis !== 'remove';
    });

  // ── Derive directory stats from the records themselves ──────────
  // Single source of truth for the hero/origin/contributors counts.
  // Pages and components read this from site-config.json so the
  // numbers are guaranteed to match what's actually rendered.
  const projects = indexRecords.filter((r) => r.kind === 'project');
  const resources = indexRecords.filter((r) => r.kind === 'resource');
  const entities = indexRecords.filter((r) => r.kind === 'entity');

  const categories = new Set<string>();
  const stacks = new Set<string>();
  const platforms = new Set<string>();
  const owners = new Set<string>();
  let totalStars = 0;
  // Per-taxonomy-id record counts (case-insensitive, since license ids
  // are lowercase SPDX identifiers). Used below to keep an empty
  // category/stack/license out of the generated taxonomy pages and
  // sitemap entirely, instead of publishing a "0 apps" page for it.
  const categoryCounts = new Map<string, number>();
  const stackCounts = new Map<string, number>();
  const licenseCounts = new Map<string, number>();
  const subjectCounts = new Map<string, number>();
  const bump = (counts: Map<string, number>, id: string) => {
    const key = id.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const r of indexRecords) {
    const cat = (r as { category?: string }).category;
    if (cat) {
      categories.add(cat);
      bump(categoryCounts, cat);
    }
    const related = new Set(
      ((r as { relations?: Array<{ to: string }> }).relations ?? []).map((rel) => rel.to),
    );
    for (const subject of related) bump(subjectCounts, subject);
    const s1 = (r as { stack?: string }).stack;
    if (s1) {
      stacks.add(s1);
      bump(stackCounts, s1);
    }
    const s2 = (r as { stacks?: string[] }).stacks ?? [];
    for (const s of s2) {
      stacks.add(s);
      bump(stackCounts, s);
    }
    const ps = (r as { platforms?: string[] }).platforms ?? [];
    for (const p of ps) platforms.add(p);
    const lics = (r as { licenses?: string[] }).licenses ?? [];
    for (const l of lics) bump(licenseCounts, l);
    const gh = (r as { github?: { fullName?: string; stars?: number } }).github;
    if (gh?.fullName && gh.fullName.includes('/')) {
      const [owner] = gh.fullName.split('/');
      if (owner) owners.add(owner);
    }
    if (typeof gh?.stars === 'number') totalStars += gh.stars;
  }
  const withCounts = (items: GeneratedTaxonomyItem[], counts: Map<string, number>) =>
    items.map((item) => ({ ...item, count: counts.get(item.id.toLowerCase()) ?? 0 }));

  // Try to merge in the optional repo-stats.json (origin / source repo).
  // This file is produced by the `sync:repo-stats` workflow, but the
  // generate step must not require it — fallback to a sane empty shape.
  const repoStatsPath = join(outDir, 'repo-stats.json');
  let repoStats: {
    repoUrl?: string;
    originalRepo?: string;
    stars?: number;
    forks?: number;
    contributors?: number;
    description?: string;
  } = {};
  try {
    repoStats = JSON.parse(await readFile(repoStatsPath, 'utf8'));
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
      {
        project: 'projects',
        resource: 'resources',
        entity: 'entities',
      }[kind] ??
      'items',
    itemSlug:
      (cfg as { routes?: { item?: string } }).routes?.item ??
      {
        project: 'project',
        resource: 'resource',
        entity: 'entity',
      }[kind] ??
      'item',
    // Human-facing labels (e.g. "Browse projects", "Submit a project").
    labelSingular:
      (cfg as { labels?: { singular?: string } }).labels?.singular ??
      {
        project: 'project',
        resource: 'resource',
        entity: 'entity',
      }[kind] ??
      'item',
    labelPlural:
      (cfg as { labels?: { plural?: string } }).labels?.plural ??
      {
        project: 'projects',
        resource: 'resources',
        entity: 'entities',
      }[kind] ??
      'items',
  };
  const taxonomy = {
    // `count` is how many visible records actually use each id — the
    // categories/stacks/licenses detail pages (`[name].astro`) filter
    // on it so a taxonomy entry nobody uses yet doesn't get published
    // as an empty, indexable "0 apps" page.
    categories: withCounts(
      await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'categories.yml'),
      categoryCounts,
    ),
    stacks: withCounts(
      await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'stacks.yml'),
      stackCounts,
    ),
    platforms: await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'platforms.yml'),
    // Curated tag vocabulary (data/taxonomy/topics.yml). Optional —
    // older sites without the file simply get an empty list. The
    // browse dropdown filters its Tag facet against this list so
    // arbitrary GitHub topics don't pollute the dropdown.
    topics: await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'topics.yml'),
    distributionChannels: await loadTaxonomyFile(
      cwd,
      cfg.paths.taxonomyDir,
      'distribution-channels.yml',
    ),
    licenses: withCounts(
      await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'licenses.yml'),
      licenseCounts,
    ),
    // Subjects records relate to (data/taxonomy/subjects.yml). `count`
    // is how many visible records have a relation to each one. Optional
    // — a site without the file gets an empty list.
    subjects: withCounts(
      await loadTaxonomyFile(cwd, cfg.paths.taxonomyDir, 'subjects.yml'),
      subjectCounts,
    ),
  };

  const siteConfigPayload = {
    blueprint: cfg.blueprint,
    blueprintConfig,
    name: cfg.site.name,
    tagline: cfg.site.tagline,
    description: cfg.site.description ?? cfg.site.tagline,
    siteUrl: cfg.site.url ?? 'https://example.com',
    repoUrl: cfg.site.repoUrl ?? '',
    logo: cfg.site.logo,
    favicon: cfg.site.favicon,
    locale: cfg.site.locale,
    twitter: cfg.site.twitter,
    press: cfg.site.press,
    nav: cfg.nav,
    // `ref` resolved: the configured value, else the host of site.url.
    outbound: {
      ref: resolveOutboundRef(cfg.outbound.ref, cfg.site.url),
      skipHosts: cfg.outbound.skipHosts,
    },
    footer: cfg.footer,
    submission: cfg.submission,
    analytics: cfg.analytics,
    // Index policy — page models read it from here (see index-policy.ts).
    seo: cfg.seo,
    browse: cfg.browse,
    theme: cfg.theme,
    integrations: cfg.integrations,
    contributors: cfg.contributors,
    taxonomy,
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
      repositoryStars: repoStats.stars ?? 0,
      repositoryForks: repoStats.forks ?? 0,
      repositoryContributors: repoStats.contributors ?? 0,
      // origin / source repo — only present when sync:repo-stats has run
      originalRepo: repoStats.originalRepo ?? '',
      originalStars: repoStats.originalRepo ? (repoStats.stars ?? 0) : 0,
      originalForks: repoStats.originalRepo ? (repoStats.forks ?? 0) : 0,
      originalContributors: repoStats.originalRepo ? (repoStats.contributors ?? 0) : 0,
    },
  };
  await writeFile(
    join(outDir, 'site-config.json'),
    JSON.stringify(siteConfigPayload, null, 2),
    'utf8',
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

  const fullPath = join(outDir, 'records.full.json');
  const indexPath = join(outDir, 'records.index.json');
  const aliasPath = join(outDir, 'records.json');
  await writeFile(fullPath, JSON.stringify(fullPayload, null, 2), 'utf8');
  await writeFile(indexPath, JSON.stringify(indexPayload, null, 2), 'utf8');
  await writeFile(aliasPath, JSON.stringify(fullPayload, null, 2), 'utf8');

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
  if (record.kind === 'resource') return record.title;
  return record.name;
}
