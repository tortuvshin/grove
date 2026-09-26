import type {
  Collection,
  CollectionEntry,
  CollectionSourceRecord,
  ListingIndexPolicy,
} from '@grove-dev/core';
import {
  collectionIndexable,
  collectionSchema,
  faqSchema,
  findRelated,
  hasEditorialBody,
  NOINDEX_FOLLOW,
  runCollection,
  toCollectionEntries,
} from '@grove-dev/core';
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
    lastReviewedAt?: string;
    /** Path of the Markdown body; render it with `getCollectionBodyHtml`. */
    content?: string;
  };
  /** Questions rendered on the page and emitted as `FAQPage` JSON-LD. */
  faq: Array<{ q: string; a: string }>;
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
    /** `seo.collectionIndexPolicy` is read from here. */
    seo?: { collectionIndexPolicy?: string };
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
      // The curator's note is what the page shows for a hand-picked
      // entry, so it is what the markup describes it with too.
      ...(entry.note || entry.description ? { description: entry.note ?? entry.description } : {}),
    })),
    totalItems: result.entries.length,
    crumbs: [
      { url: `${siteUrl}/`, name: 'Home' },
      { url: absoluteUrl(siteUrl, 'collections/'), name: 'Collections' },
      { url: pageUrl, name: collection.title },
    ],
  });
  const faq = collection.faq ?? [];
  if (faq.length > 0) {
    jsonLd.push(
      faqSchema({
        url: pageUrl,
        items: faq.map((item) => ({ question: item.q, answer: item.a })),
      }),
    );
  }
  // The curator's `seo.title` / `seo.description` overrides win
  // verbatim; the fallback pattern advertises the list size. A
  // collection marked `seo.index: false` renders with noindex.
  // `seo.collectionIndexPolicy: 'editorial'` also noindexes (with
  // `follow`) a non-empty collection that has no intro or body.
  const excludedByPolicy =
    collection.seo?.index !== false &&
    !result.isEmpty &&
    !collectionIndexable(
      {
        introduction: collection.editorial?.introduction,
        hasBody: hasEditorialBody(collection.content),
        seoIndex: collection.seo?.index,
        entryCount: result.entries.length,
      },
      site?.seo?.collectionIndexPolicy as ListingIndexPolicy | undefined,
    );
  const seo: PageSeo = {
    title:
      collection.seo?.title ??
      seoTitle(`${collection.title} — ${result.entries.length} ${plural}`, siteName),
    description: seoDescription(collection.seo?.description, collection.description),
    image: ogPath('collection', collection.slug),
    ...(siteName ? { imageAlt: `${collection.title} — ${siteName}` } : {}),
    jsonLd: jsonLd as unknown as Record<string, unknown>[],
    // An empty collection has nothing to rank for; it also stays out of
    // the sitemap (see `prepareDirectory`).
    noindex: collection.seo?.index === false || result.isEmpty || excludedByPolicy,
    ...(excludedByPolicy ? { robots: NOINDEX_FOLLOW } : {}),
  };
  return {
    collection: {
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      kind: collection.kind,
      selectionNote: collection.editorial?.selectionNote,
      introduction: collection.editorial?.introduction,
      lastReviewedAt: collection.editorial?.lastReviewedAt,
      content: collection.content,
    },
    faq,
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

// ── Record context: relations, related records, membership ──────

const RELATION_LABELS: Record<string, string> = {
  'alternative-to': 'Alternative to',
};

export interface RecordContextSubject {
  id: string;
  name: string;
  /** The subject's own page (e.g. the vendor's), when the vocabulary has one. */
  url?: string;
}

export interface RecordContextModel {
  /** The record's relations, resolved against the subject vocabulary. */
  relations: Array<{
    type: string;
    /** Human label for the relation type, e.g. "Alternative to". */
    label: string;
    subject: RecordContextSubject;
    note?: string;
    evidence?: { type: string; url?: string; quote?: string; checkedAt?: string };
    /** The collection that declares `subject: <id>`, if there is one. */
    hub?: { title: string; url: string };
  }>;
  /** Other visible records that share one of the record's subjects. */
  relatedRecords: Array<{
    subject: RecordContextSubject;
    label: string;
    hub?: { title: string; url: string };
    records: Array<{ slug: string; title: string; url: string; description: string }>;
  }>;
  /** Collections whose resolved entries include the record. */
  collectionMembership: Array<{ slug: string; title: string; url: string }>;
}

interface RecordContextInput {
  collections: Collection[];
  entries: CollectionEntry[];
  /** `site-config.json` → `taxonomy.subjects`. */
  subjects?: Array<{ id: string; name: string; url?: unknown }>;
  /** Cap on related records listed per subject (default 6). */
  relatedLimit?: number;
}

/**
 * A detail page is rendered once per record, and each render needs every
 * collection resolved. Cache the resolved slug sets per entry stream so a
 * 100-record, 20-collection site runs 20 collections, not 2,000.
 */
const membershipCache = new WeakMap<CollectionEntry[], Map<string, Set<string>>>();

function membersOf(collection: Collection, entries: CollectionEntry[]): Set<string> {
  let bySlug = membershipCache.get(entries);
  if (!bySlug) {
    bySlug = new Map();
    membershipCache.set(entries, bySlug);
  }
  let members = bySlug.get(collection.slug);
  if (!members) {
    members = new Set(runCollection(collection, entries).entries.map((entry) => entry.slug));
    bySlug.set(collection.slug, members);
  }
  return members;
}

/**
 * Everything a record page links *out* to: the subjects it relates to
 * (and the hub collection for each), sibling records that share a
 * subject, and the collections it appears in. Pure — the caller passes
 * the collections, the entry stream and the subject vocabulary.
 */
export function getRecordContextModel(
  record: {
    slug: string;
    relations?: Array<{
      type: string;
      to: string;
      note?: string | undefined;
      evidence?:
        | {
            type: string;
            url?: string | undefined;
            quote?: string | undefined;
            checkedAt?: string | undefined;
          }
        | undefined;
    }>;
  },
  input: RecordContextInput,
): RecordContextModel {
  const { collections, entries } = input;
  const limit = input.relatedLimit ?? 6;
  const subjects = new Map(
    (input.subjects ?? []).map((subject) => [
      subject.id,
      {
        id: subject.id,
        name: subject.name,
        ...(typeof subject.url === 'string' ? { url: subject.url } : {}),
      } satisfies RecordContextSubject,
    ]),
  );
  const hubFor = (subjectId: string) => {
    const hub = collections.find((collection) => collection.subject === subjectId);
    return hub ? { title: hub.title, url: `/collections/${hub.slug}/` } : undefined;
  };

  const relations: RecordContextModel['relations'] = [];
  const relatedRecords: RecordContextModel['relatedRecords'] = [];
  const seenSubjects = new Set<string>();
  for (const relation of record.relations ?? []) {
    const subject = subjects.get(relation.to);
    if (!subject) continue;
    const label = RELATION_LABELS[relation.type] ?? relation.type;
    const hub = hubFor(subject.id);
    const evidence = relation.evidence
      ? {
          type: relation.evidence.type,
          ...(relation.evidence.url ? { url: relation.evidence.url } : {}),
          ...(relation.evidence.quote ? { quote: relation.evidence.quote } : {}),
          ...(relation.evidence.checkedAt ? { checkedAt: relation.evidence.checkedAt } : {}),
        }
      : undefined;
    relations.push({
      type: relation.type,
      label,
      subject,
      ...(relation.note ? { note: relation.note } : {}),
      ...(evidence ? { evidence } : {}),
      ...(hub ? { hub } : {}),
    });

    const key = `${relation.type}:${subject.id}`;
    if (seenSubjects.has(key)) continue;
    seenSubjects.add(key);
    const siblings = entries
      .filter(
        (entry) =>
          entry.slug !== record.slug &&
          (entry.relations ?? []).some((r) => r.to === subject.id && r.type === relation.type),
      )
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
      .slice(0, limit)
      .map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        url: entry.url,
        description: entry.description,
      }));
    if (siblings.length > 0) {
      relatedRecords.push({ subject, label, ...(hub ? { hub } : {}), records: siblings });
    }
  }

  const collectionMembership = collections
    .filter((collection) => membersOf(collection, entries).has(record.slug))
    .map((collection) => ({
      slug: collection.slug,
      title: collection.title,
      url: `/collections/${collection.slug}/`,
    }));

  return { relations, relatedRecords, collectionMembership };
}

// ── Collection tiles ────────────────────────────────────────────

/** One collection as a card: what the index and "related" rows render. */
export interface CollectionTile {
  slug: string;
  url: string;
  title: string;
  /** First sentence of the editorial introduction, else the description. */
  takeaway: string;
  /** True when a curator wrote a note for at least one entry. */
  editorial: boolean;
  kind: 'curated' | 'generated';
  count: number;
  countLabel: string;
  /** Up to eight entries with an image, in collection order. */
  faces: Array<{ title: string; avatarUrl?: string }>;
  /** First entries, for "Includes …" lines and quick picks. */
  examples: Array<{
    slug: string;
    title: string;
    url: string;
    note?: string;
    avatarUrl?: string;
    stars?: number;
  }>;
  /** ISO date of the last editorial review, when the collection has one. */
  reviewedAt?: string;
  isEmpty: boolean;
}

function firstSentence(text: string | undefined): string | undefined {
  const clean = text?.trim().replace(/\s+/g, ' ');
  if (!clean) return undefined;
  const match = clean.match(/^.+?[.!?](?=\s|$)/);
  return match ? match[0] : clean;
}

/**
 * Cards for `collections`, in the order given. `countNoun` defaults to
 * the site's blueprint labels.
 */
export function getCollectionTiles(
  collections: Collection[],
  entries: CollectionEntry[],
  site?: { blueprintConfig?: { labelSingular?: string; labelPlural?: string } },
): CollectionTile[] {
  const singular = site?.blueprintConfig?.labelSingular ?? 'item';
  const plural = site?.blueprintConfig?.labelPlural ?? 'items';
  return collections.map((collection) => {
    const result = runCollection(collection, entries);
    const count = result.entries.length;
    return {
      slug: collection.slug,
      url: `/collections/${collection.slug}/`,
      title: collection.title,
      takeaway: firstSentence(collection.editorial?.introduction) ?? collection.description,
      editorial: result.entries.some((entry) => Boolean(entry.note)),
      kind: collection.kind,
      count,
      countLabel: `${count} ${count === 1 ? singular : plural}`,
      faces: result.entries
        .filter((entry) => entry.avatarUrl)
        .slice(0, 8)
        .map((entry) => ({ title: entry.title, avatarUrl: entry.avatarUrl })),
      examples: result.entries.slice(0, 4).map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        url: entry.url,
        ...(entry.note ? { note: entry.note } : {}),
        ...(entry.avatarUrl ? { avatarUrl: entry.avatarUrl } : {}),
        ...(entry.stars !== undefined ? { stars: entry.stars } : {}),
      })),
      ...(collection.editorial?.lastReviewedAt
        ? { reviewedAt: collection.editorial.lastReviewedAt }
        : {}),
      isEmpty: result.isEmpty,
    };
  });
}
