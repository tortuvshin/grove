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
| `filter.ts` | Filter `IndexRecord[]` by URL-driven filter state | `IndexFilters`, `filterRecords`, `hasAnyFilter`, `activeFilterChips`, `FilterChip` |
| `sort.ts` | Sort by sort field, defaulting to "recently updated" | `applySort` |
| `paginate.ts` | Slice a sorted array into pages | `paginate<T>`, `totalPages`, `PAGE_SIZE` |
| `scoring.ts` | Derive a 0-100 score cascade from curation + health signals | `scoreRecords` (typed over the V1 union) |
| `format.ts` | Pretty-print numbers, dates, relative times, slugs | `formatStars`, `formatRelative`, `formatNumber`, `prettySlug`, `labelDisplay`, `lensDisplay`, `statusDisplay` |
| `constants.ts` | The canonical lens / sort option / page size constants | `LENSES`, `PRIMARY_LENSES`, `SORT_OPTIONS`, `PAGE_SIZE` |
| `index.ts` | Barrel | re-exports all of the above |

## Public surface (V1)

```ts
import {
  // filter
  type IndexFilters,
  type FilterChip,
  filterRecords,
  hasAnyFilter,
  activeFilterChips,

  // sort
  applySort,

  // paginate
  paginate,
  totalPages,
  PAGE_SIZE,

  // scoring
  scoreRecords,

  // format
  formatStars,
  formatRelative,
  formatNumber,
  prettySlug,
  labelDisplay,
  lensDisplay,
  statusDisplay,

  // constants
  LENSES,
  PRIMARY_LENSES,
  SORT_OPTIONS,
} from "@grove-dev/ui";
```

## Adapter integration

`@grove-dev/astro` re-exports the same primitives (alongside its own
`@grove-dev/astro` exports) so consumers can write:

```ts
import { filterRecords, applySort, sortDisplay } from "@grove-dev/astro";
```

instead of the deeper `@grove-dev/ui` path. Future adapters
(`@grove-dev/svelte`, `@grove-dev/nextjs`) re-export the same way. The
canonical home is `@grove-dev/ui`; the adapter barrel is convenience.

## V0→V1 history

The V0 published `@grove-dev/ui` exposed `filterRecords`,
`sortRecords`, `paginateRecords`, `scoreTier`, … all hanging off the
flat `CuratedItem` type. They did not carry over to the V1
discriminated `Resource` union, so the V1 release rebuilds the
primitives on top of `IndexRecord` (the slim projection the list
view actually needs). The V0 names and V0 semantics are gone; the
V1 module shape is the one above.

The V1 release is `1.0.x`. Earlier `0.0.0-roadmap` stub releases
shipped an identity helper and a version constant only — they are
not the V1 surface.

## Development

```bash
pnpm --filter @grove-dev/ui build
```

## License

MIT
