import type { Collection, CollectionEntry, CollectionSourceRecord } from '@grove-dev/core';
import { collectionSchema, findRelated, runCollection, toCollectionEntries } from '@grove-dev/core';
import { absoluteUrl, ogPath, type PageSeo, seoDescription, seoTitle } from './seo.js';

// Collection YAML loading lives in @grove-dev/core (it also feeds the
// sitemap and OG-image pipelines there); re-exported for page code.
export { loadCollections } from '@grove-dev/core';

interface RouteHint {
  routeSlug?: string;
  blueprintConfig?: { routeSlug?: string };
}

/**
 * Map a list of full records (shape produced by `records.json`) to
 * the lightweight `CollectionEntry` shape consumed by `runCollection`.
 *
 * The projection itself is `toCollectionEntries` in `@grove-dev/core` —
 * shared with the OG-image pipeline so both count a collection the same
 * way. This wrapper only resolves the directory route slug from the
 * site payload, so an entry's `url` points at the consumer's detail page.
 */
export function recordsToCollectionEntries(
  records: CollectionSourceRecord[],
  site: RouteHint,
): CollectionEntry[] {
  const routeSlug = site.routeSlug ?? site.blueprintConfig?.routeSlug ?? 'projects';
  return toCollectionEntries(records, { routeSlug });
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
    kind: 'curated' | 'generated';
    selectionNote?: string;
    introduction?: string;
  };
  total: number;
  isEmpty: boolean;
  entries: CollectionEntry[];
  /** CollectionPage + ItemList + BreadcrumbList JSON-LD nodes. Ships
   *  through `seo.jsonLd`; kept here too for backward compatibility. */
  jsonLd?: unknown;
  /** Complete head block: honors the collection's `seo.title`,
   *  `seo.description`, and `seo.index` overrides. Pass to BaseLayout. */
  seo: PageSeo;
  related: Array<{ slug: string; title: string; url: string }>;
}

export interface CollectionIndexModel {
  total: number;
  collections: Array<{
    slug: string;
    title: string;
    description: string;
    kind: 'curated' | 'generated';
    count: number;
    url: string;
  }>;
  /** Head block for the /collections/ index — present when the caller
   *  passes a site config. */
  seo?: PageSeo;
}

export interface CollectionTeaserModel {
  total: number;
  collections: CollectionIndexModel['collections'];
}

export function getCollectionPageModel(
  collection: Collection,
  entries: CollectionEntry[],
  allCollections: Collection[],
  site?: {
    name?: string;
    url?: string;
    siteUrl?: string;
    blueprintConfig?: { labelPlural?: string };
  },
): CollectionPageModel {
  const result = runCollection(collection, entries);
  const related = findRelated(collection, allCollections, 4).map((c) => ({
    slug: c.slug,
    title: c.title,
    url: `/collections/${c.slug}/`,
  }));
  const siteUrl = (site?.siteUrl ?? site?.url ?? 'https://example.com').replace(/\/$/, '');
  const siteName = site?.name ?? '';
  const plural = site?.blueprintConfig?.labelPlural ?? 'items';
  const pageUrl = absoluteUrl(siteUrl, `collections/${collection.slug}/`);
  // CollectionPage + ItemList + BreadcrumbList. `itemListElement` is
  // capped at 50 entries to keep the payload bounded; `numberOfItems`
  // still reports the full list so it matches what the page renders.
  const jsonLd = collectionSchema({
    url: pageUrl,
    name: collection.seo?.title ?? collection.title,
    description: collection.seo?.description ?? collection.description,
    items: result.entries.slice(0, 50).map((entry) => ({
      url: entry.url.startsWith('http') ? entry.url : absoluteUrl(siteUrl, entry.url),
      name: entry.title,
      ...(entry.description ? { description: entry.description } : {}),
    })),
    totalItems: result.entries.length,
    crumbs: [
      { url: `${siteUrl}/`, name: 'Home' },
      { url: absoluteUrl(siteUrl, 'collections/'), name: 'Collections' },
      { url: pageUrl, name: collection.title },
    ],
  });
  // The curator's `seo.title` / `seo.description` overrides win
  // verbatim; the fallback pattern advertises the list size. A
  // collection marked `seo.index: false` renders with noindex.
  const seo: PageSeo = {
    title:
      collection.seo?.title ??
      seoTitle(`${collection.title} — ${result.entries.length} ${plural}`, siteName),
    description: seoDescription(collection.seo?.description, collection.description),
    image: ogPath('collection', collection.slug),
    ...(siteName ? { imageAlt: `${collection.title} — ${siteName}` } : {}),
    jsonLd: jsonLd as unknown as Record<string, unknown>[],
    noindex: collection.seo?.index === false,
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
    seo,
  };
}

export function getCollectionIndexModel(
  collections: Collection[],
  entries: CollectionEntry[],
  site?: {
    name?: string;
    url?: string;
    siteUrl?: string;
    blueprintConfig?: { labelPlural?: string };
  },
): CollectionIndexModel {
  const rows = collections.map((c) => {
    const result = runCollection(c, entries);
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      kind: c.kind,
      count: result.entries.length,
      url: `/collections/${c.slug}/`,
    };
  });
  let seo: PageSeo | undefined;
  if (site) {
    const siteUrl = (site.siteUrl ?? site.url ?? 'https://example.com').replace(/\/$/, '');
    const siteName = site.name ?? '';
    const plural = site.blueprintConfig?.labelPlural ?? 'items';
    const title = seoTitle('Collections', siteName);
    const description = seoDescription(
      undefined,
      `${rows.length} curated and generated collections of ${plural} on ${siteName || 'this site'} — hand-picked lists kept in sync with the source files.`,
    );
    seo = {
      title,
      description,
      image: ogPath('default'),
      jsonLd: collectionSchema({
        url: absoluteUrl(siteUrl, 'collections/'),
        name: title,
        description,
        items: rows.map((row) => ({
          url: absoluteUrl(siteUrl, row.url),
          name: row.title,
          ...(row.description ? { description: row.description } : {}),
        })),
        crumbs: [
          { url: `${siteUrl}/`, name: 'Home' },
          { url: absoluteUrl(siteUrl, 'collections/'), name: 'Collections' },
        ],
      }) as unknown as Record<string, unknown>[],
    };
  }
  return {
    total: collections.length,
    collections: rows,
    ...(seo ? { seo } : {}),
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
  target: {
    slug?: string;
    stack?: string;
    stacks?: string[];
    platforms?: string[];
    licenses?: string[];
    category?: string;
    visibility?: string;
    status?: string;
  },
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
