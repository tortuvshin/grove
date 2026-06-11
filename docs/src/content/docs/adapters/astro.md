---
title: Astro
description: The V1-supported framework adapter. What the default template ships with, and how to customize it.
---

The **Astro** adapter (`@grove-dev/astro`) is the only V1-supported
framework for Grove-powered spaces. The default template ships a
fully working directory site that renders `project-directory`
records out of the box.

## Status

**V1 supported.** The default template is the reference
implementation. The Open Apps showcase uses it.

## What the default template ships

When you run `pnpm dlx @grove-dev/cli@latest new my-space --framework astro`,
the template generates:

- **Astro 6.4+ site** with `@grove-dev/astro` integration wired up.
- **Tailwind 4** for styling, with design tokens centralized in
  `src/styles.css`.
- **Home page** with hero, "Hot/New/Mature" lens sections, stack
  grid, category grid, and contributors grid.
- **`/projects/` index** with category/stack/tag refinement facets
  and pagination.
- **`/projects/[slug]` detail pages** for every record.
- **About and submit pages** as Markdown files under `content/pages/`.
- **`llms.txt` and `llms-full.txt`** generated at build time
  (via `grove llms`).
- **`sitemap.xml`** generated at build time (via `grove sitemap`).
- **20 Astro components** under `src/components/` (Hero, ItemCard,
  ScoreBars, ExploreByCategory, ExploreByStack, etc.).
- **9 layouts** under `src/layouts/` (BaseLayout, Container, Footer,
  Header, Seo, etc.).

## When to use this

Use the Astro adapter when:

- You want a **fully static** site that deploys to any CDN.
- The data is read-mostly (no server-side logic needed at request time).
- You value **fast page loads** and small JS bundles.
- You want Grove's full design-token theming (primary color, radius,
  density) out of the box.

For server components, edge runtime, or React, see the [Next.js
adapter](/adapters/nextjs/) (roadmap only) or the [SvelteKit
adapter](/adapters/svelte/) (roadmap only).

## Customization

The Astro template is meant to be edited. Common customizations:

**Override a component.** Add a `components:` block to
`grove.config.ts`:

```ts
export default defineConfig({
  // ...
  components: {
    ItemCard: "./src/components/MyItemCard.astro",
  },
});
```

The custom path replaces the default `@grove-dev/astro` component.

**Change the theme.** Edit `theme` in `grove.config.ts`:

```ts
export default defineConfig({
  // ...
  theme: {
    primaryColor: "#7c3aed",
    radius: "round",
    density: "compact",
  },
});
```

The Astro template reads these and applies them to the design
tokens in `src/styles.css`.

**Add a page.** Drop a Markdown file in `content/pages/` (e.g.
`content/pages/methodology.md`) and link to it from `nav` in
`grove.config.ts`. Astro picks it up automatically.

**Add a custom facet.** Add a record field to your `facets:` list:

```ts
export default defineConfig({
  // ...
  facets: ["category", "stacks", "platforms", "tags", "license"],
});
```

The renderer exposes refinement controls for every listed facet
on the `/projects/` index.

## Build pipeline

The template's `pnpm build` script chains the full pipeline:

```
pnpm run build:data       # grove generate
pnpm run build:sitemap    # grove sitemap
pnpm run build:llms       # grove llms
astro build               # Astro static build
```

Every step is a separate command. You can run them in isolation
while developing:

```bash
grove generate            # rebuild data/generated/records.{full,index}.json
pnpm dev                  # Astro dev server (auto-runs grove generate)
grove sitemap             # regenerate public/sitemap.xml
grove llms                # regenerate public/llms.txt + llms-full.txt
```

## Project layout (the generated tree)

```
my-space/
├── astro.config.mjs           # uses @grove-dev/astro integration
├── grove.config.ts            # your site config
├── package.json
├── tsconfig.json
├── tailwind.config.mjs
├── public/                    # logo, OG image, llms.txt, robots.txt
│   ├── llms.txt
│   ├── llms-full.txt
│   ├── robots.txt
│   └── og-image.svg
├── content/
│   ├── pages/                 # about.md, methodology.md
│   └── records/               # optional Markdown body per record
├── data/
│   ├── records/               # your records go here
│   ├── decisions.yml          # curator decisions
│   └── generated/             # auto-generated JSON (gitignored)
└── src/
    ├── pages/
    │   ├── index.astro
    │   ├── about.astro
    │   ├── submit.astro
    │   ├── projects/
    │   │   ├── index.astro
    │   │   └── [slug].astro
    │   └── sitemap.xml.ts
    ├── components/            # Hero, ItemCard, ScoreBars, etc.
    ├── layouts/               # BaseLayout, Container, etc.
    ├── lib/                   # search, format, taxonomy counts
    ├── data/records.ts        # typed loader for records.full.json
    ├── lib/markdown.ts
    └── styles/global.css
```

## Related docs

- **[Next.js adapter](/adapters/nextjs/)** — roadmap only.
- **[SvelteKit adapter](/adapters/svelte/)** — roadmap only.
- **[Create a space](/getting-started/create-a-space/)** — scaffold
  a new space with the Astro adapter.
