# `@grove-dev/astro`

The Astro renderer for Grove — an integration, a component library, and the
server view-models that turn generated data into page props.

It is composition primitives, not a locked theme. Every route lives in your
`src/pages`, and the integration never injects one.

[Documentation](https://withgrove.dev) ·
[Component reference](https://withgrove.dev/reference/components/) ·
[Customization](https://withgrove.dev/customize/components/) ·
[Changelog](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)

## What this package provides

| It gives you | It does not give you |
| --- | --- |
| An integration that prepares generated data before `dev` and `build` | Routes — you own every file in `src/pages` |
| 36 components, 7 layouts, 6 UI primitives | A fixed page composition |
| Server view-models that assemble page props | Business logic — filtering, scoring, and lenses live in `@grove-dev/core` |
| Design tokens and a stylesheet | Your brand — override tokens in `src/styles/global.css` |
| SEO wiring from a single `PageDocument` | Content — that stays in `data/` and `content/` |

## Install

```bash
pnpm add @grove-dev/astro @grove-dev/core
```

**Requirements:** Node.js ≥ 22.12, Astro 6 or 7 (`astro@^6.0.0 || ^7.0.0`).

**Status:** stable. Astro is Grove's only supported renderer.

## Setup

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import grove from '@grove-dev/astro';

export default defineConfig({ integrations: [grove()] });
```

The integration is a no-op unless `grove.config.ts` exists at the project
root. When it does, on every `dev` and `build` it:

1. runs `prepareDirectory()` from `@grove-dev/core`, regenerating
   `data/generated/*.json` plus the sitemap, robots, `llms.txt`, and OG images;
2. aliases `@grove/generated` to your `data/generated/` directory;
3. aliases the `@grove-dev/astro/components` and `.../layouts` subpaths to the
   package's source `.astro` files;
4. copies the packaged icon set into `public/icons/`, leaving any icon you
   edited in place and reporting it;
5. loads your `src/styles/global.css` if present, so theme overrides apply.

Those five things are its entire footprint. **It adds no routes.**

You will also need a `grove.config.ts` and a `data/` directory — see
[Create a space](https://withgrove.dev/getting-started/create-a-space/).

## Generated data

After setup, the generated artifacts are importable by alias:

```ts
import records from '@grove/generated/records.json';
import siteConfig from '@grove/generated/site-config.json';
```

These are build-time JSON imports, not runtime fetches. `records.index.json`
is the slim projection for list pages; `records.full.json` (aliased as
`records.json`) carries every field.

## A minimal list page

```astro
---
import BaseLayout from '@grove-dev/astro/layouts/BaseLayout.astro';
import ProjectCard from '@grove-dev/astro/components/ProjectCard.astro';
import CardGrid from '@grove-dev/astro/components/CardGrid.astro';
import { getDirectoryIndexModel } from '@grove-dev/astro/server';
import siteConfig from '@grove/generated/site-config.json';

// The first argument is the request's search params — the same filter,
// sort, and lens rules apply whether they came from a URL or are empty.
const model = getDirectoryIndexModel(new URLSearchParams(), siteConfig);
---

<BaseLayout title={model.seo.title} description={model.seo.description}>
  <CardGrid>
    {model.items.map((record) => <ProjectCard record={record} />)}
  </CardGrid>
</BaseLayout>
```

## A minimal record detail page

```astro
---
import BaseLayout from '@grove-dev/astro/layouts/BaseLayout.astro';
import RecordHeader from '@grove-dev/astro/components/RecordHeader.astro';
import MarkdownBody from '@grove-dev/astro/components/MarkdownBody.astro';
import { getRecordDetailModel, recordDetailPaths } from '@grove-dev/astro/server';
import siteConfig from '@grove/generated/site-config.json';

export function getStaticPaths() {
  return recordDetailPaths(siteConfig);
}

const detail = getRecordDetailModel(
  Astro.params.recordSlug ?? '',
  siteConfig,
  Astro.params.slug ?? '',
);
if (!detail) return Astro.redirect('/');
const { record, seo } = detail;
---

<BaseLayout title={seo.title} description={seo.description} image={seo.image}>
  <RecordHeader record={record} />
  <MarkdownBody html={detail.contentHtml} />
</BaseLayout>
```

## Server view-models

`@grove-dev/astro/server` exists so a page is composition, not computation.
Each function takes the site config and returns everything one page needs —
items, labels, taxonomy counts, breadcrumbs, and a complete `seo` block:

| Function | Page |
| --- | --- |
| `getHomePageModel` | Home |
| `getDirectoryIndexModel` | Browse / list, including pagination |
| `getRecordDetailModel`, `recordDetailPaths` | Record detail |
| `getCollectionIndexModel`, `getCollectionPageModel`, `getCollectionTeaserModel` | Collections |
| `getTaxonomyIndexModel`, `getTaxonomyPageModel`, `countTaxonomies` | Category / stack / license views |
| `getContributorsPageModel`, `loadDirectoryContributors` | Contributors |
| `getSubmissionPageModel` | Submit |

Also exported: content helpers (`getContentHtml`, `getPageContentHtml`,
`renderMarkdownToSafeHtml`), record lookups (`recordBySlug`, `findRecord`,
`projects`, `resources`, `entities`), and the SEO helpers (`seoTitle`,
`seoDescription`, `recordSeoDescriptor`, `ogPath`, `absoluteUrl`,
`breadcrumbs`).

Keeping this in a plain module rather than inside components means the same
logic is unit-testable and reusable from a different renderer.

## Components

Imported by subpath, so you only pay for what you use:

```astro
import ProjectCard from '@grove-dev/astro/components/ProjectCard.astro';
import Button from '@grove-dev/astro/ui/Button.astro';
import BaseLayout from '@grove-dev/astro/layouts/BaseLayout.astro';
```

| Category | Components |
| --- | --- |
| **Layout / shell** | `BaseLayout`, `Container`, `Header`, `Footer`, `SectionHeader`, `Seo`, `ThemeToggle` |
| **Browse / search** | `DirectoryIndexClient`, `RefinePanel`, `FilterGroupMenu`, `FilterOptions`, `SmartLensTabs`, `Pagination`, `IndexRow`, `CardGrid` |
| **Record detail** | `RecordHeader`, `RecordSection`, `RecordSidebar`, `EditorialSummary`, `EditorialVerdict`, `EvidenceLedger`, `AlternativesTable`, `MarkdownBody`, `TableOfContents`, `LanguageBreakdown`, `StackPlatformChips` |
| **Editorial evidence** | `EditorialVerdict`, `EvidenceLedger`, `AlternativesTable` — the review tier behind a record, the cited sources for its claims, and what to consider instead |
| **Cards** | `ProjectCard`, `CardIcon`, `Icon` |
| **Collections / taxonomy** | `CollectionCard`, `CollectionIndex`, `CollectionPage`, `CollectionRow`, `CollectionTeaser`, `OriginalCollection`, `CategoryGrid`, `StackGrid` |
| **Community** | `ContributorsGrid`, `SubmissionClient` |
| **Marketing** | `Hero`, `FinalCta`, `WhyThisExists`, `PoweredBy` |
| **UI primitives** (`/ui/`) | `Badge`, `Button`, `EmptyState`, `FilterDrawer`, `PageHeader`, `SearchField` |

The [component reference](https://withgrove.dev/reference/components/)
documents props. `tests/integration/readme-truth.test.ts` asserts this table
against the package's real export surface, so it cannot drift.

## Styling

`@grove-dev/astro/styles.css` carries the design tokens and base styles, and
`BaseLayout` imports it. Override tokens in your own
`src/styles/global.css` — the integration loads it automatically, after the
package styles, so your values win:

```css
:root {
  --grove-brand: #27b7c8;
}
```

Light and dark are both supported; `ThemeToggle` switches between them and
persists the choice. See
[Theme](https://withgrove.dev/customize/theme/).

## SEO

Every view-model returns a `seo` block that `BaseLayout` consumes directly, so
title, description, canonical, Open Graph, Twitter, and JSON-LD all derive from
one declaration rather than from layout props that drift apart. Layouts still
accept the older `title` / `description` / `image` / `jsonLd` props for
compatibility. See [SEO & social](https://withgrove.dev/outputs/seo/).

## Route ownership

This is the package's central contract, and it is deliberate:

- `grove init` **copies** home, browse, record detail, collection, taxonomy,
  contributors, submit, about, empty, and 404 routes into your `src/pages`.
- No Grove command rewrites them afterwards. Reorder, replace, delete, or
  extend them freely.
- You can adopt this package **without** `grove init` — add the integration, a
  `grove.config.ts`, and write your own routes against the view-models above.
- Framework-independent logic (filtering, sorting, facets, lenses, scoring,
  formatting, taxonomy) lives in `@grove-dev/core`, not here, so a future
  renderer inherits it unchanged.

## Build output

Static. `astro build` prerenders every route, including paginated browse pages
(`/{slug}/page/2/`), and writes the SEO and LLM-oriented artifacts alongside.
No adapter, server runtime, or database is required.

## Exports

| Specifier | Contents |
| --- | --- |
| `@grove-dev/astro` | The integration (default) plus re-exported `@grove-dev/core` types and `lib/` helpers |
| `@grove-dev/astro/server` | Page view-models, content, and SEO helpers |
| `@grove-dev/astro/components/*.astro` | Components |
| `@grove-dev/astro/layouts/*.astro` | Layouts |
| `@grove-dev/astro/ui/*.astro` | UI primitives |
| `@grove-dev/astro/styles.css` | Tokens and base styles |

## Development

```bash
pnpm --filter @grove-dev/astro check
pnpm --dir apps/example build
```

## Links

[Issues](https://github.com/tortuvshin/grove/issues) ·
[Migration guide](https://withgrove.dev/reference/migration/) ·
[Contributing](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md) ·
[Security](https://github.com/tortuvshin/grove/blob/main/SECURITY.md)

## License

MIT
