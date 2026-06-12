/**
 * @grove-dev/ui — framework-agnostic UI primitives for Grove (V1).
 *
 * The V1 data model is a discriminated union of `ProjectRecord`,
 * `ResourceRecord`, and `EntityRecord` (see `@grove-dev/core/schema`).
 * This package exposes pure, dependency-free primitives that the
 * framework adapters (`@grove-dev/astro`, `@grove-dev/svelte`,
 * `@grove-dev/nextjs`) re-export.
 *
 * Surface:
 *   - filter  : `filterRecords`, `hasAnyFilter`, `activeFilterChips`,
 *               `isMaintained`, `IndexFilters`, `FilterChip`
 *   - sort    : `sortRecords`
 *   - paginate: `paginateRecords`, `totalPages`
 *   - scoring : `scoreTier`, `scoreTierLabel`, `scoreLabel`,
 *               `SCORE_DIMENSIONS`, `SCORE_LABELS`, `SCORE_REASONING`,
 *               `AppScores`
 *   - format  : `compact`, `formatStars`, `formatNumber`,
 *               `formatRelative`, `formatDate`
 *   - lens    : `LENSES`, `PRIMARY_LENSES`, `lensById`, `isPrimaryLens`,
 *               `LensId`, `LensDef`
 *   - sort opt: `SORT_OPTIONS`, `SortValue`
 *   - core typ: re-exports `Resource`, `ProjectRecord`, `ResourceRecord`,
 *               `EntityRecord`, `IndexRecord` from `@grove-dev/core` so
 *               consumers that only depend on `@grove-dev/ui` can still
 *               type their data.
 *   - css     : `dist/styles.css` (shared design tokens + component
 *               classes; no Tailwind dependency required).
 */

export const UI_VERSION = "1.0.0";

// ── Re-export the V1 core types so `@grove-dev/ui` is enough for
//    typing a record list in consumer code.
export type {
  Resource,
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  IndexRecord,
  IndexProjectRecord,
  IndexResourceRecord,
  IndexEntityRecord,
  HealthStatus,
  ResourceKind,
} from "@grove-dev/core";

// ── Constants: sort options, lens catalog, page size.
export {
  SORT_OPTIONS,
  PRIMARY_LENSES,
  LENSES,
  PAGE_SIZE,
  lensById,
  isPrimaryLens,
} from "./lib/constants.js";
export type { SortValue, LensId, LensDef } from "./lib/constants.js";

// ── Filter primitives.
export {
  filterRecords,
  hasAnyFilter,
  activeFilterChips,
  isMaintained,
} from "./lib/filter.js";
export type { IndexFilters, FilterChip } from "./lib/filter.js";

// ── Sort primitives.
export { sortRecords } from "./lib/sort.js";

// ── Pagination primitives.
export { paginateRecords, totalPages } from "./lib/paginate.js";

// ── Scoring helpers.
export {
  scoreTier,
  scoreTierLabel,
  scoreLabel,
  SCORE_DIMENSIONS,
  SCORE_LABELS,
  SCORE_REASONING,
} from "./lib/scoring.js";
export type { AppScores } from "./lib/scoring.js";

// ── Formatting helpers.
export {
  compact,
  formatStars,
  formatNumber,
  formatRelative,
  formatDate,
} from "./lib/format.js";
