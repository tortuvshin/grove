---
title: Architecture
description: The Grove monorepo's package boundaries, and the single build pipeline that turns files in data/ into every generated output.
---

## The packages

Grove is a pnpm monorepo under `packages/` — `astro`, `cli`, `core`, `registry`, `starlight`. Four of those publish to npm under the `@grove-dev/*` scope; `registry` does not, because nothing installs it (see below):

| Package | What it owns |
|---|---|
| `@grove-dev/core` | Headless engine: resource schema, config, importers, validators, taxonomy, search, ranking, sitemap, `llms.txt`, OG images, and the build pipeline. Pure TypeScript — no Astro, no HTML, no DOM assumptions. |
| `@grove-dev/astro` | Astro integration + server view-models. **No `.astro` files in this package** — UI source ships through the registry. |
| `packages/registry` (private) | Canonical UI source. `shadcn build` turns it into the registry items (`@grove/default` and the feature blocks) that `grove init` installs and `grove update` reconciles. Not published: the shadcn CLI fetches items over HTTP from `withgrove.dev/r/`, and the CLI carries its own copy in `dist/r/` for offline `init`. |
| `@grove-dev/cli` | The `grove` command — `init`, `update`, `check`, `sync`, `cleanup`, `audit`, `collection promote`, `readme generate`. |
| `@grove-dev/starlight` | Grove's theme for Starlight — the package this docs site itself runs on. |

`@grove-dev/astro` and `@grove-dev/cli` depend on `@grove-dev/core`. The registry is versioned independently per §21 of the v1 spec — engine and UI releases are independent lifecycles — and `@grove-dev/cli` depends on it only as a **dev** dependency, for build ordering and to copy the built items into its own `dist/`. A runtime dependency would be unpublishable: `pnpm publish` rewrites `workspace:*` to a concrete version, and a private package has no version on npm to point at. `scripts/check-publishable.mjs` enforces this. `@grove-dev/starlight` is standalone.

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

`grove init` is a registry bootstrapper — it installs `@grove/default` into the consumer's `src/`, pins `@grove-dev/{core,astro,cli}` as dependencies, writes `grove.config.ts`, and emits `.grove/registry.lock.json` with the install-time hashes. Update reconciliation lives in `grove update`.

## Related

- [Generated outputs](/outputs/generated-data/)
- [Static deployment](/concepts/static-deployment/)
