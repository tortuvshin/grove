---
title: Components
description: Replace any default Astro component by importing your own .astro file in your pages. The data engine stays untouched.
---

Grove pages are plain Astro pages in your project. The data engine (`prepareDirectory`, generated JSON, Zod schemas) is owned by `@grove-dev/core`. The UI is a set of `.astro` components shipped **inside** `@grove-dev/astro` — a scaffolded space doesn't copy them into `src/components/`; pages import them straight from the package, and you override one by swapping that import for a local file.

This split is deliberate: data and presentation evolve at different speeds.

## Where the components live

`@grove-dev/astro`'s `package.json` exports two subpaths that resolve straight to the shipped `.astro` source (not a compiled bundle):

```
"./components/*.astro": "./src/components/*.astro"
"./layouts/*.astro":    "./src/layouts/*.astro"
```

So `import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro";` resolves to the real source file, browsable after install at `node_modules/@grove-dev/astro/src/components/ProjectCard.astro`. The reference space (`apps/example/`) imports every page-level component this way — its own `src/components/` only holds page bodies it composes *from* those (`DirectoryBrowse.astro`, `TaxonomyList.astro`), not overrides of the package's defaults.

## Components (`packages/astro/src/components/`, 33 files)

| Component | Purpose |
|---|---|
| `ProjectCard` | The canonical record card — logo, name, owner/repo, description, stack/star/updated footer. Every listing surface renders through it. |
| `CardGrid` | The responsive three-column grid host for card children. |
| `IndexRow` / `CollectionRow` | Thin `ProjectCard` adapters for the browse page and collection pages respectively. |
| `CardIcon` | Small metadata glyphs (star, clock, curated check, arrow) shared by card components. |
| `RecordHeader` | Identity header at the top of a record detail page (avatar, pills, name, description, CTAs). |
| `RecordSidebar` | Sticky right-hand column on the record detail page. |
| `RecordSection` | Generic lens-style section wrapper used on the home page. |
| `EditorialSummary` | Card surfacing the curated summary at the top of a record body. |
| `MarkdownBody` | Renders a record's pre-sanitized Markdown body (`getContentHtml`). |
| `TableOfContents` | Collapsible on-page nav for a record's Markdown body. |
| `LanguageBreakdown` | GitHub-Linguist-style language composition bar + legend. |
| `StackPlatformChips` | Labelled Stack + Platform chip rows on the record page. |
| `Icon` | Brand/stack/platform icon registry — see [Icons](/customize/icons/). |
| `Hero` | The home page banner. |
| `WhyThisExists` | The 3-point "what is this site for?" section on the home page. |
| `StackGrid` / `CategoryGrid` | Browse-by-stack / browse-by-category grids on the home page. |
| `ContributorsGrid` | Avatar grid of GitHub contributors on the home page. |
| `OriginalCollection` | Legacy-lineage card linking to a project's origin/upstream. |
| `FinalCta` | Closing call-to-action section. |
| `CollectionIndex` / `CollectionTeaser` | Grid of every curated collection / a homepage-sized subset (`limit` defaults to 3). |
| `CollectionCard` | Card for one collection (kind, title, description, entry count). |
| `CollectionPage` | Renders a single collection from a `CollectionPageModel`. |
| `DirectoryIndexClient` | Client controller for the prerendered browse routes — re-derives filters, chips, and pagination from `location.search`. |
| `RefinePanel` / `FilterGroupMenu` / `FilterOptions` | The multi-select facet filter UI. |
| `Pagination` | Page nav for index pages. |
| `SmartLensTabs` | Curated single-select lens tabs (sort/curation presets). |
| `SubmissionClient` | The client-side submission form controller. |
| `PoweredBy` | The inlined "Powered by Grove" footer mark. |

`Header.astro`, `Footer.astro`, `BaseLayout.astro`, `Container.astro`, `Seo.astro`, and `ThemeToggle.astro` ship from `@grove-dev/astro/layouts/*.astro` (same override mechanism, different subpath) rather than `components/`.

## Override by replacement

In any page that imports a default component, swap the import for your own file:

```astro
---
// apps/example/src/pages/[slug]/[recordSlug].astro (example)

// Default:
// import RecordHeader from "@grove-dev/astro/components/RecordHeader.astro";

// Your override — same props, your markup:
import RecordHeader from "../../../components/RecordHeader.astro";
---

<RecordHeader detail={detail} />
```

`RecordHeader` takes a single `detail: RecordDetailModel` prop (produced by `getRecordDetailModel()`), not a raw record — check the component you're overriding for its actual prop shape before copying an example. `ProjectCard`, for instance, takes `record` (optional — adapters can pass explicit props instead) plus a required `href`:

```astro
---
import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro";
---

<ProjectCard record={r} href={`/${slug}/${r.slug}/`} />
```

The override component receives the same props; your version renders anything, and the page that imports it doesn't know or care that it's not the default.

## The data contract

Record and index types come from `@grove-dev/core`, not from a component-specific type:

```ts
import type { Resource, IndexRecord, ProjectRecord } from "@grove-dev/core";
```

- `Resource` — the full discriminated union (`project` | `resource` | `entity`) parsed from a record YAML file. `ProjectRecord` narrows it to `kind: "project"` — the only kind usable in V1. See the [record schema](/reference/record-schema/) for every field.
- `IndexRecord` — the slim projection served to list pages from `data/generated/records.index.json` (`packages/core/src/schema.ts`, `toIndexRecord`).

Page-model types (the shapes `RecordHeader`, `CollectionPage`, and friends actually consume) come from `@grove-dev/astro/server` instead — `RecordDetailModel`, `DirectoryIndexModel`, `CollectionPageModel`, `DirectorySiteConfig`, and so on, all produced by the matching `get*Model()` function in `packages/astro/src/server/models.ts` / `collections.ts`.

## What NOT to do

- Don't edit files inside `node_modules/@grove-dev/astro/`  — wiped on `pnpm install`. Copy the file into your own project first.
- Don't fork the data layer — add fields to the record schema, not a component.
- Don't replicate the whole template — start with the default, override only what you need.

## Related

- [Custom pages](/customize/pages/) — adding new pages
- [Record schema](/reference/record-schema/) — every field a record carries
- [Branding](/customize/branding/) — site identity without component edits
