/**
 * Collection — the canonical, framework-independent model for a curated
 * or auto-generated directory of records.
 *
 * A `Collection` declares:
 *   - a slug (URL-safe id) and human title/description
 *   - a `query` that filters an entry stream (stacks, platforms, categories,
 *     licenses, kinds, excludeStatuses, free-text q)
 *   - a `ranking` that decides order (quality, active, recency, stars, curated)
 *   - optional hand-picked `entries` (with per-record notes and pinning)
 *   - optional `editorial` intro/selection notes, a Markdown `content`
 *     body and `faq`
 *   - `seo` policy (indexable flag, optional overrides)
 *
 * `CollectionEntry` is the lightweight record shape that flows through
 * filter and rank — it intentionally carries only the fields needed for
 * selection and ordering, not the full project record (which is heavier).
 *
 * `filterEntries` and `rankEntries` are pure functions; they share no
 * state and never mutate their input.
 */

import { z } from 'zod';

const rankingPresetSchema = z.enum(['quality', 'active', 'curated', 'recency', 'stars']);

const collectionQuerySchema = z.object({
  stacks: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  licenses: z.array(z.string()).optional(),
  kinds: z.array(z.string()).optional(),
  excludeStatuses: z.array(z.string()).optional(),
  /** Minimum GitHub star count. Entries below this are excluded. */
  minStars: z.number().nonnegative().optional(),
  /** Minimum GitHub fork count. Entries below this are excluded. */
  minForks: z.number().nonnegative().optional(),
  q: z.string().optional(),
});

/**
 * The shape of one `data/collections/<slug>.yml` file. Named
 * `collectionDefinitionSchema` because `collectionSchema` is already the
 * JSON-LD builder in `page-document.ts`.
 *
 * Top-level keys are loose so a consumer can carry its own fields next
 * to Grove's; the blocks Grove reads are strict enough that a typo in
 * `ranking.preset` or a string `minStars` fails `grove check` instead of
 * silently producing an unfiltered, unranked page.
 */
export const collectionDefinitionSchema = z.looseObject({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case'),
  kind: z.enum(['curated', 'generated']).default('curated'),
  title: z.string().min(1),
  description: z.string().min(1),
  /**
   * Path to the collection's long-form Markdown body, relative to the
   * project root (convention: `./content/collections/<slug>.md`).
   */
  content: z.string().min(1).optional(),
  query: collectionQuerySchema.prefault({}),
  /**
   * Hand-picked records. A pick is in the collection whatever the
   * `query` says; `note` is the curator's verdict for that record on
   * this page and replaces the record's own description in the list;
   * `pinned` keeps a pick at the top, in file order, above the ranking.
   *
   * Optional rather than defaulted so an existing `Collection` literal
   * keeps type-checking.
   */
  entries: z
    .array(
      z.object({
        slug: z.string().min(1),
        note: z.string().min(1).optional(),
        pinned: z.boolean().optional(),
      }),
    )
    .optional(),
  ranking: z
    .object({
      preset: rankingPresetSchema,
      signals: z.array(z.string()).optional(),
    })
    .prefault({ preset: 'curated' }),
  editorial: z
    .object({
      introduction: z.string().optional(),
      selectionNote: z.string().optional(),
      lastReviewedAt: z.string().optional(),
    })
    .optional(),
  /** Questions answered on the page; also emitted as `FAQPage` JSON-LD. */
  faq: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).optional(),
  seo: z
    .object({
      index: z.boolean().default(true),
      title: z.string().optional(),
      description: z.string().optional(),
    })
    .prefault({}),
});

export type Collection = z.infer<typeof collectionDefinitionSchema>;
export type CollectionKind = Collection['kind'];
export type RankingPreset = z.infer<typeof rankingPresetSchema>;
export type CollectionQuery = Collection['query'];
export type CollectionRanking = Collection['ranking'];
export type CollectionEditorial = NonNullable<Collection['editorial']>;
export type CollectionSeo = Collection['seo'];
export type CollectionPick = NonNullable<Collection['entries']>[number];
export type CollectionFaqItem = NonNullable<Collection['faq']>[number];

export interface CollectionEntry {
  slug: string;
  title: string;
  description: string;
  url: string;
  /** GitHub (or other source) repository URL. Used by the row
   *  component to render a "View repo" link in the footer. */
  repoHref?: string;
  /** Project's own homepage URL (e.g. marketing site). Rendered
   *  as "Visit site" when present, alongside "View repo". */
  homepageHref?: string;
  stack?: string;
  platform?: string[];
  /** Legacy single-value license (GitHub-synced SPDX id). Kept for
   *  backward compatibility with v0.4 records that only exposed one
   *  license. Prefer `licenses` for new code paths. */
  license?: string;
  /** Full license array (curated SPDX ids + GitHub fallback). */
  licenses?: string[];
  status?: string;
  stars?: number;
  forks?: number;
  pushedAt?: string;
  curationScore?: number;
  activityScore?: number;
  categories?: string[];
  /** The curator's note for this record in the collection being run. */
  note?: string;
  /** True when the collection pins this record above the ranking. */
  pinned?: boolean;
}

export function filterEntries(
  entries: CollectionEntry[],
  query: CollectionQuery,
): CollectionEntry[] {
  return entries.filter((entry) => {
    if (query.stacks?.length && !query.stacks.includes(entry.stack ?? '')) {
      return false;
    }
    if (query.platforms?.length) {
      const eps = entry.platform ?? [];
      if (!query.platforms.some((p) => eps.includes(p))) return false;
    }
    if (query.categories?.length) {
      const cats = entry.categories ?? [];
      if (!query.categories.some((c) => cats.includes(c))) return false;
    }
    if (query.licenses?.length) {
      // Combine the legacy `entry.license` and the new `entry.licenses`
      // array into a single normalized set, so a curated record (whose
      // SPDX id lives in `licenses`) and a GitHub-only record (whose
      // id lives in `license`) both match the same query.
      const wanted = query.licenses.map((l) => l.toLowerCase());
      const candidates = new Set<string>();
      if (entry.license) candidates.add(entry.license.toLowerCase());
      for (const l of entry.licenses ?? []) candidates.add(l.toLowerCase());
      if (!wanted.some((w) => candidates.has(w))) return false;
    }
    if (query.kinds?.length && !query.kinds.includes(entry.status ?? '')) {
      return false;
    }
    if (query.excludeStatuses?.length && query.excludeStatuses.includes(entry.status ?? '')) {
      return false;
    }
    if (query.minStars != null && (entry.stars ?? 0) < query.minStars) {
      return false;
    }
    if (query.minForks != null && (entry.forks ?? 0) < query.minForks) {
      return false;
    }
    if (query.q) {
      const hay = `${entry.title} ${entry.description}`.toLowerCase();
      if (!hay.includes(query.q.toLowerCase())) return false;
    }
    return true;
  });
}

export function rankEntries(
  entries: CollectionEntry[],
  ranking: CollectionRanking,
): CollectionEntry[] {
  const copy = [...entries];
  switch (ranking.preset) {
    case 'quality':
      return copy.sort((a, b) => score(b) - score(a));
    case 'active':
      return copy.sort((a, b) => activeScore(b) - activeScore(a));
    case 'recency':
      return copy.sort((a, b) => parseTime(b.pushedAt) - parseTime(a.pushedAt));
    case 'stars':
      return copy.sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0));
    case 'curated':
      return copy;
  }
}

function score(e: CollectionEntry): number {
  return (e.curationScore ?? 0) * (e.activityScore ?? 0);
}

function activeScore(e: CollectionEntry): number {
  const recency = e.pushedAt
    ? Math.max(0, 1 - (Date.now() - Date.parse(e.pushedAt)) / (365 * 24 * 3600 * 1000))
    : 0;
  return (e.activityScore ?? 0) * 0.7 + recency * 0.3;
}

function parseTime(d: string | undefined): number {
  if (!d) return 0;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : 0;
}
