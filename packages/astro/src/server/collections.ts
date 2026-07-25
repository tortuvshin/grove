import type { Collection, CollectionEntry } from "@grove-dev/core";
import { findRelated, runCollection } from "@grove-dev/core";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

interface RouteHint {
  routeSlug?: string;
  blueprintConfig?: { routeSlug?: string };
}

interface RawRecord {
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  stack?: string;
  stacks?: string[];
  platforms?: string[];
  license?: string;
  visibility?: string;
  stars?: number;
  pushedAt?: string;
  lastCommitAt?: string;
  category?: string;
  tags?: string[];
  scores?: { curation?: number; activity?: number };
}

/**
 * Map a list of full records (shape produced by `records.json`) to
 * the lightweight `CollectionEntry` shape consumed by `runCollection`.
 *
 * - Skips records with `visibility === "hide"` — they should never
 *   appear in any collection.
 * - Combines `category` and `tags` into a `categories` array (deduplicated).
 * - Falls back to `stacks[0]` when `stack` is missing.
 * - Prefers `pushedAt`; falls back to `lastCommitAt`.
 * - Constructs `url` as `${routeSlug}/${slug}/` so the value points
 *   back to the consumer's detail page.
 */
export function recordsToCollectionEntries(
  records: RawRecord[],
  site: RouteHint,
): CollectionEntry[] {
  const routeSlug = site.routeSlug ?? site.blueprintConfig?.routeSlug ?? "projects";
  const out: CollectionEntry[] = [];
  for (const r of records) {
    if (r.visibility === "hide") continue;
    if (!r.slug) continue;
    const categories = [
      ...(r.category ? [r.category] : []),
      ...(r.tags ?? []),
    ].filter((value, index, self) => self.indexOf(value) === index);
    out.push({
      slug: r.slug,
      title: r.name ?? r.title ?? r.slug,
      description: r.description ?? "",
      url: `/${routeSlug}/${r.slug}/`,
      stack: r.stack ?? r.stacks?.[0],
      platform: r.platforms,
      license: r.license,
      status: r.visibility,
      stars: r.stars,
      pushedAt: r.pushedAt ?? r.lastCommitAt,
      curationScore: r.scores?.curation,
      activityScore: r.scores?.activity,
      categories: categories.length > 0 ? categories : undefined,
    });
  }
  return out;
}

// ── Collection view-models ──────────────────────────────────────
//
// A Collection is a curated or generated grouping of records
// (see `@grove-dev/core`'s `runCollection` engine). These view-models
// produce the input the `CollectionPage`, `CollectionIndex`, and
// `CollectionTeaser` components consume.

export interface CollectionPageModel {
  collection: {
    slug: string;
    title: string;
    description: string;
    kind: "curated" | "generated";
    selectionNote?: string;
    introduction?: string;
  };
  total: number;
  isEmpty: boolean;
  entries: CollectionEntry[];
  related: Array<{ slug: string; title: string; url: string }>;
}

export interface CollectionIndexModel {
  total: number;
  collections: Array<{
    slug: string;
    title: string;
    description: string;
    kind: "curated" | "generated";
    count: number;
    url: string;
  }>;
}

export interface CollectionTeaserModel {
  total: number;
  collections: CollectionIndexModel["collections"];
}

export function getCollectionPageModel(
  collection: Collection,
  entries: CollectionEntry[],
  allCollections: Collection[],
): CollectionPageModel {
  const result = runCollection(collection, entries);
  const related = findRelated(collection, allCollections, 4).map((c) => ({
    slug: c.slug,
    title: c.title,
    url: `/collections/${c.slug}/`,
  }));
  return {
    collection: {
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      kind: collection.kind,
      selectionNote: collection.editorial?.selectionNote,
      introduction: collection.editorial?.introduction,
    },
    total: result.entries.length,
    isEmpty: result.isEmpty,
    entries: result.entries,
    related,
  };
}

export function getCollectionIndexModel(
  collections: Collection[],
  entries: CollectionEntry[],
): CollectionIndexModel {
  return {
    total: collections.length,
    collections: collections.map((c) => {
      const result = runCollection(c, entries);
      return {
        slug: c.slug,
        title: c.title,
        description: c.description,
        kind: c.kind,
        count: result.entries.length,
        url: `/collections/${c.slug}/`,
      };
    }),
  };
}

export function getCollectionTeaserModel(
  collections: Collection[],
  entries: CollectionEntry[],
  limit = 3,
): CollectionTeaserModel {
  const full = getCollectionIndexModel(collections, entries);
  return {
    total: full.total,
    collections: full.collections.slice(0, limit),
  };
}

/**
 * Load all `Collection` YAML files from `<cwd>/data/collections/*.yml`.
 *
 * Returns an empty array if the directory does not exist. Parse
 * errors are NOT swallowed — they surface so real problems
 * (malformed YAML, permission errors) are not hidden.
 */
export async function loadCollections(cwd: string): Promise<Collection[]> {
  const dir = resolve(cwd, "data/collections");
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: Collection[] = [];
  for (const f of files.filter((f) => f.endsWith(".yml"))) {
    const raw = parseYaml(await readFile(join(dir, f), "utf8"));
    if (!raw || typeof raw !== "object") {
      throw new Error(`Invalid collection YAML: ${f}`);
    }
    out.push(raw as Collection);
  }
  return out;
}
