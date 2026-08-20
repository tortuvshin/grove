---
title: Architecture
description: The Grove monorepo's package boundaries, and the single build pipeline that turns files in data/ into every generated output.
---

## The packages

Grove is a pnpm monorepo under `packages/` — `astro`, `cli`, `core`, `starlight` — publishing four packages to npm under the `@grove-dev/*` scope, currently all at the same version (`0.6.1`):

| Package | What it owns |
|---|---|
| `@grove-dev/core` | Headless engine: resource schema, config, importers, validators, taxonomy, sitemap, `llms.txt`, OG images, and the build pipeline. |
| `@grove-dev/astro` | Astro integration + UI: components, layouts, server view-models, and framework-agnostic `lib/` helpers (search, lenses, scores, repo-URL parsing, formatting, taxonomy counts). |
| `@grove-dev/cli` | The `grove` command — scaffolds a Grove-powered space and orchestrates `@grove-dev/core`. |
| `@grove-dev/starlight` | Grove's theme for Starlight — the package this docs site itself runs on. |

`@grove-dev/astro` and `@grove-dev/cli` both depend on `@grove-dev/core` (`workspace:*`) — every generated artifact ultimately flows out of the core package. `@grove-dev/starlight` has no dependency on `@grove-dev/core`; it's a standalone Starlight theme and does not touch the pipeline below.

## The single build pipeline

Everything a Grove space generates — the JSON records, the sitemap, `llms.txt`, the site config, and the OG images — comes from one function: `prepareDirectory()` in `packages/core/src/prepare.ts`. Its own doc comment states the intent directly:

> "This is the single application-facing pipeline used by the Astro integration and by CLI validation. A Grove-powered Astro project can therefore run `astro dev`, `astro check`, and `astro build` directly; it does not need consumer-owned prebuild scripts." — `packages/core/src/prepare.ts:106-112`

One call to `prepareDirectory(cwd)` (`packages/core/src/prepare.ts:114-273`) runs, in order:

1. **`loadConfig(root)`** — parses `grove.config.ts`, the single source of truth for blueprint, site metadata, paths, integrations, theme, and component overrides.
2. **`generate(root, config)`** — reads every `.yml` file under the records directory, applies `data/decisions.yml` overrides, and writes `data/generated/records.full.json` and `data/generated/site-config.json`.
3. Reads those two just-written files back into memory to feed the remaining stages.
4. **`loadCollections(root)`** — loads every `Collection` from `data/collections/*.yml`.
5. **`buildSitemap(...)`** — writes `public/sitemap.xml`, covering records, collections, and taxonomy pages.
6. **`buildLlmsFiles(...)`** — writes `public/llms.txt` and `public/llms-full.txt`.
7. **`buildSiteArtifacts(root, config, sitePayload.stats)`** — writes `robots.txt` and the fallback site-wide OG SVG.
8. **`buildOgImages(...)`** — rasterizes a 1200×630 PNG per record, collection, and taxonomy page via satori + resvg, skipping unchanged pages against a content-hash manifest (`data/generated/og-manifest.json`). This stage is deliberately non-fatal: per the comment at `prepare.ts:181-184`, "a wrong count in a caption is acceptable, a failed build is not."

The function returns `{ generated, sitemap, llms, siteArtifacts, ogImages }` — one result object each caller uses to report what it produced.

## The two entry points

`prepareDirectory()` has exactly two callers:

- **`@grove-dev/astro`'s `astro:config:setup` hook** (`packages/astro/src/index.ts:70-71`) — runs it once, before the rest of the Astro build, whenever the consumer project has a `grove.config.ts` at its root. This is why a Grove-powered Astro project's own `build` script can be nothing more than `astro build` — see `apps/example/package.json:13` — with no separate prebuild step; the integration hook does the data preparation as a side effect of `astro:config:setup`.
- **`grove check`** (`packages/cli/src/index.ts:63-85`) — first runs `validateProject()` (schema, link, and config validation) and, only if that passes, calls `prepareDirectory()` and then `astro check`. This is the only place `astro check` and Grove's own validation run together; it's a separate, explicit step from `astro build`, and only Grove's own CI (the `build` job in `ci.yml`) invokes it as part of a normal run.

There is no third path. Other CLI commands either call `prepareDirectory()` themselves where they need generated data (`grove sync contributors`) or work directly against `data/records/*.yml` without it (`grove sync github`, `grove import`).

`grove init` scaffolds a new space from `scaffoldSource()` (`packages/cli/src/init.ts:40-42`), which prefers the packaged `dist/site` copy and falls back to `apps/example` in this repo — both carry the same six GitHub Actions workflows a scaffolded space ships with.

## Related

- [Generated outputs](/outputs/generated-data/)
- [Static deployment](/concepts/static-deployment/)
