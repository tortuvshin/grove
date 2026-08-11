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
  licenses?: string[];
  visibility?: string;
  /** GitHub stargazers count. Stored on `github.repository.stargazers_count`
   *  in the full payload; read explicitly because the index payload
   *  does not flatten it. */
  stars?: number;
  /** GitHub fork count. Stored on `github.repository.forks_count`. */
  forks?: number;
  pushedAt?: string;
  lastCommitAt?: string;
  category?: string;
  tags?: string[];
  scores?: { curation?: number; activity?: number };
  repoUrl?: string;
  links?: { github?: string; website?: string };
  /** GitHub metadata block on the full record. The star / fork counts
   *  are read from `github.repository.stargazers_count` /
   *  `github.repository.forks_count` here. */
  github?: {
    repository?: {
      stargazers_count?: number;
      forks_count?: number;
    };
  };
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
 * - Populates `repoHref` (from `repoUrl` or `links.github`) and
 *   `homepageHref` (from `links.website`) so the row component
 *   can render "View repo" / "Visit site" footer links.
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
      repoHref: r.repoUrl ?? r.links?.github,
      homepageHref: r.links?.website,
      stack: r.stack ?? r.stacks?.[0],
      platform: r.platforms,
      license: r.license,
      // Pass through the curated `licenses` array so the collection
      // engine can match both curated SPDX ids and the GitHub fallback.
      // If only `license` (singular, GitHub-synced) is present, mirror
      // it into the array so the filter still matches it.
      licenses:
        r.licenses && r.licenses.length > 0
          ? r.licenses
          : r.license
            ? [r.license]
            : undefined,
      status: r.visibility,
      stars: r.stars ?? r.github?.repository?.stargazers_count,
      forks: r.forks ?? r.github?.repository?.forks_count,
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
  /** ItemList JSON-LD block. Pass to BaseLayout as the `jsonLd` prop
   *  so it ships in the document head and is indexable by search
   *  engines as a list of `SoftwareApplication` items. */
  jsonLd?: unknown;
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
  site?: { name?: string; url?: string },
): CollectionPageModel {
  const result = runCollection(collection, entries);
  const related = findRelated(collection, allCollections, 4).map((c) => ({
    slug: c.slug,
    title: c.title,
    url: `/collections/${c.slug}/`,
  }));
  // ItemList JSON-LD. Search engines can use this to surface
  // individual entries directly from the collection URL.
  // Cap at 50 entries to keep the JSON-LD payload bounded;
  // search engines don't index beyond that anyway.
  const itemListElement = result.entries.slice(0, 50).map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "SoftwareApplication",
      name: entry.title,
      url: entry.url,
      description: entry.description,
    },
  }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: collection.title,
    description: collection.description,
    url: site?.url ? `${site.url.replace(/\/$/, "")}/collections/${collection.slug}/` : undefined,
    numberOfItems: result.entries.length,
    itemListElement,
  };
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
    jsonLd,
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

/**
 * Reverse lookup — given a record, return the slugs of every
 * curated collection that includes it. Walks each collection's
 * query + ranking once, applies the same filter the collection
 * page uses, and returns the collection slugs that contain the
 * target record. Used by the detail page's sidebar to show
 * "Also in" / "Collection membership" links.
 *
 * The returned array includes `{slug, title}` pairs so the
 * sidebar can render both the link target and a user-facing
 * label without re-loading the collection YAML.
 */
export function findCollectionsFor(
  target: { slug?: string; stack?: string; stacks?: string[]; platforms?: string[]; licenses?: string[]; category?: string; visibility?: string; status?: string },
  collections: Collection[],
  entries: CollectionEntry[],
): { slug: string; title: string; url: string }[] {
  if (!target.slug) return [];
  const result: { slug: string; title: string; url: string }[] = [];
  for (const collection of collections) {
    const filtered = runCollection(collection, entries).entries;
    if (filtered.some((entry) => entry.slug === target.slug)) {
      result.push({
        slug: collection.slug,
        title: collection.title,
        url: `/collections/${collection.slug}/`,
      });
    }
  }
  return result;
}
