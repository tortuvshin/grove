# Grove directory

This is a complete, customizable Astro directory powered by Grove. The pages
and product content live in this repository; Grove supplies reusable
components, data contracts, generated artifacts, and CI commands.

## Start locally

```sh
pnpm install
pnpm dev
```

Run the same validation used by CI:

```sh
pnpm exec grove check
pnpm build
```

## Customize

- `grove.config.ts` — site identity, navigation, footer, labels, facets,
  analytics, and theme
- `data/records/` — one YAML record per directory item
- `data/taxonomy/` — categories, stacks, platforms, and distribution channels
- `src/pages/` — consumer-owned Astro pages and custom routes
- `src/components/` — project-specific components
- `public/icons/` — custom stack and platform SVG assets

Generated data stays in `data/generated/`. Grove prepares it automatically
when Astro starts, so the project does not need consumer-owned generation
scripts.

## Refresh GitHub data

```sh
pnpm exec grove sync github
pnpm exec grove sync contributors
```

The included workflows run checks, refresh metadata, and prepare a deployable
static build. Adjust the deployment workflow for the hosting provider used by
your directory.
