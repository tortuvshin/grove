/**
 * Index policy — which generated pages a site offers to search engines.
 *
 * A directory built from imported metadata can publish hundreds of
 * pages that are template text over synced data. `seo.*IndexPolicy` in
 * `grove.config.ts` lets a site index only the pages a person wrote or
 * reviewed; everything else still renders (and still links onwards)
 * but carries `noindex,follow` and stays out of the sitemap.
 *
 * The rules live here, as pure functions, so the page models
 * (`@grove-dev/astro`) and the sitemap (`prepareDirectory`) decide from
 * the same code and can never disagree — and so a consumer's own SEO
 * gate can re-derive the expected answer for any page.
 *
 * Every policy defaults to `'all'`: without configuration nothing
 * changes.
 */
import { readContentFile, stripLeadingH1 } from './content-body.js';
import type { LISTING_INDEX_POLICIES, RECORD_INDEX_POLICIES } from './schema.js';

/** `all`: every listed record. `editorial`: records with a written
 *  Markdown body. `editorial-and-reviewed`: a body and `curation.reviewed`. */
export type RecordIndexPolicy = (typeof RECORD_INDEX_POLICIES)[number];
/** `all`: every non-empty page. `editorial`: pages with editorial intro copy. */
export type ListingIndexPolicy = (typeof LISTING_INDEX_POLICIES)[number];

export interface IndexPolicyConfig {
  recordIndexPolicy?: RecordIndexPolicy;
  collectionIndexPolicy?: ListingIndexPolicy;
  taxonomyIndexPolicy?: ListingIndexPolicy;
}

/** Robots value for a page the policy keeps out of the index. `follow`
 *  so the links on it (to indexable pages) are still crawled. */
export const NOINDEX_FOLLOW = 'noindex,follow';

export interface RecordIndexInput {
  /** The record has a non-empty Markdown body (see `hasEditorialBody`). */
  hasBody: boolean;
  /** `curation.reviewed`. */
  reviewed?: boolean;
  /** Effective visibility; `hide` / `remove` are never indexable. */
  visibility?: string;
}

export function recordIndexable(
  input: RecordIndexInput,
  policy: RecordIndexPolicy = 'all',
): boolean {
  if (input.visibility === 'hide' || input.visibility === 'remove') return false;
  if (policy === 'all') return true;
  if (!input.hasBody) return false;
  return policy === 'editorial' || input.reviewed === true;
}

export interface CollectionIndexInput {
  /** `editorial.introduction`. */
  introduction?: string | undefined;
  /** The collection has a Markdown `content` body. */
  hasBody?: boolean;
  /** `seo.index` — `false` always wins. */
  seoIndex?: boolean | undefined;
  /** Resolved entry count; an empty collection has nothing to rank for. */
  entryCount: number;
}

export function collectionIndexable(
  input: CollectionIndexInput,
  policy: ListingIndexPolicy = 'all',
): boolean {
  if (input.seoIndex === false || input.entryCount === 0) return false;
  if (policy === 'all') return true;
  return Boolean(input.introduction?.trim()) || input.hasBody === true;
}

export interface TaxonomyTermIndexInput {
  /** The term's `description` in `data/taxonomy/*.yml` — its intro copy. */
  description?: string | undefined;
  /** Visible records in the term; an empty term is never indexable. */
  count: number;
}

export function taxonomyTermIndexable(
  input: TaxonomyTermIndexInput,
  policy: ListingIndexPolicy = 'all',
): boolean {
  if (input.count === 0) return false;
  if (policy === 'all') return true;
  return Boolean(input.description?.trim());
}

/**
 * Whether a `content:` pointer resolves to a Markdown body with
 * something in it besides an opening `# Title` — the same body the
 * detail page renders as the article.
 */
export function hasEditorialBody(contentPath: string | undefined, candidates?: string[]): boolean {
  if (!contentPath) return false;
  const found = readContentFile(contentPath, candidates);
  if (!found) return false;
  return stripLeadingH1(found.body).trim().length > 0;
}
