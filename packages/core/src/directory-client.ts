/**
 * Browser-safe directory discovery API.
 *
 * This entry point deliberately excludes config loading, filesystem IO,
 * validation, and generation so client controllers can reuse Grove's
 * canonical filter, sort, and lens rules without Node-only dependencies.
 */
export * from "./directory-display.js";
export * from "./directory-facets.js";
export * from "./directory-lenses.js";
export * from "./directory-search.js";
// Filter-key mapping is a pure data table (no IO, no schema deps).
// Re-exported here so client controllers like DirectoryIndexClient
// can import the same single source the server uses, instead of
// duplicating the keys/labels/kinds inline.
export {
  DIRECTORY_FILTER_KEYS,
  DIRECTORY_TAXONOMY_KINDS,
  DIRECTORY_FILTER_LABELS,
  FACET_DIMENSION_FOR_KEY,
  isDirectoryFilterGroupKey,
} from "./directory-filter-keys.js";
export type {
  DirectoryFilterGroupKey,
  DirectoryFilterParamKey,
  DirectoryTaxonomyKind,
  DirectoryFilterLabel,
} from "./directory-filter-keys.js";
