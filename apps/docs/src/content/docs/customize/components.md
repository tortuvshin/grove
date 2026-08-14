---
title: Components
description: Replace any default Astro component by importing your own .astro file in your pages. The data engine stays untouched.
---

Grove pages are plain Astro pages in your project. The data engine (`prepareDirectory`, generated JSON, Zod schemas) is owned by `@grove-dev/core`. The components that render the data are owned by **your project**. Replacing a component is a normal Astro import swap — no config required, the data layer is untouched underneath.

This split is deliberate: data and presentation evolve at different speeds.

## Default components

The scaffold ships these under `src/components/`:

| Component | Purpose |
|---|---|
| `Header.astro` | Top navigation, logo, search |
| `Footer.astro` | Footer columns, copyright, license |
| `RecordCard.astro` | Record card on index pages |
| `RecordGrid.astro` | Responsive grid wrapper |
| `RecordDetail.astro` | Full record detail layout |
| `Tag.astro` | Inline tag chip |
| `StackIcon.astro` | Stack-icon-with-fallback |
| `FacetSidebar.astro` | Browse-page facet filter |
| `Pagination.astro` | Page nav for index pages |
| `SearchBox.astro` | Client-side fuzzy search |

Full list with props is in [Astro components](/reference/components/).

## Override by replacement

In any page that imports a default component, swap the import:

```astro
---
// src/pages/projects/[slug]/index.astro

// Default:
// import RecordDetail from "@grove-dev/astro/components/RecordDetail.astro";

// Your override:
import RecordDetail from "../../../components/RecordDetail.astro";
---

<RecordDetail record={record} />
```

The override component receives the same `record` prop. Your version renders anything; the page doesn't know or care that it's not the default.

## The data contract

The override component receives data shaped by `@grove-dev/core`. TypeScript types are exported:

```ts
import type { Record, IndexRecord, SiteConfig } from "@grove-dev/astro/server";
```

A `Record` has all the fields of the [record schema](/reference/record-schema/). An `IndexRecord` is the slim projection for list pages (description, category, tags, stacks, score, visibility, logoUrl, slug, name).

The schema is stable within a `@grove-dev/astro` major version; your override keeps compiling.

## What NOT to do

- Don't edit files inside `node_modules/@grove-dev/astro/components/` — wiped on `pnpm install`.
- Don't fork the data layer — add fields to the record schema, not a component.
- Don't replicate the whole template — start with the default, override only what you need.

## Related

- [Astro components reference](/reference/components/) — props, slots, defaults
- [Custom pages](/customize/pages/) — adding new pages
- [Branding](/customize/branding/) — site identity without component edits