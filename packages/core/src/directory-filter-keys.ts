// SPDX-License-Identifier: MIT
/**
 * Single source of truth for the directory filter-key mapping.
 *
 * The browse-page controller (`DirectoryIndexClient.astro`), the
 * refine panel (`RefinePanel.astro`), and the view-model builder
 * (`server/directory.ts`) all need to know that the facet group
 * with `data-filter-group-key="stacks"` writes its selections to
 * the `stack` URL param, belongs to the `stacks` taxonomy kind,
 * and displays with the "Stack" label. Pre-v1 these were three
 * inline copies; this module is the one the v1 registry migration
 * relies on so consumer-installed UI never drifts out of sync
 * with the server's URL and taxonomy understanding.
 *
 * Per §22 of `apps/docs/v1-architecture.md`, this is pure-domain
 * data. It can be imported by both server view-models and the
 * client-side controller without creating a forbidden dependency
 * from UI to engine internals.
 */

/** Group key written into `data-filter-group-key` on a facet group. */
export type DirectoryFilterGroupKey =
  | "stacks"
  | "platforms"
  | "categories"
  | "tags"
  | "licenses";

/**
 * The URL search-param key the group writes its selected values to.
 * Singular because each value is one record's id, not a multi.
 */
export type DirectoryFilterParamKey =
  | "stack"
  | "platform"
  | "category"
  | "tag"
  | "license";

/**
 * The taxonomy kind the group belongs to. `tags` maps to the
 * `topics` taxonomy kind (per the schema in `schema.ts`).
 */
export type DirectoryTaxonomyKind =
  | "stacks"
  | "platforms"
  | "categories"
  | "topics"
  | "licenses";

/** Singular, human-readable label rendered in chip/option UIs. */
export type DirectoryFilterLabel =
  | "Stack"
  | "Platform"
  | "Category"
  | "Tag"
  | "License";

/**
 * Group key → URL param key. Single definition; consumed by every
 * filter-aware surface.
 */
export const DIRECTORY_FILTER_KEYS: Readonly<
  Record<DirectoryFilterGroupKey, DirectoryFilterParamKey>
> = Object.freeze({
  stacks: "stack",
  platforms: "platform",
  categories: "category",
  tags: "tag",
  licenses: "license",
});

/**
 * Group key → taxonomy kind the group's options are sourced from.
 */
export const DIRECTORY_TAXONOMY_KINDS: Readonly<
  Record<DirectoryFilterGroupKey, DirectoryTaxonomyKind>
> = Object.freeze({
  stacks: "stacks",
  platforms: "platforms",
  categories: "categories",
  tags: "topics",
  licenses: "licenses",
});

/** Group key → display label for chips, trigger buttons, headings. */
export const DIRECTORY_FILTER_LABELS: Readonly<
  Record<DirectoryFilterGroupKey, DirectoryFilterLabel>
> = Object.freeze({
  stacks: "Stack",
  platforms: "Platform",
  categories: "Category",
  tags: "Tag",
  licenses: "License",
});

/**
 * Reverse map. Given a URL param key, returns the set of group
 * keys that map to it. Most params are 1:1; this is exposed so
 * server helpers can answer "which group does this param belong
 * to?" without re-implementing the table.
 */
export const FACET_DIMENSION_FOR_KEY: Readonly<
  Record<DirectoryFilterParamKey, DirectoryFilterGroupKey>
> = Object.freeze({
  stack: "stacks",
  platform: "platforms",
  category: "categories",
  tag: "tags",
  license: "licenses",
});

/** Type guard. */
export function isDirectoryFilterGroupKey(value: string): value is DirectoryFilterGroupKey {
  return value in DIRECTORY_FILTER_KEYS;
}
