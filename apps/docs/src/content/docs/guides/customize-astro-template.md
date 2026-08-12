---
title: Customize the Astro template
description: How to add pages, swap design tokens, change the data layout, and override components — without forking the template.
---

The Astro template shipped by `grove init` is a starting point. This
guide is for site operators who need to change the look, the
structure, or the data layout of their directory.

Most customizations fall into three buckets:

1. **Configuration** — change `grove.config.ts` to swap themes,
   facets, or integration modes.
2. **Content** — add a new page, add a body to a record, or change
   a copy block.
3. **Components** — override a header, footer, hero, or item card
   with your own.

Each is a different kind of edit, with a different blast radius.
Start with config; only move to components if config can't do it.

## 1. Configuration: `grove.config.ts`

The single file at the repo root. The schema is `groveConfigSchema`
in `packages/core/src/schema.ts`. The fields you will change most
often:

```ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "My Directory",
    tagline: "A focused list of tools we trust.",
    url: "https://mydir.dev",
    repoUrl: "https://github.com/me/mydir",
  },
  nav: [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/projects" },
    { label: "About", href: "/about" },
    { label: "Submit", href: "/submit" },
  ],
  facets: ["category", "stack", "platform", "tags"],
  theme: {
    primaryColor: "#0ea5e9",   // any CSS color
    radius: "soft",            // "none" | "soft" | "round"
    density: "comfortable",    // "compact" | "comfortable" | "spacious"
    containerWidth: "80rem",
  },
  integrations: {
    github: true,              // enables sync + cleanup workflows
  },
  paths: {
    recordsDir: "data/records",
    // ...defaults shown in reference/config
  },
});
```

`theme.primaryColor` is consumed by the Astro template's CSS
tokens. `theme.radius` is a small, medium, or large border-radius
scale. `theme.density` is the vertical rhythm — `compact` packs
more rows into the index, `spacious` gives cards more breathing
room.

After editing `grove.config.ts`, restart `pnpm dev` (the config is
read at boot, not hot-reloaded). For a production build, no restart
— `astro build` reads it at build time.

See the [grove.config.ts reference](/reference/config/) for the
full field list and defaults.

## 2. Content: pages, bodies, copy

The template ships with the V1 page set: `index.astro` (home),
`[slug]/index.astro` (blueprint-aware list — the same file renders
`/projects/`, `/resources/`, `/entities/`),
`[slug]/[recordSlug].astro` (blueprint-aware detail),
`about.astro`, `contributors.astro`, `submit.astro`, and `404.astro`.
The default `astro.config.mjs` produces a static `dist/` with one
HTML file per route.

### Adding a new page

Create a new file under `src/pages/`. Astro file-based routing
applies. A "Changelog" page, for example:

```astro
---
// src/pages/changelog.astro
import BaseLayout from "../layouts/BaseLayout.astro";
---
<BaseLayout title="Changelog">
  <h1>Changelog</h1>
  <p>This directory was last updated on 2025-10-12.</p>
</BaseLayout>
```

Then add a nav link:

```ts
// grove.config.ts
nav: [
  // ...
  { label: "Changelog", href: "/changelog" },
],
```

That's it. The page will be built and linked from the header.

### Adding a body to a record

Records can have a long-form markdown body. Add a `content` path to
the record's YAML:

```yaml
# data/records/astro.yml
content: ./bodies/astro.md
```

The path is relative to the template's `contentDir` (default
`content/records/`). Write the body in markdown — the detail page
renders it below the curated fields.

### Editing copy

Static copy in the template lives in the layout and page files
under `src/pages/` and `src/layouts/`. Edit them directly. They are
template files, not generated.

The `site.name` and `site.tagline` flow into the header and home
page automatically, so most operators don't need to touch the chrome
files.

## 3. Components: overriding the defaults

`@grove-dev/astro` ships **37 components** under
`packages/astro/src/components/`. Components are imported by path
(not through a barrel) so `astro check` validates them in their own
context. The full list, grouped by purpose:

**Chrome and home page**

- `Hero` — home page banner (trust stats, headline, search, CTAs).
- `WhyThisExists` — "What is this site for?" section (three short opinionated points).
- `MinimalAbout` — three-point about section, sibling of `WhyThisExists`.
- `FinalCta` — bottom-of-page "Know an app that belongs here?" CTA.
- `OriginalCollection` — legacy lineage card linking to the project's origin repo.
- `StackGrid` — browse-by-stack grid on the home page (cards with icons + status pills).
- `CategoryGrid` — browse-by-category grid on the home page.
- `ExploreByStack` — compact, count-only browse-by-stack row (pill links).
- `ExploreByCategory` — compact, count-only browse-by-category row (pill links).
- `ContributorsGrid` — avatar grid of contributors for the home page.
- `StackPlatformChips` — labelled Stack + Platform chip rows.

**Record detail**

- `RecordHeader` — compact project-identity header at the top of a record detail page.
- `RecordSection` — lens-style section wrapper for the home page (SectionHeader + 3-col grid).
- `RecordSidebar` — sticky right column on a record detail page (Activity / Freshness / Ecosystem / Source).
- `EditorialSummary` — curator's "Best for / Consider before using" card at the top of a record body.
- `CurationGrid` — 3-column grid of "Best for / Why listed / Caveats" notes.
- `LanguageBreakdown` — GitHub-Linguist-style code-composition bar + legend.
- `ScoreBars` — four-bar score visualization (activity / maturity / learning / contribution / docs).
- `MarkdownBody` — renders the pre-sanitized Markdown body inside `.grove-prose`.
- `TableOfContents` — collapsible on-page nav for a record's Markdown body.

**List and discovery**

- `ItemCard` — compact card for one record on the home page / 3-column grid.
- `ProjectCard` — three-column-grid card for one directory record (the v0.5.0 design).
- `IndexRow` — directory list row used by list / detail UIs.
- `Pagination` — pagination navigation with numeric pages + ellipsis.
- `RefinePanel` — multi-select facet dropdowns + Sort dropdown (server-render only).
- `SmartLensTabs` — curated single-select lens tabs (All / Hot / Mature / Production-like / Good to learn).
- `FilterGroupMenu` — multi-select facet dropdown trigger + popover wrapper.
- `FilterOptions` — facet options list (rendered inside `FilterGroupMenu`).
- `Icon` — brand icon registry (`/icons/{stacks,platforms,brands}/{name}.svg`).

**Collections and submission**

- `CollectionIndex` — grid of every collection defined in `data/collections/*.yml`.
- `CollectionPage` — single curated/generated collection detail page.
- `CollectionRow` — card-shaped row for one entry inside a collection.
- `CollectionTeaser` — homepage-friendly subset of `CollectionIndex` (defaults `limit: 3`).
- `SubmissionClient` — client-side submission form (GitHub repo lookup + validation).

**Curation admin and meta**

- `DecisionRow` — single row of the curation decision admin table.
- `DirectoryIndexClient` — client-side directory index (embeds JSON + script for search/lens interactions).
- `GroveDocumentHead` — `<head>` element with OG / Twitter / JSON-LD from the `PageDocument` model.

The published override surface (the `components:` block in
`grove.config.ts`) currently accepts **only five slots**. The schema
is `componentOverrideSchema` in `packages/core/src/schema.ts`:

| `components.*` field | Default target | Notes |
| --- | --- | --- |
| `Header` | `layouts/Header.astro` | sticky brand + nav + theme toggle |
| `Footer` | `layouts/Footer.astro` | 4-column grid footer + bottom bar |
| `Hero` | `components/Hero.astro` | home page banner |
| `ItemCard` | `components/ItemCard.astro` | record card on home / list views |
| `DetailHeader` | `components/RecordHeader.astro` | top of record detail page (note: schema key is `DetailHeader`, file is `RecordHeader.astro`) |

Anything else requires editing the consumer-owned file under
`apps/example/src/` (which `grove init` copies into your project) or
forking the package. The 32 non-overridable components are reachable
by importing from `@grove-dev/astro/components/<Name>.astro` in your
own consumer pages — the Astro integration wires these as Vite aliases.

Two ways to override the five slots:

### Option A: register an override in `grove.config.ts`

```ts
// grove.config.ts
import MyHeader from "./src/components/MyHeader.astro";
import MyItemCard from "./src/components/MyItemCard.astro";

export default defineConfig({
  // ...
  components: {
    Header: "./src/components/MyHeader.astro",
    ItemCard: "./src/components/MyItemCard.astro",
  },
});
```

The Astro adapter resolves the path at build time. The override is
local to your repo, so it survives `pnpm install`.

The override component must accept the same props as the original.
Check the original component for the prop list — the contract is not
formally versioned in v0.4.0.

### Option B: edit the consumer-owned file

Because `grove init` copies the canonical `apps/example/` site into
your project, the Astro pages, layouts, and styles in `src/` are
yours to edit. For a one-off tweak, editing the local file is
simpler than wiring a `components:` override.

## 4. Data layout: changing where records live

If you want to split records across multiple directories (e.g.,
`data/records/featured/` and `data/records/community/`), edit
`paths.recordsDir` — but note that the v0.4.0 reader expects a single
flat directory. Multi-dir records are a V2 feature; for now, if you
split the data, you'll need a custom step to merge them.

For most sites, the default `data/records/` is fine. Leave it alone
unless you have a strong reason.

## 5. Styling: changing the look

Three layers, in increasing order of effort:

1. **`grove.config.ts` `theme` block** — primary color, radius
   scale, density, container width. No code changes.
2. **`src/styles/global.css`** — design tokens and custom utilities.
   The scaffold ships a small set of `--grove-*` tokens; add your
   own.
3. **Tailwind** (opt-in) — if you want utility classes, install
   Tailwind per the Astro docs and import it from `global.css`.

## What you should *not* customize

- **The `health` block in record YAMLs.** It's auto-derived. See
  [Sync GitHub metadata](/guides/sync-github-metadata/).
- **The `github` block in record YAMLs.** Same — derived from the
  GitHub API.
- **`data/generated/records.index.json` and
  `data/generated/records.full.json`.** These are regenerated on
  every `grove check` run. Hand edits will be overwritten.
- **Anything in `node_modules/`.** It will be replaced on the next
  install.

If a customization feels like it requires editing these, write a
[decision](/guides/manage-decisions/) or open an issue — the schema
might be missing a field you actually need.

## Verifying your customizations

After any non-trivial change, run through this checklist:

1. `pnpm exec grove check` — schema check, generation, sitemap,
   llms, robots, og-image, and `astro check`.
2. `pnpm dev` — manual smoke test. Browse the home page, the
   index, a few detail pages.
3. `pnpm build` — full build.
4. Open `dist/` in a static server (`npx serve dist`) and check the
   production output.

If any of those fail, the error is usually in the same place you
last edited. The build doesn't mask issues; it surfaces them.