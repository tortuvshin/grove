---
title: Programmatic API
description: Programmatic access to @grove-dev/core — config loading, generation, sitemap, llms, JSON-LD, and Zod schemas.
---

`@grove-dev/core` is the framework-free engine. Every public function is exported for programmatic use — that's the surface the CLI and the Astro integration depend on, and the surface you can depend on from your own scripts.

This page covers the shape of that API and the most common recipes. The canonical list of every export lives in [`apps/docs/docs-audit/package-api-inventory.md`](https://github.com/tortuvshin/grove/blob/main/apps/docs/docs-audit/package-api-inventory.md) and is verified by `scripts/check-docs-contract.mjs`.

## Subpath layout

The package exports `@grove-dev/core` (named exports) and `@grove-dev/core/directory` (the framework-independent presentation modules). The presentation modules are safe to import from browser code.

```ts
import { defineConfig, loadConfig } from "@grove-dev/core";
import { filterEntries, LENSES, scoreTier } from "@grove-dev/core/directory";
```

The Astro integration imports these same modules to render record index, taxonomy tables, and collection pages.

## Config

```ts
import { defineConfig, loadConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: "project-directory",
  site: {
    name: "My Directory",
    url: "https://example.com",
  },
});
```

`blueprint` is a flat enum: `"project-directory"` (default), `"resource-hub"`, or `"ecosystem-map"`. The site has `site.name` (required), `site.tagline` (default "A growing community knowledge site."), `site.url`, `site.repoUrl`, `site.logo`, `site.favicon`, `site.locale`, `site.twitter`.

`loadConfig` reads `grove.config.ts` from disk using `jiti`:

```ts
const config = await loadConfig({ cwd: "/path/to/space" });
```

The function is async. It throws when the file is missing or invalid; the CLI wraps the throw in a pointed error.

## Generation

```ts
import { generate } from "@grove-dev/core";

// Read records from data/records/*.yml, write data/generated/*.json
const result = await generate({ cwd: "/path/to/space" });
```

`generate()` writes `records.full.json`, `records.index.json`, `records.json`, and `site-config.json` under `data/generated/`. The `result` object is the `GenerateResult` type with `totalRecords`, `byKind`, `byStack`, and the resolved payloads.

## Pipeline

```ts
import { prepareDirectory } from "@grove-dev/core";

// Full pipeline: loadConfig → generate → buildSitemap → buildLlmsFiles → buildSiteArtifacts → buildOgImages
await prepareDirectory({ cwd: "/path/to/space" });
```

`prepareDirectory()` is the single entry point used by both the CLI (`grove check`) and the Astro integration. It runs every emit step in the right order. Pass `cwd` to operate on a project other than `process.cwd()`.

## Sitemap

```ts
import { buildSitemap, buildSitemapXml } from "@grove-dev/core";

const sitemap = buildSitemap(records, siteConfig);          // object form
const xml = buildSitemapXml(records, siteConfig);            // string form, written to public/sitemap.xml
```

A single `sitemap.xml` is emitted. There is no separate sitemap index. Filter URLs are included when they resolve to a non-empty result set.

## llms.txt

```ts
import { buildLlmsTxt, buildLlmsFullTxt, buildLlmsFiles } from "@grove-dev/core";

const short = buildLlmsTxt(records, siteConfig);     // 5–20 KB
const full = buildLlmsFullTxt(records, siteConfig);   // includes long-form bodies
const both = buildLlmsFiles(records, siteConfig);     // returns { short, full }
```

The two-file `llms.txt` family is the framework's machine-readable surface. See [LLM-oriented outputs](/outputs/llm/) for the format.

## Site artifacts

```ts
import { buildRobotsTxt, buildOgImageSvg, buildSiteArtifacts } from "@grove-dev/core";

const robots = buildRobotsTxt(siteConfig);
const ogSvg = buildOgImageSvg(siteConfig);
const { robots, ogImageSvg } = await buildSiteArtifacts({ siteConfig, publicDir: "public" });
```

`buildSiteArtifacts()` writes `robots.txt` and `og-image.svg` to `public/`. Both are sentinel-owned: the first emission includes a `<!-- grove-generated: edit this file to take ownership -->` marker; subsequent runs honor user edits.

## OG cards (PNG)

```ts
import { buildOgImages, renderOgPng } from "@grove-dev/core";

const result = await buildOgImages({
  cwd: "/path/to/space",
  publicDir: "public",
  generatedDir: "data/generated",
});
// result.files: ['home.png', 'records/ollama.png', 'collections/top-ai.png', ...]
// result.manifest: writes data/generated/og-manifest.json
```

Renders per-page PNGs via satori + resvg. Non-fatal — a render failure on one page doesn't break the build.

## README

```ts
import {
  buildAwesomeReadme,
  injectAwesomeReadmeBlock,
  parseAwesomeReadmeSections,
  AWESOME_README_START,
  AWESOME_README_END,
} from "@grove-dev/core";

const markdown = buildAwesomeReadme({
  site: { name, tagline, description, url, repoUrl },
  records,
  categories,
  generatedAt: new Date().toISOString(),
  readme: config.readme,
});
const readmeWithBlock = injectAwesomeReadmeBlock(existingReadme, markdown);

// Extract an existing sentinel block from a README for inspection.
const { start, end } = parseAwesomeReadmeSections(existingReadme);
```

The command `grove readme generate` is `buildAwesomeReadme` + `injectAwesomeReadmeBlock`. `parseAwesomeReadmeSections` is exported for tools that want to inspect or validate the sentinel block without rendering.

## JSON-LD

```ts
import { definePageDocument, buildJsonLd, validateJsonLd } from "@grove-dev/core";

const doc = definePageDocument({
  type: "record",
  record: myRecord,
  site: siteConfig,
  url: "https://example.com/projects/ollama/",
});
const jsonLd = buildJsonLd(doc);
const { valid, errors } = validateJsonLd(jsonLd);
```

`definePageDocument` is the source for every page's OG, Twitter, and JSON-LD. The `type` enum is `home | directory | collection | record | content | empty | 404`.

## Schemas

```ts
import {
  blueprintSchema,
  projectRecordSchema,
  resourceRecordSchema,
  entityRecordSchema,
  healthBlockSchema,
  decisionSchema,
  auditSchema,
  readmeConfigSchema,
  groveConfigSchema,
} from "@grove-dev/core";

const parsed = projectRecordSchema.parse(rawYml);
const config = groveConfigSchema.parse(rawConfig);
```

Schemas are built with Zod 4 and are the source of truth for the YAML format. Use them to:

- Validate a record before writing it.
- Build a custom importer that produces valid records.
- Generate TypeScript types via `z.infer<typeof XxxSchema>`.

Every named schema is exported. The complete list:

| Export | Source |
|---|---|
| `blueprintSchema`, `Blueprint`, `blueprintKind` | `packages/core/src/schema.ts` |
| `resourceKindSchema` | `packages/core/src/schema.ts` |
| `projectTypeSchema`, `resourceTypeSchema`, `entityTypeSchema`, `appLabelSchema` | `packages/core/src/schema.ts` |
| `scoreSchema`, `linksSchema` | `packages/core/src/schema.ts` |
| `githubRepositorySchema`, `githubMetadataSchema`, `githubLicenseSchema` | `packages/core/src/schema.ts` |
| `healthBlockSchema`, `healthEntrySchema`, `healthFileSchema`, `healthStatusSchema`, `healthTierSchema` | `packages/core/src/schema.ts` |
| `decisionSchema`, `decisionsFileSchema`, `overrideSchema`, `overridesFileSchema` | `packages/core/src/schema.ts` |
| `projectRecordSchema`, `resourceRecordSchema`, `entityRecordSchema` | `packages/core/src/schema.ts` |
| `resourceSchema`, `recordsFileSchema` | `packages/core/src/schema.ts` |
| `auditSchema`, `readmeConfigSchema` | `packages/core/src/schema.ts` |
| `normalizeGithubIntegration` | `packages/core/src/schema.ts` |
| `siteSchema`, `collectionSchema`, `recordSchema`, `contentSchema` | `packages/core/src/page-document.ts` |

`defineConfig`, `loadConfig`, and validation helpers (`validateProject`, `loadRecords`, `loadRecordsOrThrow`) are in `packages/core/src/{config,validate}.ts`.

## GitHub sync

```ts
import {
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
} from "@grove-dev/core";

const { owner, repo } = parseGithubRepoUrl("https://github.com/ollama/ollama");
const metadata = await fetchGithubMetadata(owner, repo, { auth: process.env.GITHUB_TOKEN });
const enriched = await enrichFromGithubHtml("https://github.com/ollama/ollama");
const patch = buildGithubSyncPatch(metadata);
```

The token-free HTML fallback (`enrichFromGithubHtml`) fetches the public GitHub page, parses it, and returns `homepage`, `license`, `language`, `topics` — only fields the REST API didn't reach.

`rateLimitWaitMs` and `sleep` are exported for backoff scheduling in long-running sync loops.

## Helpers and IO

A small set of pure utilities round out the surface.

```ts
import {
  hostOf,            // shared OG host resolution (used by site-artifacts and og-image)
  slugify,           // kebab-case slug helper
  uniqueSlug,        // heading-anchor collision counter (markdown renderer)
  stringifyRecordYaml, // YAML serializer that preserves comments / structure
  readYamlFile, writeYamlFile, writeTextFile, // IO helpers used by importers
} from "@grove-dev/core";
```

`slugify`/`uniqueSlug` are exported because `@grove-dev/astro`'s markdown renderer uses them to keep heading anchors stable across re-renders.

## Content body helpers

```ts
import {
  extractToc, headingSlug, readContentFile,
  readingMetrics, resolveContentPath, stripFrontmatter,
} from "@grove-dev/core";

const toc = extractToc(markdownBody);
const content = readContentFile(record, paths);
```

These read and shape the `content/records/<slug>.md` body that accompanies a record. Pure helpers; safe to import from server-only contexts.

## Importer helpers

`grove import` uses these under the hood; they're exported for custom importers.

```ts
import {
  detectGithubRepo, parseAwesomeMarkdown, parseEntry, parseSections,
  importAwesomeList, writeImportedRecords,
} from "@grove-dev/core";
```

`parseAwesomeMarkdown` understands the `sindresorhus/awesome` README format. `parseEntry` and `parseSections` are the lower-level primitives for custom parsers.

## Contributors

```ts
import { syncContributors } from "@grove-dev/core";

const result = await syncContributors({
  cwd: process.cwd(),
  generatedDir: "data/generated",
  repoUrl: "https://github.com/me/my-space",
});
console.log(result.contributors, result.repositories);
```

Writes `data/generated/contributors.json` and `data/generated/repo-stats.json`. Gated by `integrations.github.contributors`.

## Health

```ts
import { classifyHealth } from "@grove-dev/core";

const healthBlock = classifyHealth(record, githubSignal);
```

`classifyHealth` is the function `grove sync github` runs per record. Exposed for custom importer flows that need to compute the `health` block without doing a full sync.

## Collections

```ts
import {
  filterEntries,
  rankEntries,
  runCollection,
  findRelated,
  loadCollections,
  LENSES,
  scoreTier,
} from "@grove-dev/core";

const filtered = filterEntries(records, { match: { "tags.any": ["agent"] } });
const ranked = rankEntries(filtered, { preset: "quality" });
const result = runCollection(loadedCollection, records, siteConfig);
const related = findRelated(record, records);
const collections = loadCollections({ cwd });
const lens = LENSES.featured(records, 6);
const tier = scoreTier(record);
```

These are the building blocks of every curated page. The collection runner pre-resolves entries and ranking so the page render is a pure read.

## Audit budget

```ts
import { evaluateBudget, DEFAULT_BUDGET } from "@grove-dev/core";

const result = evaluateBudget(lighthouseScores, DEFAULT_BUDGET);
if (!result.passed) {
  console.error(result.violations);
}
```

`DEFAULT_BUDGET` is the framework's quality threshold (Lighthouse "good" ranges for performance, accessibility, best-practices, SEO, LCP, CLS, TBT). `evaluateBudget` is what `grove audit` uses to set `process.exitCode`.

## Cleanup candidates

```ts
import { cleanupStale, pickCleanupCandidates } from "@grove-dev/core";

await cleanupStale({ cwd: process.cwd() });
// writes data/generated/cleanup-report.json
```

These never delete records. The output is a triage list; curators act.

## Icons

```ts
import { syncIconAssets } from "@grove-dev/core";

const result = await syncIconAssets(sourceDir, targetDir, {
  force: false,
  prune: false,
  dryRun: false,
});
// result.written, result.skipped, result.pruned
```

`--force` makes the operation match the source exactly (including prunes). `--check` (dry-run mode) reports drift without writing; the Astro integration runs the same sync on every build, so most sites never need this command.

## Reference schema exports

All exports are listed in [`apps/docs/docs-audit/package-api-inventory.md`](https://github.com/tortuvshin/grove/blob/main/apps/docs/docs-audit/package-api-inventory.md). New exports can land in a minor version; existing ones are stable.

## See also

- [Configuration reference](/reference/config/) — every `grove.config.ts` field.
- [Record schema](/reference/record-schema/) — every record kind and field.
- [CLI reference](/reference/cli/) — the command-line surface that wraps this API.
- [Plugin author guide](/reference/plugin-author-guide/) — for `@grove-dev/starlight`-class extensions.
