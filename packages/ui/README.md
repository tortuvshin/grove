# `@grove-dev/ui`

> Framework-agnostic UI primitives for Grove.

Pure TypeScript, zero framework dependencies. Provides filter, sort, pagination, scoring, stats, and slug helpers that work identically in Astro, Next.js, Svelte, or any other framework.

```bash
pnpm add @grove-dev/ui
```

## What it does

- **Filters** — `filterRecords(records, filters)` and `activeFilterChips(filters)` for query, category, tag, language, license, health, label, lens.
- **Sort** — `sortRecords(records, sort)` with built-in orders: `recently-updated`, `most-starred`, `most-mature`, `best-learning`, `contribution-ready`, `alphabetical`.
- **Pagination** — `paginateRecords()`, `totalPages()`.
- **Stats** — `buildDirectoryStats()`, `categoryCounts()`, `facetValues()`.
- **Scores** — `scoreTier()`, `SCORE_LABELS`, `SCORE_REASONING`.
- **Slug** — `slugForCategory()`.
- **Records** — `buildDirectoryRecords()`, `visibleRecords()`.
- **Constants** — `SORT_OPTIONS`, `LENSES`, `PAGE_SIZE`.
- **Types** — `DirectoryFilters`, `DirectoryRecord`, `DirectoryStats`, `DirectorySort`, `FilterChip`.

## Usage

```ts
import {
  filterRecords,
  sortRecords,
  paginateRecords,
  buildDirectoryStats,
  slugForCategory,
  scoreTier,
  SCORE_LABELS,
  LENSES,
  SORT_OPTIONS,
  PAGE_SIZE,
  type DirectoryFilters,
  type DirectoryRecord,
} from "@grove-dev/ui";
```

### Astro example

```astro
---
import { filterRecords, sortRecords, paginateRecords, buildDirectoryRecords } from "@grove-dev/ui";
import apps from "../data/apps.json";
import health from "../data/health.json";

const records = buildDirectoryRecords(apps, health);
const filters: DirectoryFilters = { sort: "most-starred", health: "mature" };
const filtered = filterRecords(records, filters);
const sorted = sortRecords(filtered, filters.sort);
const page = paginateRecords(sorted, 1, 12);
---
{page.map((r) => <ItemCard item={r.item} health={r.health} />)}
```

### Next.js / Svelte

The same helpers work — they have no framework dependencies. Pass them serialized data, render with whatever UI you ship.

## Layering

`@grove-dev/ui` is the second layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless).
2. **`@grove-dev/ui`** ← you are here — framework-agnostic UI primitives.
3. **`@grove-dev/astro`** / **`@grove-dev/nextjs`** / **`@grove-dev/svelte`** — thin framework adapters (components, layouts, templates).

If a helper feels like it could live in any framework, it belongs here. If it's a component, layout, or routing concern, it belongs in an adapter.

## Development

```bash
pnpm --filter @grove-dev/ui build
pnpm --filter @grove-dev/ui check
```

## License

MIT
