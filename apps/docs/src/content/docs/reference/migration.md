---
title: Migration guide
description: Version upgrade guide — breaking changes between Grove releases and how to handle them.
---

This page tracks breaking changes between Grove releases and the migration steps required.

## Current release

The four published packages are at the same version (`@grove-dev/{core,astro,cli,starlight}`).
Refer to the live changelog at <https://github.com/tortuvshin/grove/releases> (or
[`CHANGELOG.md`](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md) in the repo) for
what's new in each release. The roadmap is at [Project > Roadmap](/project/roadmap/).

## Breaking changes

### 0.8.0 — `@grove-dev/astro` no longer exports UI

This is the largest breaking change Grove has shipped. `./components/*`,
`./ui/*` and `./layouts/*` are gone from the package, so every import of the
form below stops resolving:

```ts
import ProjectCard from "@grove-dev/astro/components/ProjectCard.astro"; // gone
import { buttonClass } from "@grove-dev/astro/ui/button";               // gone
import BaseLayout from "@grove-dev/astro/layouts/BaseLayout.astro";     // gone
```

The components did not disappear — they moved into a
[registry](/concepts/registry/) that installs their source into your project.
`@grove-dev/astro` still exports the integration, `./server` (the view-model
builders), and `./styles.css`; imports of those are unaffected, as are all
`@grove-dev/core` imports.

To migrate an existing site:

1. Bump `@grove-dev/{core,astro,cli}` to `0.8.0`.
2. Add a `components.json` pointing the `@grove` namespace at the registry,
   and give `tsconfig.json` an `"@/*": ["./src/*"]` path plus
   `"allowImportingTsExtensions": true` — the installed components import
   `../lib/classnames.ts` by full path.
3. Install the scaffold: `npx shadcn@4.19.0 add @grove/default`. Keep
   `"tsx": true` in `components.json`; with `false` the shadcn CLI runs its
   TypeScript→JavaScript transformer over every file and fails on the first
   `.astro` with a bare `Unexpected token`.
4. Rewrite the dead imports to the installed paths — `../components/grove/…`,
   `../components/ui/…`, `../layouts/…`.
5. Delete any component you had copied out of the package to customise; the
   registry's version is now in your `src/` and is yours to edit.

From then on, `grove update` brings upstream changes in without overwriting
anything you have edited.

If you had forked a component, the fork wins: `grove update` reports it as
locally modified and leaves it alone, every run, until you merge it yourself.

### Earlier releases

- **`Astro.site` is required.** `Seo.astro` (used by every scaffold page) throws a build error if
  `astro.config.mjs` doesn't set `site: 'https://your-domain'`, instead of silently falling back to
  a placeholder URL in canonical/OG/Twitter/JSON-LD output. This applies to Astro's own `site`
  config, not `grove.config.ts`.
- **`browse.facets` replaced the top-level `facets` key.** A top-level `facets` in `grove.config.ts`
  is now a hard parse-time failure with a pointed migration message. To migrate, move the value from
  `facets:` to `browse.facets:`.
- **`recordsFileSchema` parses a single record directly.** It used to accept either an array or
  `{ records: [...] }` and required a separate `unwrapRecords()` call to get plain records out. It's
  now `recordsFileSchema = resourceSchema`, so `resourceSchema.parse(raw)` maps one YAML file to one
  record directly. V1 is one YAML file per resource; multi-record files aren't supported.
- **`@astrojs/starlight >= 0.41.4` is required** by `@grove-dev/starlight`. That's the first
  Starlight version whose `docsSchema({ extend })` deep-merges instead of intersecting — needed so
  the plugin's `hero.actions[].variant` enum can widen Starlight's own enum instead of narrowing it.
  See [Frontmatter Extension](/reference/plugin-api/#frontmatter-extension).
- **`grove check` does not fail the build on warnings by default.** Only validation errors do.
  Pass `--strict` to also fail on warnings (there's no equivalent flag to make warnings *more*
  permissive — permissive is already the default).

## Active deprecations

- **`Icon`'s `mode` prop.** Theme variants are no longer file-based (icons resolve `currentColor` at
  render time), so `mode` is now a no-op — kept for one minor release so `mode="auto"` in existing
  code doesn't become a type error. Drop the prop; it has no effect.

## What this page does not promise

- **An automatic `grove migrate` command.** There isn't one. Schema-breaking changes are called out
  here and in the changelog; you apply them by hand.
- **Future releases.** Once a release ships, its breaking changes are appended here. Speculative
  changes do not appear.

## See also

- [Reference: configuration](/reference/config/) — every `grove.config.ts` field.
- [Reference: record schema](/reference/record-schema/) — every record kind and field.
- [Releases](https://github.com/tortuvshin/grove/releases) — the live changelog.
- [Project: roadmap](/project/roadmap/) — what's planned.
