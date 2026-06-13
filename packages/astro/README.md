# `@grove-dev/astro`

> Astro framework adapter for Grove.

A thin layer of Astro components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new` copies into a new project.

```bash
pnpm add @grove-dev/astro
```

## What it ships

```txt
src/
├── components/        # ItemCard, CategoryGrid, ScoreBars, IndexRow,
│                      # Pagination, RecordSection, RefinePanel, Hero,
│                      # Icon, SmartLensTabs, ExploreByCategory,
│                      # ExploreByStack, WhyThisExists, CurationGrid,
│                      # ContributorsGrid, StackGrid, MinimalAbout,
│                      # OriginalCollection, DecisionRow, FilterGroupMenu,
│                      # FilterOptions
├── layouts/           # BaseLayout
├── styles.css         # design tokens + utility classes
└── index.ts           # re-exports @grove-dev/core + @grove-dev/ui

templates/
└── default/           # full Astro starter: pages/, layouts/, public/, data/,
                       # .github/, astro.config.mjs
```

The package publishes `dist/`, `src/`, and `templates/`. The `templates/` directory is **not** imported by consumers; it is copied by `@grove-dev/cli` at scaffold time.

> **Component naming:** `ItemCard` is the V1 published API name (kept for stability — it appears in user docs and downstream sites). The internal `IndexRow` / `Pagination` / `RecordSection` aliases are V1 canonical names; the old `AppsIndexRow` / `AppsPagination` / `ItemSection` V0 names have been removed.

## Usage in a space

```astro
---
import ItemCard from "@grove-dev/astro/components/ItemCard.astro";
import IndexRow from "@grove-dev/astro/components/IndexRow.astro";
import { ScoreBars, filterRecords, sortDisplay } from "@grove-dev/astro";
import "@grove-dev/astro/styles.css";
import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";
import records from "../data/generated/records.json";
---
<BaseLayout title="My Grove space">
  <RefinePanel initial={filters} facets={facets} />
  {records.map((r) => <ItemCard record={r} href={`/projects/${r.slug}`} />)}
</BaseLayout>
```

Components are imported by path, not through the barrel — that lets `astro check` validate them in their own context. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `slugForCategory`, etc.) are available from the same import.

## Templates

`templates/default/` is a complete Astro starter. It contains:

- `src/pages/` — index, contributors, about, submit, 404, sitemap.xml, plus blueprint-aware dynamic routes at `[slug]/index.astro` (list) and `[slug]/[recordSlug].astro` (detail), plus `apps/[recordSlug].astro` (V0→V1 301 redirect)
- `src/components/` — site-specific page sections (none by default; the V1 surface is in `packages/astro/src/components/`)
- `src/data/records.ts` — typed loader for `data/generated/records.full.json` (V0 `src/data/config.ts` is replaced)
- `src/lib/` — site-specific helpers (no business logic)
- `scripts/` — `build-llms.mjs` (regenerates `llms-full.txt` only, preserves committed `llms.txt`), `fetch-icons.mjs`, `migrate-legacy-to-schema-v1.mjs`
- `public/` — icons, OG image, robots, `llms.txt`, `llms-full.txt`
- `data/` — empty tree for the gardener to populate; `data/records/<slug>.yml` is the V1 layout (V0 was `data/apps/*.yml`)
- `astro.config.mjs` (no `tailwind.config.mjs` by default; plain CSS + design tokens)
- `.github/` — issue templates + 11 GitHub Actions workflows (validate, build, deploy, sync, cleanup, …)

Business logic (filtering, sorting, scoring, faceting) is **imported from `@grove-dev/ui`**, never re-implemented in the template. The V0 commands (`grove build-data`, `grove build-llms-full`, `grove analyze`, `grove enrich`) have been replaced with V1 names (`grove generate`, `grove llms`, `grove sync github`).

## Layering

`@grove-dev/astro` is the third layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless).
2. **`@grove-dev/ui`** — framework-agnostic UI primitives.
3. **`@grove-dev/astro`** ← you are here — Astro components, layouts, template.

If you need a Svelte or Next.js variant, see `@grove-dev/svelte` and `@grove-dev/nextjs`.

## Development

```bash
pnpm --filter @grove-dev/astro build
pnpm --filter @grove-dev/astro check
```

## License

MIT
