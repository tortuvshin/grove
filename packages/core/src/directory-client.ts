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
