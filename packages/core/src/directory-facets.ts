/**
 * The single facet registry.
 *
 * `browse.facets` in grove.config.ts decides WHICH browse dimensions a
 * site exposes and in WHAT ORDER; this module owns everything else a
 * facet id means — its filter dimension, display label, URL parameter,
 * and selection mode. Consumers (schema validation, view models, the
 * filter UI, the submission form) all read from here so the id list
 * can't drift into parallel alias tables.
 */

/** Canonical facet ids accepted by `browse.facets` (validated by zod). */
export const FACET_IDS = ['category', 'stack', 'platform', 'tags', 'license'] as const;
export type FacetId = (typeof FACET_IDS)[number];

/** Keys of the `buildFacets()` result / `IndexFilters` dimensions. */
export type FacetDimension = 'categories' | 'stacks' | 'platforms' | 'tags' | 'licenses';

export interface FacetDef {
  id: FacetId;
  /** Key into `buildFacets()` output and `IndexFilters`. */
  dimension: FacetDimension;
  /** Filter-group display label. */
  label: string;
  /** Query parameter (mirrors `KEYS` in directory-search). */
  urlParam: string;
  /** Single-select facets render radios and navigate on change. */
  single: boolean;
}

export const FACET_DEFS: Record<FacetId, FacetDef> = {
  category: {
    id: 'category',
    dimension: 'categories',
    label: 'Category',
    urlParam: 'category',
    single: false,
  },
  stack: { id: 'stack', dimension: 'stacks', label: 'Stack', urlParam: 'stack', single: false },
  platform: {
    id: 'platform',
    dimension: 'platforms',
    label: 'Platform',
    urlParam: 'platform',
    single: false,
  },
  tags: { id: 'tags', dimension: 'tags', label: 'Tag', urlParam: 'tag', single: false },
  license: {
    id: 'license',
    dimension: 'licenses',
    label: 'License',
    urlParam: 'license',
    single: true,
  },
};

/** Default facet set when `browse.facets` is not configured. */
export const DEFAULT_FACETS: readonly FacetId[] = ['category', 'tags'];

const FACET_ALIASES: Record<string, FacetId> = {
  category: 'category',
  categories: 'category',
  stack: 'stack',
  stacks: 'stack',
  platform: 'platform',
  platforms: 'platform',
  tag: 'tags',
  tags: 'tags',
  license: 'license',
  licenses: 'license',
};

/**
 * Normalize a facet spelling to its canonical id. The config schema
 * only accepts canonical ids; this alias map keeps runtime consumers
 * tolerant of the historical singular/plural spellings that may still
 * exist in generated artifacts.
 */
export function canonicalFacetId(value: string): FacetId | undefined {
  return FACET_ALIASES[value];
}

/**
 * Resolve a configured facet list into ordered, deduped definitions.
 * ORDER IS THE CONTRACT: the array order in `browse.facets` is the
 * order filter groups render in. Unknown ids resolve to nothing here —
 * the config schema already rejects them at parse time.
 */
export function configuredFacetDefs(facets?: readonly string[]): FacetDef[] {
  const seen = new Set<FacetId>();
  const defs: FacetDef[] = [];
  for (const raw of facets ?? DEFAULT_FACETS) {
    const id = canonicalFacetId(raw);
    if (id && !seen.has(id)) {
      seen.add(id);
      defs.push(FACET_DEFS[id]);
    }
  }
  return defs;
}
