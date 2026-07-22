# Grove

Grove is a focused system for building curated open-source directories. It has one Astro application, one data model, and one small CLI.

```bash
pnpm dlx @grove-dev/cli init my-directory
cd my-directory
pnpm dev
```

The generated project is already a complete website. Its Astro pages are copied into the project and belong to the user; Grove supplies reusable domain logic, data adapters, components, generated data, sitemap, and `llms.txt`.

## Repository

```text
packages/
  core/       config, schemas, validation, directory logic, generation
  astro/      Astro UI, layouts, generated-data adapters, integration
  cli/        init, check, sync, cleanup
  starlight/  documentation integration
apps/
  example/    real AI directory demo and the only init scaffold source
  docs/       Starlight documentation site
```

There is no template registry and no framework selection. Internal development runs the real site through pnpm workspace links:

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
pnpm test:scaffold
```

## Directory structure

```text
.github/workflows/     five thin CI workflows
content/pages/         optional custom Markdown pages
data/records/          one YAML file per project
data/taxonomy/         categories, stacks, platforms, distribution
public/                icons and brand assets
src/pages/             all site-owned routes and page composition
src/styles/global.css  optional theme overrides
astro.config.mjs
grove.config.ts
package.json
```

`astro dev`, `astro check`, and `astro build` prepare the generated artifacts automatically through the Grove Astro integration. CI calls `grove check`, `grove sync github`, `grove sync contributors`, and `grove cleanup` directly.

## Packages

- `@grove-dev/core` is the framework-free engine.
- `@grove-dev/astro` is the composable Astro UI and data adapter.
- `@grove-dev/cli` owns project creation and maintenance operations.
- `@grove-dev/starlight` remains the docs integration.

MIT
