# `@grove-dev/svelte`

> SvelteKit framework adapter for Grove.

A thin layer of Svelte components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new --framework svelte` copies into a new project.

> **⚠️ Roadmap only — not in V1 — package is private.**
> Marked `"private": true` (line 5 of `package.json`) and the registry
> will refuse to publish it. Note: `publishConfig.access: "public"`
> is retained for if/when the package is later revived; it is gated
> by `private` at the registry level. Do not depend on the
> `@grove-dev/svelte` name from outside this monorepo — there is no
> public artifact. The real V1 entry point is `@grove-dev/astro` (and
> the framework-agnostic `@grove-dev/core` / `@grove-dev/ui`).

```bash
# This will fail — the package is private:
pnpm add @grove-dev/svelte   # 404 (not published) or 403 (private)
```

## Status

**Roadmap only — not in V1.** Grove V1 ships the Astro renderer only.
The V1 CLI refuses `--framework svelte` at scaffold time (see
[`@grove-dev/cli/src/index.ts`](../../cli/src/index.ts) — the
`isFramework()` helper accepts only `"astro"` in V1). The SvelteKit
adapter is reserved for V1.1 once `@grove-dev/core` and `@grove-dev/ui`
(V1) are stable. See [`docs/roadmap.md`](../docs/roadmap.md) for the
schedule.

This package currently ships a skeleton only:

- `src/index.ts` — re-exports `@grove-dev/ui` (V1 primitives: `filterRecords`, `sortRecords`, `paginateRecords`, `scoreTier`, `scoreTierLabel`, `scoreLabel`, `format*`, `LENSES`, `SORT_OPTIONS`, etc.)
- `templates/default/package.json` — SvelteKit 2 + Svelte 5 wiring (not exercised by V1)

The component library, routes, and theme are still to be built. The architectural shape is locked: anything framework-specific lives in this package, anything generic stays in `@grove-dev/core` and `@grove-dev/ui`.

## What it will ship (roadmap, V1.1)

```txt
src/
├── components/        # ItemCard.svelte, IndexRow.svelte, RecordSection.svelte,
│                      # Pagination.svelte, ScoreBars.svelte, RefinePanel.svelte,
│                      # Hero.svelte, … (22 V1 surface, ported from @grove-dev/astro)
├── layouts/           # BaseLayout.svelte
├── styles.css         # design tokens
└── index.ts           # re-exports @grove-dev/ui

templates/
└── default/           # full SvelteKit starter: routes/, lib/, static/,
                       # data/, .github/, svelte.config.js
```

## Usage in a space (planned)

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import ItemCard from "@grove-dev/svelte/components/ItemCard.svelte";
  import BaseLayout from "@grove-dev/svelte/layouts/BaseLayout.svelte";
  import "@grove-dev/svelte/styles.css";
  import records from "$lib/data/generated/records.json";
</script>

<BaseLayout title="My Grove space">
  {#each records as record (record.slug)}
    <ItemCard {record} href={`/projects/${record.slug}`} />
  {/each}
</BaseLayout>
```

Components are imported by path. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `sortRecords`, `paginateRecords`, `scoreTier`, `scoreTierLabel`, `scoreLabel`, `compact`, `formatStars`, `formatNumber`, `formatRelative`, `formatDate`, `LENSES`, `SORT_OPTIONS`) are available from the same import.

## Layering

`@grove-dev/svelte` is the third layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless, V1 `Resource` union).
2. **`@grove-dev/ui`** — framework-agnostic UI primitives (V1: 5 typed modules over `IndexRecord`).
3. **`@grove-dev/svelte`** ← you are here — Svelte components, layouts, template.

## Development

```bash
pnpm --filter @grove-dev/svelte build
pnpm --filter @grove-dev/svelte check
```

## License

MIT
