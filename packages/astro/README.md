# `@grove-dev/astro`

> Astro framework adapter for Grove.

A thin layer of Astro components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new` copies into a new project.

```bash
pnpm add @grove-dev/astro
```

## What it ships

```txt
src/
├── components/        # ItemCard, CategoryGrid, HealthBadge, ScoreBars,
│                      # DirectoryFilters, DirectoryHero, LensTabs,
│                      # ActiveFilterChips, MethodologyPanel, Pagination,
│                      # ProjectDetail, SubmitDraft
├── layouts/           # BaseLayout
├── styles.css         # design tokens + utility classes
└── index.ts           # re-exports @grove-dev/ui

templates/
└── default/           # full Astro starter: pages/, layouts/, public/, data/,
                       # .github/, astro.config.mjs, tailwind.config.mjs
```

The package publishes `dist/`, `src/`, and `templates/`. The `templates/` directory is **not** imported by consumers; it is copied by `@grove-dev/cli` at scaffold time.

## Usage in a space

```astro
---
import { ItemCard, ScoreBars, HealthBadge, DirectoryFilters } from "@grove-dev/astro";
import "@grove-dev/astro/styles.css";
import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";
import apps from "../data/generated/apps.json";
---
<BaseLayout title="My Grove space">
  <DirectoryFilters facets={...} />
  {apps.map((app) => <ItemCard item={app} />)}
</BaseLayout>
```

Components are imported by path, not through the barrel — that lets `astro check` validate them in their own context. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `slugForCategory`, etc.) are available from the same import.

## Templates

`templates/default/` is a complete Astro starter. It contains:

- `src/pages/` — index, item detail, search, about, methodology, submit, sitemap
- `src/components/` — layout primitives, page sections
- `src/data/` — placeholder dataset; replaced by `grove build-data`
- `src/lib/` — site-specific helpers (no business logic)
- `public/` — icons, OG image, robots
- `data/` — empty tree for the gardener to populate
- `astro.config.mjs`, `tailwind.config.mjs`
- `.github/` — issue templates

Business logic (filtering, sorting, scoring, faceting) is **imported from `@grove-dev/ui`**, never re-implemented in the template.

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
