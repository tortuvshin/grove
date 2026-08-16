/**
 * @grove-dev/astro — framework-agnostic lib helpers.
 *
 * Re-exports every helper that the showcase component library
 * (and any future consumer) can use to:
 *
 *   - parse GitHub repo URLs (`lib/repo`)
 *   - format counts, dates, stars (`lib/format`)
 *   - apply curated lenses / facets / search filters (`lib/lenses`,
 *     `lib/search`)
 *   - compute taxonomy counts at build time (`lib/taxonomy-counts`)
 *   - pretty-print slugs and label/lens/sort/status ids (`lib/display`)
 *   - resolve icon registry ids to asset paths (`lib/icon-registry`)
 *
 * All helpers are pure, dependency-free, and typed against
 * `@grove-dev/core` (specifically `ProjectRecord` for the index
 * payload and the `Score` / `HealthStatus` unions).
 */

export * from "./repo.js";
export * from "./format.js";
export * from "./lenses.js";
export * from "./search.js";
export * from "./taxonomy-counts.js";
export * from "./display.js";
export * from "./icon-registry.js";
export * from "./icon-kinds.js";
export * from "./packaged-icons.js";
