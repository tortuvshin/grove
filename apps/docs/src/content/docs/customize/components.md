---
title: Components
description: Grove's UI ships as a shadcn registry installed into your src/. You own the files. grove update reconciles upstream changes without overwriting local edits.
---

Grove pages are plain Astro pages in your project. The data engine (`prepareDirectory`, generated JSON, Zod schemas) is owned by `@grove-dev/core`. The UI ships from the **`@grove` registry** — a [shadcn registry](https://ui.shadcn.com/docs/registry) of feature-level items — that `grove init` installed into your `src/`. There is no `@grove-dev/astro/components/X.astro` import path in v1 — every component lives in your repo, and `grove update` keeps it in sync with upstream changes without overwriting what you edited.

This split is deliberate: data and presentation evolve at different speeds, and consumers should be able to fork the UI freely without touching engine packages.

## Where the components live

After `grove init`, your `src/` has the full structure the registry ships — `components/`, `layouts/`, `lib/`, `styles/`, **and** `pages/`. Pages are registry-shipped like everything else: `grove init` gives you a fully routable site (home, browse, record detail, taxonomy, collections, submit, about, contributors, 404) with zero records in it, not just a component library you have to build pages around yourself.

`grove init` also writes a `components.json` at the project root that maps the `@grove` namespace to the hosted registry (`https://withgrove.dev/r/{name}.json`). That file is what lets the standard shadcn CLI add or restore individual items later; the files themselves are grouped into registry blocks, one per feature — see [Registry items](#registry-items) below.

```
src/
├── components/
│   ├── ui/         # primitives — button, badge, empty-state, filter-drawer, page-header, search-field
│   ├── grove/      # domain UI + page-level compositions — project-card, hero, directory-browse, taxonomy-list, …
│   └── site/       # site chrome — theme-toggle
├── layouts/        # base-layout, header, footer, container, seo, section-header
├── pages/          # home, browse, record detail, taxonomy, collections, submit, about, contributors, 404 — same update rules as everything else here
├── lib/            # UI-local helpers (classnames, icon-kinds, icon-registry)
└── styles/         # system.css
```

Pages import from local paths:

```astro
---
import ProjectCard from "../components/grove/project-card.astro";
import BaseLayout from "../layouts/base-layout.astro";
import Button from "../components/ui/button.astro";
---
```

If you change a file in `src/`, Grove does not touch it. The next `grove update` will tell you a new version is available but will not overwrite yours — see [grove update](/reference/cli/#grove-update).

## Registry items

The registry groups its files into 12 feature-level items plus `default`, which inlines all of them. Each item declares its files' targets under `src/` and depends on the other `@grove/*` items it imports from, so `npx shadcn@latest add @grove/<item>` pulls in everything the item needs.

| Item | What it ships |
|---|---|
| `@grove/ui` | UI primitives — `button`, `badge`, `empty-state`, `filter-drawer`, `page-header`, `search-field` — plus `lib/classnames.ts`, the class builders that keep server-rendered and client-rebuilt controls byte-identical. |
| `@grove/shell` | The document shell every page renders inside: `base-layout`, `header`, `footer`, `container`, `section-header`, `seo`, `theme-toggle`, `powered-by`, and `styles/system.css` (design tokens, light/dark theme, Tailwind theme). |
| `@grove/project-card` | The canonical record card every listing surface renders through — `project-card`, `card-grid`, `card-icon`, the brand-mark `icon` component, and `lib/icon-kinds.ts` + `lib/icon-registry.ts`. |
| `@grove/taxonomy` | Browse-by-category, -stack, and -license: `categories/`, `stacks/`, and `licenses/[name]` routes, the shared `taxonomy-list` body, and the `stack-grid` / `category-grid` the home page also renders. |
| `@grove/collections` | Curated and generated collections: `collections/` index and detail routes, `collection-index`, `collection-page`, `collection-card`, `collection-row`, and `collection-teaser`. |
| `@grove/home` | The landing route (`pages/index.astro`) with `hero`, `why-this-exists`, `pipeline-strip`, `record-section` (trending / new / established), `contributors-grid`, `original-collection`, and `final-cta`. |
| `@grove/browse` | The list/discovery page and its paginated routes (`[slug]/index`, `[slug]/page/[page]`, `[slug]/page/cards`, `[slug]/page/records.json.ts`) with `directory-browse`, `directory-index-client`, `refine-panel`, `filter-group-menu`, `filter-options`, `smart-lens-tabs`, `index-row`, and `pagination`. |
| `@grove/record` | The per-record route (`[slug]/[recordSlug]`) with `record-header`, `record-sidebar`, `editorial-summary`, `table-of-contents`, `markdown-body`, and `language-breakdown`. |
| `@grove/submit` | `pages/submit.astro` and `submission-client` — fetch a repository, validate against the taxonomy, draft a record YAML for a pull request. |
| `@grove/about` | `pages/about.astro` — the narrative about route, overridable from `content/pages/about.md`. |
| `@grove/contributors` | `pages/contributors.astro` — the full contributors route with per-user contribution counts. |
| `@grove/not-found` | `pages/404.astro` — the on-brand fallback with a search form pointing at the browse page. |
| `@grove/default` | Every file above, inlined, so the whole site installs in one step. This is what `grove init` installs and what `grove update` diffs against. |

The per-component tables below describe the same files, grouped by directory.

## Components (`packages/registry/default/components/grove/`)

Domain UI components rendered by Grove's pages. Each accepts a view-model-shaped prop and renders pure presentation — no taxonomy, ranking, or normalization logic lives in the component.

| Component | Purpose |
|---|---|
| `project-card.astro` | The canonical record card — logo, name, owner/repo, description, stack/star/updated footer. Every listing surface renders through it. |
| `card-grid.astro` | The responsive three-column grid host for card children. |
| `index-row.astro` / `collection-row.astro` | Thin `project-card` adapters for the browse page and collection pages respectively. |
| `card-icon.astro` | Small metadata glyphs (star, clock, curated check, arrow) shared by card components. |
| `record-header.astro` | Identity header at the top of a record detail page (avatar, pills, name, description, CTAs). |
| `record-sidebar.astro` | Sticky right-hand column on the record detail page. |
| `record-section.astro` | Generic lens-style section wrapper used on the home page. |
| `hero.astro` | Home banner with stats, search, quick filters, and CTAs. |
| `stack-grid.astro` | Browse-by-stack grid for the home page and `/stacks/`. |
| `category-grid.astro` | Browse-by-category grid for the home page and `/categories/`. |
| `contributors-grid.astro` | Avatar grid with optional contribution counts. |
| `original-collection.astro` | Legacy lineage card with stars/forks/contributors. |
| `collection-card.astro` / `collection-index.astro` / `collection-page.astro` / `collection-teaser.astro` | Collection surfaces. |
| `final-cta.astro` | End-of-page "Know an X that belongs here?" CTA. |
| `markdown-body.astro` | Renders pre-sanitized record body HTML. |
| `language-breakdown.astro` | Code-composition bar + legend for the record detail sidebar. |
| `editorial-summary.astro` | "Best for" + "Consider before using" cards on the record detail page. |
| `table-of-contents.astro` | Collapsible TOC with scroll-spy and smooth scroll. |
| `directory-index-client.astro` | Client controller for the browse page (filter, sort, paginate, chips). |
| `submission-client.astro` | Submit-form client (GitHub fetch + YAML preview). |
| `refine-panel.astro` | Multi-select facet dropdowns used by the browse page. |
| `filter-group-menu.astro` / `filter-options.astro` | Single facet dropdown + checkbox list. |
| `pagination.astro` | Previous/Next + windowed page list. |
| `powered-by.astro` | "Powered by Grove" inline SVG attribution. |
| `smart-lens-tabs.astro` | Horizontal curated lens tabs (server-rendered). |
| `why-this-exists.astro` | Three-point "why" section with icons. |
| `directory-browse.astro` | Browse-page body shared by the unfiltered and paginated routes — search/sort, facets, active-filter chips, results grid, pagination. |
| `taxonomy-list.astro` | Shared body for the three taxonomy pages (`stacks/[name]`, `categories/[name]`, `licenses/[name]`) — heading, count, card grid, empty state. |
| `pipeline-strip.astro` | Optional "how this site works" home-page section — source file → build → published outputs. Sample record is illustrative, not live data. |

## Primitives (`packages/registry/default/components/ui/`)

Stateless, presentation-only primitives. Use them in any consumer page or in your own components.

| Component | Purpose |
|---|---|
| `badge.astro` | Span-based status pill with six semantic variants. |
| `button.astro` | `<a>` or `<button>` with class via `buttonClass()`. |
| `empty-state.astro` | "Nothing here" block with optional recovery link. |
| `filter-drawer.astro` | Mobile filter surface built on `<dialog>`. |
| `page-header.astro` | Eyebrow + h1/h2 + description block. |
| `search-field.astro` | Search input with magnifier icon, clear button, `/` shortcut. |

## Site chrome (`packages/registry/default/components/site/`)

| Component | Purpose |
|---|---|
| `theme-toggle.astro` | Three-mode (light/dark/system) switcher button. |

## Layouts (`packages/registry/default/layouts/`)

| Layout | Purpose |
|---|---|
| `base-layout.astro` | Document shell — `<head>`, theme-init, Header/Footer, GA4. |
| `container.astro` | Width-constrained wrapper using `--grove-container`. |
| `header.astro` | Sticky brand + nav + submit + repo button + theme toggle. |
| `footer.astro` | Four-column grid + copyright bar. |
| `section-header.astro` | Eyebrow + heading + description block. |
| `seo.astro` | `<title>`, OG, Twitter, JSON-LD emission. |

## Overriding a component

Three patterns, in increasing order of how much you take on:

### 1. Edit the file directly (most common)

Open `src/components/grove/project-card.astro`, change whatever you want, save. The next `grove update` will report `! locally modified — preserved` and never overwrite.

### 2. Subclass it (preserve the upstream version)

If you want both your version and the upstream version side-by-side, copy the file to a new path (e.g. `src/components/grove/my-card.astro`), edit it, and update the page import.

### 3. Add a new component without touching the registry

Drop a new `.astro` file under `src/components/grove/` (or any other directory), then `import` it from a page. The registry has no opinion about what you add; `grove update` only reconciles the files it shipped.

## What if I want to go back to the upstream version?

Two tools, for two different jobs.

To reset one item to upstream — say, throw away your card edits — use the shadcn CLI with `--overwrite`. It rewrites every file that item ships (and its `@grove/*` dependencies), no questions asked:

```bash
npx shadcn@latest add @grove/project-card --overwrite
```

To bring the whole site up to date while keeping your edits, use `grove update`:

```bash
grove update --diff   # see what changed upstream
grove update          # apply upstream, but only to files you haven't edited
```

Files you have edited are flagged `locally modified` and never overwritten. Either way, run `grove update` afterwards so the lockfile reflects what's on disk.

## What if I add a component the registry doesn't ship?

Nothing. The registry tracks only what it ships. New files under `src/` are yours and stay yours forever.

## What if I only want part of the registry?

Every item is installable on its own. In a bare Astro project with a `components.json` like the one `grove init` writes and a tsconfig `@/*` path alias, `npx shadcn@latest add @grove/browse` installs the browse page and the `shell`, `project-card`, and `ui` items it depends on — no React, no `shadcn init`. `npx shadcn@latest view @grove/home` previews an item's files before installing.

## See also

- [Registry and consumer-owned source](/concepts/registry/) — mental model and `grove update` algorithm.
- [Theme](/customize/theme/) — overriding design tokens and the dark variant.
- [Pages](/customize/pages/) — how pages compose components and consume server view-models.
