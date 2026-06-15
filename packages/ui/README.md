# `@grove-dev/ui`

> Framework-agnostic UI primitives for Grove. V1 ships 5 typed modules over the `IndexRecord` discriminated union.

```bash
pnpm add @grove-dev/ui
```

## What it does

`@grove-dev/ui` is the V1 implementation of the framework-agnostic UI primitives that the Astro adapter (and every future adapter) re-exports. Every primitive is typed against `@grove-dev/core`'s `IndexRecord` discriminated union — the same union the renderer reads from `data/generated/records.index.json`.

## V1 primitive modules

The package ships 5 modules, each a small, well-tested, dependency-free TypeScript file:

| Module | What it does | Key exports |
|---|---|---|
| `filter.ts` | Filter `IndexRecord[]` by URL-driven filter state | `IndexFilters` (type), `FilterChip` (type), `filterRecords`, `hasAnyFilter`, `activeFilterChips`, `isMaintained` |
| `sort.ts` | Sort by sort field, defaulting to "recently updated" | `sortRecords` |
| `paginate.ts` | Slice a sorted array into pages | `paginateRecords`, `totalPages`, `PAGE_SIZE` |
| `scoring.ts` | Derive a 0-100 score cascade from curation + health signals | `scoreTier`, `scoreTierLabel`, `scoreLabel`, `SCORE_DIMENSIONS`, `SCORE_LABELS`, `SCORE_REASONING`, `AppScores` (type) |
| `format.ts` | Pretty-print numbers, dates, relative times | `compact`, `formatStars`, `formatNumber`, `formatRelative`, `formatDate` |
| `constants.ts` | The canonical lens / sort option / page size constants | `SORT_OPTIONS`, `PRIMARY_LENSES`, `LENSES`, `lensById`, `isPrimaryLens`, `SortValue` (type), `LensId` (type), `LensDef` (type) |
| `index.ts` | Barrel | re-exports all of the above plus `UI_VERSION` and the V1 `Resource` / record types re-exported from `@grove-dev/core` |

## Public surface (V1)

```ts
import {
  // meta
  UI_VERSION,

  // re-exported V1 core types
  type Resource,
  type ProjectRecord,
  type ResourceRecord,
  type EntityRecord,
  type IndexRecord,
  type IndexProjectRecord,
  type IndexResourceRecord,
  type IndexEntityRecord,
  type HealthStatus,
  type ResourceKind,

  // filter
  type IndexFilters,
  type FilterChip,
  filterRecords,
  hasAnyFilter,
  activeFilterChips,
  isMaintained,

  // sort
  sortRecords,
  type SortValue,
  SORT_OPTIONS,

  // paginate
  paginateRecords,
  totalPages,
  PAGE_SIZE,

  // scoring
  scoreTier,
  scoreTierLabel,
  scoreLabel,
  SCORE_DIMENSIONS,
  SCORE_LABELS,
  SCORE_REASONING,
  type AppScores,

  // format
  compact,
  formatStars,
  formatNumber,
  formatRelative,
  formatDate,

  // lens catalog
  LENSES,
  PRIMARY_LENSES,
  type LensId,
  type LensDef,
  lensById,
  isPrimaryLens,
} from "@grove-dev/ui";
```

## Adapter integration

`@grove-dev/astro` re-exports the same primitives (alongside its own
`@grove-dev/astro` exports) so consumers can write:

```ts
import { filterRecords, sortRecords, paginateRecords, scoreTier } from "@grove-dev/astro";
```

instead of the deeper `@grove-dev/ui` path. Future adapters
(`@grove-dev/svelte`, `@grove-dev/nextjs`) re-export the same way. The
canonical home is `@grove-dev/ui`; the adapter barrel is convenience.

## V0→V1 history

The V0 published `@grove-dev/ui` shipped at `0.0.0-roadmap` as a
stub (an identity helper and a version constant only) — there was
no V0 primitive surface. The V1 release (`1.0.x`) is the first
version that ships the typed modules listed above. The V0 names
that earlier docs floated (`applySort`, `paginate<T>`, `scoreRecords`,
`prettySlug`, `labelDisplay`, `lensDisplay`, `statusDisplay`)
**do not exist** in any released version of the package — they
were draft names that did not survive review. The canonical V1
names are the ones in the table above (`sortRecords`,
`paginateRecords`, `scoreTier` / `scoreTierLabel` / `scoreLabel`,
`formatStars` / `formatRelative` / `formatNumber`, etc.).

The V1 release is `1.0.x`.

## CSS

The package ships a `dist/styles.css` (subpath export
`@grove-dev/ui/styles.css`) — shared design tokens and component
classes. No Tailwind dependency required.

## Development

```bash
pnpm --filter @grove-dev/ui build
```

## License

MIT
