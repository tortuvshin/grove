# `@grove-dev/core`

The headless publishing and maintenance engine behind Grove.

Core reads structured files, validates them, and generates every output a
Grove space publishes — website data, SEO artifacts, social cards, JSON
datasets, LLM-oriented text, and an awesome-list README block. It also owns
the maintenance side: GitHub metadata sync, health classification, curator
decisions, and cleanup reporting.

It has no UI, no routes, and no framework dependency.

[Documentation](https://withgrove.dev) ·
[API reference](https://withgrove.dev/reference/api-core/) ·
[Configuration](https://withgrove.dev/reference/config/) ·
[Changelog](https://github.com/tortuvshin/grove/blob/main/CHANGELOG.md)

## Role in the architecture

```text
data/*.yml ─┐
content/*.md ├─► @grove-dev/core ─► generated JSON, sitemap, robots,
grove.config ┘                       llms.txt, OG images, README block
                     ▲
                     │ consumed by
        @grove-dev/astro (rendering)  ·  @grove-dev/cli (operations)
```

`@grove-dev/astro` and `@grove-dev/cli` are both thin over Core. If you are
building a Grove site, you will normally use those. Reach for Core directly
when you are writing another renderer, a custom build script, an editor
integration, or tooling over the record schema.

## Install

```bash
pnpm add @grove-dev/core
```

**Requirements:** Node.js ≥ 22.12. ESM only.

**Status:** stable. The public surface is exactly what
`packages/core/src/index.ts` re-exports; anything reachable only through a
deep path is internal and may change in a patch.

## Configuration

`grove.config.ts` is the one place a space declares its identity, blueprint,
navigation, taxonomy, and integrations.

```ts
import { defineConfig } from '@grove-dev/core';

export default defineConfig({
  blueprint: 'project-directory',
  site: {
    name: 'My Space',
    tagline: 'Things worth keeping track of.',
    url: 'https://example.com',
  },
});
```

`defineConfig` is a typed identity function — it validates nothing at call
time. `loadConfig()` resolves and parses the file, applying schema defaults.

## The prepare pipeline

One call runs the whole build:

```ts
import { prepareDirectory } from '@grove-dev/core';

const result = await prepareDirectory();
console.log(result.generated.totalRecords);
```

`prepareDirectory()` chains `loadConfig` → `generate` → `buildSitemap` →
`buildLlmsFiles` → `buildSiteArtifacts`. The Astro integration calls it before
every `dev` and `build`, and `grove check` calls it after validation, so the
generated artifacts are never stale relative to the sources.

Use `generate()` on its own when you only want the record payloads and not
the public files.

## Records and blueprints

A blueprint binds a record `kind` to a schema, a default route, and the
filters a space exposes. Records are a discriminated union:

| Blueprint | `kind` | Schema | Default UI |
| --- | --- | --- | --- |
| `project-directory` | `project` | Stable | Stable |
| `resource-hub` | `resource` | Stable | Experimental — reuses the project templates |
| `ecosystem-map` | `entity` | Stable | Experimental — reuses the project templates |

One YAML file is one record, and the filename minus `.yml` is the canonical
slug. The schemas are exported for tooling: `projectRecordSchema`,
`resourceRecordSchema`, `entityRecordSchema`, `recordSchema`,
`collectionSchema`, `decisionSchema`, `healthFileSchema`, and friends.

## Generated artifacts

| Output | Written by |
| --- | --- |
| `data/generated/records.full.json`, `records.index.json`, `records.json` | `generate()` |
| `data/generated/site-config.json` | `generate()` |
| `public/sitemap.xml` | `buildSitemap()` / `buildSitemapXml()` |
| `public/robots.txt` | `buildRobotsTxt()` |
| `public/llms.txt`, `public/llms-full.txt` | `buildLlmsFiles()` |
| `public/og/*.png` | `buildOgImages()` |
| `data/generated/cleanup-report.json` | `cleanupStale()` |
| `data/generated/contributors.json`, `repo-stats.json` | `syncContributors()` |

`buildOgImages()` rasterizes each record, collection, and taxonomy page to a
1200×630 PNG through satori + resvg, keyed by a content hash so unchanged
pages skip the rasterizer on rebuild.

## Maintenance

Grove separates facts a machine can own from judgment a human must own.

```ts
import {
  fetchGithubMetadata,
  buildGithubSyncPatch,
  classifyHealth,
  pickCleanupCandidates,
} from '@grove-dev/core';
```

- **Sync** — `fetchGithubMetadata()` and `buildGithubSyncPatch()` refresh
  stars, license, language, and activity. The patch is a diff you review, not
  an in-place write.
- **Health** — `classifyHealth()` derives a status from last activity and
  archive state.
- **Decisions** — `data/decisions.yml` records a curator's visibility override
  and the reason for it, and always wins over a derived status.
- **Cleanup** — `pickCleanupCandidates()` and `cleanupStale()` produce a review
  queue rather than deleting anything.

## Importing and README generation

```ts
import { importAwesomeList, writeImportedRecords, buildAwesomeReadme } from '@grove-dev/core';
```

`importAwesomeList()` parses an awesome-list README into candidate records;
`writeImportedRecords()` writes them tagged `source: { type: "import" }` so an
imported entry is distinguishable from a curated one. `buildAwesomeReadme()`
renders records back out into the block between the
`<!-- grove-readme:start -->` / `<!-- grove-readme:end -->` sentinels, which is
how a Grove space keeps a GitHub README in sync with its site.

## SEO and `PageDocument`

Every page declares one `PageDocument`; the framework emits title,
description, canonical, Open Graph, Twitter, and JSON-LD from it.

```ts
import { definePageDocument, buildJsonLd, recordSchema } from '@grove-dev/core';
```

The JSON-LD registry exports `siteSchema`, `breadcrumbSchema`,
`collectionSchema`, `recordSchema`, and `contentSchema`. `validateJsonLd()` is
a dev-time check that logs malformed nodes; it never fails a production build.
Structured data is emitted as valid metadata — search engines decide
independently whether to render a rich result.

## Entry points

| Import | Environment | Contents |
| --- | --- | --- |
| `@grove-dev/core` | Node only | Everything: config loading, filesystem IO, validation, generation, sync, plus all the discovery helpers below. |
| `@grove-dev/core/directory` | Browser-safe | Filtering, sorting, facets, lenses, pagination, and display formatting — no config loader, no `node:fs`. |

The subpath exists so a client-side controller can apply exactly the same
filter and lens rules the server used, without pulling Node built-ins into the
browser bundle:

```ts
import { filterRecords, applySort, buildFacets, hrefForLens } from '@grove-dev/core/directory';
```

Note the sort helper is `applySort`, paired with `effectiveSort` and
`SORT_OPTIONS`. Pagination is `paginate` / `totalPages` / `effectivePage`.

## Audit contract

Core defines the page manifest that `grove audit` consumes, so the quality
gate is declared next to the site it describes rather than in CI config.

```ts
// grove.config.ts
import { defineConfig } from '@grove-dev/core';

export default defineConfig({
  audit: {
    baseUrl: 'http://127.0.0.1:4321',
    pages: [
      { path: '/', type: 'home', label: 'Home' },
      { path: '/projects', type: 'directory', label: 'Browse' },
      { path: '/404', type: '404', label: 'Not found' },
    ],
  },
});
```

Each entry declares one of seven `PageType` values (`home`, `directory`,
`collection`, `record`, `content`, `empty`, `404`). The default budget is
Lighthouse's own "good" thresholds — scores ≥ 0.9, LCP ≤ 2500 ms, CLS ≤ 0.25,
TBT ≤ 200 ms — exported as `DEFAULT_BUDGET` and applied by `evaluateBudget()`.
`404` pages are audited for completeness but exempt from the budget, because
Lighthouse cannot meaningfully score a 404 response.

Running the audit is the CLI's job — see the
[`@grove-dev/cli` audit workflow](https://withgrove.dev/reference/cli/).

## What Core does not contain

- No components, layouts, styles, or routes — those are `@grove-dev/astro`.
- No command-line interface — that is `@grove-dev/cli`.
- No runtime CMS, database, admin UI, or hosted service. Core reads files and
  writes files.

## Development

```bash
pnpm --filter @grove-dev/core check
pnpm --filter @grove-dev/core test
```

## Links

[Issues](https://github.com/tortuvshin/grove/issues) ·
[Contributing](https://github.com/tortuvshin/grove/blob/main/CONTRIBUTING.md) ·
[Security](https://github.com/tortuvshin/grove/blob/main/SECURITY.md)

## License

MIT
