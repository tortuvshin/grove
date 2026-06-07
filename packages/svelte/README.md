# `@grove-dev/svelte`

> SvelteKit framework adapter for Grove.

A thin layer of Svelte components, layouts, and design tokens, on top of the framework-agnostic `@grove-dev/core` and `@grove-dev/ui`. Includes a default `templates/default/` directory that `grove new --framework svelte` copies into a new project.

```bash
pnpm add @grove-dev/svelte
```

## Status

This package is a **skeleton** at the moment. It ships:

- `src/index.ts` — re-exports `@grove-dev/ui`
- `src/styles.css` — placeholder design tokens
- `templates/default/package.json` — SvelteKit 2 + Svelte 5 wiring

The component library, routes, and theme are still to be built. The architectural shape is locked: anything framework-specific lives in this package, anything generic stays in `@grove-dev/core` and `@grove-dev/ui`.

## What it will ship (roadmap)

```txt
src/
├── components/        # ItemCard.svelte, CategoryGrid.svelte, HealthBadge.svelte,
│                      # ScoreBars.svelte, DirectoryFilters.svelte, ...
├── layouts/           # BaseLayout.svelte
├── styles.css         # design tokens + Tailwind entry
└── index.ts           # re-exports @grove-dev/ui

templates/
└── default/           # full SvelteKit starter: routes/, lib/, static/,
                       # data/, .github/, svelte.config.js, tailwind.config.mjs
```

## Usage in a space

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { ItemCard } from "@grove-dev/svelte/components/ItemCard.svelte";
  import { BaseLayout } from "@grove-dev/svelte/layouts/BaseLayout.svelte";
  import "@grove-dev/svelte/styles.css";
  import apps from "$lib/data/generated/apps.json";
</script>

<BaseLayout title="My Grove space">
  {#each apps as app (app.slug)}
    <ItemCard {app} />
  {/each}
</BaseLayout>
```

Components are imported by path. The barrel re-exports `@grove-dev/ui` so generic helpers (`filterRecords`, `slugForCategory`, etc.) are available from the same import.

## Layering

`@grove-dev/svelte` is the third layer of the Grove stack:

1. **`@grove-dev/core`** — schemas, importers, build pipeline (headless).
2. **`@grove-dev/ui`** — framework-agnostic UI primitives.
3. **`@grove-dev/svelte`** ← you are here — Svelte components, layouts, template.

## Development

```bash
pnpm --filter @grove-dev/svelte build
pnpm --filter @grove-dev/svelte check
```

## License

MIT
