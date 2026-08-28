---
title: Components
description: Grove's UI ships from a registry scaffold installed into your src/. You own the files. grove update reconciles upstream changes without overwriting local edits.
---

Grove pages are plain Astro pages in your project. The data engine (`prepareDirectory`, generated JSON, Zod schemas) is owned by `@grove-dev/core`. The UI ships from a **registry scaffold** that `grove init` installed into your `src/`. There is no `@grove-dev/astro/components/X.astro` import path in v1 — every component lives in your repo, and `grove update` keeps it in sync with upstream changes without overwriting what you edited.

This split is deliberate: data and presentation evolve at different speeds, and consumers should be able to fork the UI freely without touching engine packages.

## Where the components live

After `grove init`, your `src/` has the same structure the registry ships:

```
src/
├── components/
│   ├── ui/         # primitives — Button, Badge, Input, Sheet, ThemeToggle
│   ├── grove/      # domain UI — ProjectCard, FilterBar, DirectoryIndexClient, …
│   └── site/       # site chrome — ThemeToggle
├── layouts/        # BaseLayout, Header, Footer, Container, Seo, SectionHeader
├── pages/          # Home, Browse, Record detail, Collections, About, Submit, 404
├── lib/            # UI-local helpers (classnames, icon-kinds, icon-registry)
└── styles/         # system.css + global.css
```

Pages import from local paths:

```astro
---
import ProjectCard from "../components/grove/project-card.astro";
import BaseLayout from "../layouts/base-layout.astro";
import { Button } from "../components/ui/button.astro";
---
```

If you change a file in `src/`, Grove does not touch it. The next `grove update` will tell you a new version is available but will not overwrite yours — see [grove update](/reference/cli/#grove-update).

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
| `stack-platform-chips.astro` | Labelled Stack + Platform pill rows. |
| `why-this-exists.astro` | Three-point "why" section with icons. |

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

```bash
grove update --diff   # see what changed
grove update          # apply upstream, but only to files you haven't edited
```

Files you have edited are flagged `locally modified` and never overwritten. To force them back to upstream, delete the local file and run `grove update` again — the registry will reinstall it.

## What if I add a component the registry doesn't ship?

Nothing. The registry tracks only what it ships. New files under `src/` are yours and stay yours forever.

## See also

- [Registry and consumer-owned source](/concepts/registry/) — mental model and `grove update` algorithm.
- [Theme](/customize/theme/) — overriding design tokens and the dark variant.
- [Pages](/customize/pages/) — how pages compose components and consume server view-models.
