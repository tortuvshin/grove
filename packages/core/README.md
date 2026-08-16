# `@grove-dev/core`

The framework-free engine for Grove. It owns configuration, schemas,
validation, the data build pipeline, and every maintenance routine
Grove uses to keep generated outputs in sync with file-backed sources.

Use it when you need to:

- load and validate a `grove.config.ts`
- generate normalized JSON datasets, `sitemap.xml`, `robots.txt`,
  `llms.txt`, `llms-full.txt`, and Open Graph images
- refresh GitHub repository and community metadata
- classify record health and write the human-review cleanup report
- build a custom integration on top of the same pipeline Astro uses

Application-facing code should normally use `@grove-dev/astro`. Direct
imports from Core are useful for config, tooling, and custom
integrations.

## Install

```bash
pnpm add @grove-dev/core
```

Requires Node.js `>=22.12.0`.

## Entry points

| Import | Purpose |
| --- | --- |
| `@grove-dev/core` | Full engine. Config, build pipeline, schemas, generators, maintenance routines. Server and Node only. |
| `@grove-dev/core/directory` | Browser-safe subpath. Filtering, sorting, facets, display labels, and lens URL helpers without config or filesystem dependencies. |

```ts
import { defineConfig, prepareDirectory } from "@grove-dev/core";
import { filterRecords, hrefForLens } from "@grove-dev/core/directory";
```

## What Core owns

- **Configuration.** `defineConfig`, `loadConfig`, and `GroveConfig` types.
- **Schemas.** Resource, entity, taxonomy, decision, override, and health
  records validated with Zod.
- **Generation.** The unified `prepareDirectory()` pipeline plus
  `buildSitemap`, `buildLlmsTxt` / `buildLlmsFullTxt`,
  `buildSiteArtifacts`, and `buildOgImages`.
- **Validation.** `validateProject` runs against the loaded config and
  reports issues with severity and code.
- **Maintenance.** `syncContributors`, GitHub metadata refresh
  (`fetchGithubMetadata`, `buildGithubSyncPatch`), and
  `cleanupStale` / `pickCleanupCandidates`.
- **Browser helpers.** Re-exports from `./directory-*` modules:
  filtering, sorting, scoring, formatting, facets, lenses, taxonomy,
  and lens-aware search.

## Typical usage

```ts
import {
  defineConfig,
  loadConfig,
  prepareDirectory,
  validateProject,
} from "@grove-dev/core";

// Define and load configuration
export default defineConfig({
  site: { /* ... */ },
  sources: { /* ... */ },
  facets: { /* ... */ },
});

const config = await loadConfig();

// Validate sources before generating
const result = await validateProject(config);
if (!result.ok) {
  for (const issue of result.issues) {
    console.error(`[${issue.severity}] ${issue.code}: ${issue.message}`);
  }
}

// Run the unified generation pipeline
const prepared = await prepareDirectory();
```

`prepareDirectory()` is the same routine Astro runs before
`astro dev`, `astro check`, and `astro build`. Calling it directly is
the right choice for custom tooling, CI checks, or non-Astro hosts.

## Audit contract

Core defines the page-manifest contract that `grove audit` consumes.
An `audit` block in `grove.config.ts` lists the pages the CLI will run
Lighthouse against.

### Page types

Every entry in `audit.pages[]` must declare one of seven `PageType`
values:

| Type | Meaning |
| --- | --- |
| `home` | The site's landing page. |
| `directory` | The searchable, filterable index of records. |
| `collection` | A taxonomy or facet landing page. |
| `record` | An individual record detail page. |
| `content` | A long-form content page (about, blog post, etc.). |
| `empty` | A page that intentionally renders an empty state. |
| `404` | The not-found page. Audited for completeness but exempt from the budget because Lighthouse cannot measure 404 responses. |

### `PageManifestEntry` shape

```ts
interface PageManifestEntry {
  path: string;            // e.g. "/", "/directory", "/about"
  type: PageType;          // one of the seven values above
  label: string;           // human-readable label used in audit output
  sample?: Record<string, string>; // optional path/query overrides
}
```

### Default budget

The audit enforces Lighthouse "good" thresholds — Google's standard
quality gate — across every score category and metric:

- **Score categories** (`performance`, `accessibility`,
  `best-practices`, `seo`) ≥ 0.9
- **LCP** ≤ 2500 ms
- **CLS** ≤ 0.25
- **TBT** ≤ 200 ms

The default is 3 runs per page and profile (mobile + desktop)
aggregated by median. `grove audit` returns a non-zero exit code on
any violation, making it a drop-in CI check. Run with `--runs N`
(clamped to `[1, 5]`) to tune the variance/noise trade-off.

### Minimal example

```ts
// grove.config.ts
import { defineConfig } from "@grove-dev/core";

export default defineConfig({
  audit: {
    baseUrl: "http://127.0.0.1:4321",
    pages: [
      { path: "/", type: "home", label: "Home" },
      { path: "/directory", type: "directory", label: "Directory" },
      { path: "/records/awesome", type: "record", label: "Record" },
      { path: "/404", type: "404", label: "Not found" },
    ],
  },
});
```

## Develop Core

```bash
pnpm --filter @grove-dev/core check
pnpm --filter @grove-dev/core test
```

## License

[MIT](../../LICENSE) © Grove contributors.