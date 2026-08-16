# `@grove-dev/astro`

Astro integration, generated-data adapters, server view-model helpers,
and the composable UI used by Grove-powered sites.

The integration prepares generated data before Astro runs, aliases
the source directories of the package's components and layouts so
consumers can write
`import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro"`,
auto-loads the consumer's `src/styles/global.css` when it exists,
and re-exports the framework-agnostic helpers from `@grove-dev/core`.

It does **not** inject routes. Every route lives in the consumer's
`src/pages/`, where it can be reordered, replaced, or extended
without a Grove sync overwriting it.

## Install

```bash
pnpm add @grove-dev/astro
```

Requires Node.js `>=22.12.0` and Astro `^6.0.0 || ^7.0.0`.

## Enable the integration

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import grove from "@grove-dev/astro";

export default defineConfig({ integrations: [grove()] });
```

When `grove()` loads it:

1. Runs `prepareDirectory()` so `@grove/generated` is up to date
   before `astro dev`, `astro check`, or `astro build`.
2. Loads `grove.config.ts` and syncs the packaged icons into the
   consumer's `public/icons/`.
3. Aliases `@grove-dev/astro/components`, `@grove-dev/astro/layouts`,
   and `@grove/generated` to their on-disk locations.
4. Injects the consumer's `src/styles/global.css` when present, so
   brand tokens defined there take effect without manual imports.

## What this package ships

| Surface | Contents |
| --- | --- |
| `@grove-dev/astro` | The integration plus re-exports of `@grove-dev/core` and the generic `lib/` helpers (search, lenses, scores, repo, format, display, taxonomy counts). |
| `@grove-dev/astro/components` | Composable `.astro` components — `Hero`, `Card`, `Icon`, `FilterGroupMenu`, `SearchField`, `ThemeToggle`, `MarkdownBody`, and more. |
| `@grove-dev/astro/layouts` | Page-level layouts — `BaseLayout`, `Container`, `Header`, `Footer`, `SectionHeader`, `Seo`. |
| `@grove-dev/astro/server` | View-model helpers that take generated data and return the props a page expects. |
| `@grove-dev/astro/ui` | Small UI primitives — `Button`, `Badge`, `EmptyState`, `FilterDrawer`, `PageHeader`. |
| `@grove-dev/astro/styles.css` | The shared Grove stylesheet imported from the consumer's global layout. |

## Server view models

`@grove-dev/astro/server` builds the props each page needs from the
generated data, so route files stay small and pages remain
declarative.

```ts
// src/pages/index.astro
import { BaseLayout, Hero, Card } from "@grove-dev/astro";
import { buildHomeModel } from "@grove-dev/astro/server";

const model = await buildHomeModel();
---
<BaseLayout seo={model.seo}>
  <Hero {...model.hero} />
  <Card {...model.featuredCard} />
</BaseLayout>
```

## Routes stay in the consumer project

`grove init` copies a complete working set of home, list, record
detail, about, contributors, submit, 404, and legacy redirect pages
from the canonical `apps/example/` scaffold. The copy is the source
of truth for those routes — the integration never injects them.

To customize a page, edit the file in `src/pages/` directly. Grove
will not overwrite it on the next sync.

## Develop Astro

```bash
pnpm --filter @grove-dev/astro check
pnpm --dir apps/example build
```

## License

[MIT](../../LICENSE) © Grove contributors.