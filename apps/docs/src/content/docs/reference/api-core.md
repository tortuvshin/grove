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
import { filterRecords, LENSES, lensById } from "@grove-dev/core/directory";
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
const config = await loadConfig("/path/to/space");
```

`loadConfig(cwd = process.cwd(), configPath = "grove.config.ts")` is async (`packages/core/src/config.ts:18`). It throws when the file is missing or invalid; the CLI wraps the throw in a pointed error.

## Generation

```ts
import { generate } from "@grove-dev/core";

// Read records from data/records/*.yml, write data/generated/*.json
const result = await generate("/path/to/space");
```

`generate(cwd = process.cwd(), config?)` writes `records.full.json`, `records.index.json`, `records.json`, and `site-config.json` under `data/generated/` (`packages/core/src/build-data.ts:166`). The `result` object is the `GenerateResult` type with `totalRecords`, `byKind`, `byStack`, and the resolved payloads.

## Pipeline

```ts
import { prepareDirectory } from "@grove-dev/core";

// Full pipeline: loadConfig → generate → buildSitemap → buildLlmsFiles → buildSiteArtifacts → buildOgImages
await prepareDirectory("/path/to/space");
```

`prepareDirectory(cwd = process.cwd())` is the single entry point used by both the CLI (`grove check`) and the Astro integration (`packages/core/src/prepare.ts:114`). It runs every emit step in the right order.

## Sitemap

```ts
import { buildSitemap, buildSitemapXml } from "@grove-dev/core";

// buildSitemap builds the entries AND writes public/sitemap.xml for you
const { path, urlCount } = await buildSitemap(
  { generatedAt: new Date().toISOString(), items, collections },
  "/path/to/space",
);

// buildSitemapXml is the pure string-builder buildSitemap calls internally,
// exported for callers that already have a SitemapEntry[] and want the XML only
const xml = buildSitemapXml(entries);
```

`buildSitemap(input: SitemapInput, cwd?, config?)` (`packages/core/src/sitemap.ts:96`) is async and writes the file; `buildSitemapXml(entries: SitemapEntry[])` (`packages/core/src/sitemap.ts:69`) is synchronous and does not write anything. A single `sitemap.xml` is emitted. There is no separate sitemap index.

## llms.txt

```ts
import { buildLlmsTxt, buildLlmsFullTxt, buildLlmsFiles } from "@grove-dev/core";

const short = buildLlmsTxt(input, config);      // constant-size site header; no per-record content
const full = buildLlmsFullTxt(input, config);   // one index line + one detail section per record
const both = await buildLlmsFiles(input, cwd, config); // writes both files, returns { txtPath, fullPath, indexed }
```

The two-file `llms.txt` family is the framework's machine-readable surface. See [LLM-oriented outputs](/outputs/llm/) for the format.

## Site artifacts

```ts
import { buildRobotsTxt, buildOgImageSvg, buildSiteArtifacts } from "@grove-dev/core";

const robots = buildRobotsTxt({ siteUrl: siteConfig.site.url ?? "" });
const ogSvg = buildOgImageSvg(siteConfig);
const { robotsPath, ogImagePath, robotsWritten, ogImageWritten } = await buildSiteArtifacts(
  "/path/to/space",
  siteConfig,
);
```

`buildSiteArtifacts(cwd, config, stats?)` writes `robots.txt` and `og-image.svg` under `config.paths.publicDir` (`packages/core/src/site-artifacts.ts:91-113`). Both are sentinel-owned: the first emission prepends a `# grove-generated: edit this file to take ownership` marker to `robots.txt` and a `<!-- grove-generated: edit this file to take ownership -->` marker to `og-image.svg`; subsequent runs honor user edits.

## OG cards (PNG)

```ts
import { buildOgImages, renderOgPng } from "@grove-dev/core";

const result = await buildOgImages("/path/to/space", siteConfig, {
  records,
  collections,
  taxonomies,
});
// result: { written, skipped, failed } — also writes data/generated/og-manifest.json
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
import { buildJsonLd, definePageDocument, validateJsonLd } from "@grove-dev/core";

// buildJsonLd is overloaded per page kind — this branch takes a RecordInput
const structuredData = buildJsonLd({
  url: "https://example.com/projects/ollama/",
  name: "Ollama",
  description: "Run LLMs locally.",
  kind: "application",
  repoUrl: "https://github.com/ollama/ollama",
  crumbs: [{ url: "https://example.com/", name: "Home" }],
});

const doc = definePageDocument({
  identity: { type: "record", canonical: new URL("https://example.com/projects/ollama/"), language: "en" },
  metadata: { title: "Ollama", description: "Run LLMs locally.", robots: "index,follow", openGraph, twitter },
  structuredData,
  discovery: { includeInSitemap: true, includeInLlms: true, relatedLinks: [] },
});

const issues = validateJsonLd(doc.structuredData);
```

`definePageDocument(input: PageDocument): PageDocument` (`packages/core/src/page-document.ts:90`) validates and returns the full page contract — `identity`, `metadata`, `structuredData`, `discovery`. `PageIdentity.type` is `home | directory | collection | record | content | empty | 404`. `buildJsonLd` is a separate, overloaded builder for the `structuredData` array itself — it takes a `SiteInput | CollectionInput | RecordInput | ContentInput`, not a `PageDocument` (`packages/core/src/page-document.ts:253-260`). `validateJsonLd(nodes)` returns a `JsonLdValidationIssue[]` directly — an empty array means the graph is valid (`packages/core/src/page-document.ts:278`).

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

const ref = parseGithubRepoUrl("https://github.com/ollama/ollama"); // { owner, repo } | undefined
const metadata = await fetchGithubMetadata(ref, process.env.GITHUB_TOKEN);
const enriched = await enrichFromGithubHtml("https://github.com/ollama/ollama");
const patch = buildGithubSyncPatch(metadata, existingRecord.github);
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
const content = readContentFile(contentPath, candidatePaths);
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

const entry = classifyHealth(record.slug, githubSignal); // { id, health }
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
  lensById,
  scoreTier,
} from "@grove-dev/core";

const filtered = filterEntries(records, { stacks: ["flutter"], excludeStatuses: ["archived"] });
const ranked = rankEntries(filtered, { preset: "quality" });
const result = runCollection(loadedCollection, records);
const related = findRelated(loadedCollection, allCollections, 3);
const collections = await loadCollections(cwd);
const lens = lensById("hot");
const tier = scoreTier(record.curationScore ?? 0);
```

`filterEntries`/`rankEntries` take a `CollectionQuery`/`CollectionRanking` (`packages/core/src/collections.ts:25-42`). `runCollection(collection, entries)` filters and ranks in one call (`packages/core/src/collector.ts:12`). `findRelated(target, all, limit)` finds other collections with overlapping query facets — it operates on collections, not records (`packages/core/src/related.ts:3`). `LENSES` is a plain array of lens definitions; `lensById(id)` looks one up by id (`packages/core/src/directory-lenses.ts:46,134-137`) — there is no `LENSES.<id>()` call form. `scoreTier(n)` buckets a 0-100 score into a 0-4 tier (`packages/core/src/directory-scores.ts:22`). These are the building blocks of every curated page — the collection runner pre-resolves entries and ranking so the page render is a pure read.

## Audit budget

```ts
import { evaluateBudget, DEFAULT_BUDGET } from "@grove-dev/core";

const violations = evaluateBudget(auditResult, pageManifestEntry, DEFAULT_BUDGET);
if (violations.length > 0) {
  console.error(violations);
}
```

`evaluateBudget(result: AuditResult, page: PageManifestEntry, budget?)` returns a `BudgetViolation[]` directly — an empty array means the page passed (`packages/core/src/audit.ts:78-105`). `DEFAULT_BUDGET` is the framework's quality threshold (Lighthouse "good" ranges for performance, accessibility, best-practices, SEO, LCP, CLS, TBT). `evaluateBudget` is what `grove audit` uses to set `process.exitCode`.

## Cleanup candidates

```ts
import { cleanupStale, pickCleanupCandidates } from "@grove-dev/core";

const { report, path } = await cleanupStale(process.cwd());
// writes data/generated/cleanup-report.json and returns { report, path }
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

## Directory filter keys (single source of truth)

A small set of pure-data constants that the browse-page controller, refine panel, and server view-models all share, so chip labels and URL params never drift apart. See the [Registry and consumer-owned source](/concepts/registry/) concept doc for how this fits the v1 architecture.

- `DIRECTORY_FILTER_KEYS` — facet group key → URL param key (`stacks → stack`, `platforms → platform`, …).
- `DIRECTORY_TAXONOMY_KINDS` — facet group key → taxonomy kind (`stacks → stacks`, `tags → topics`, …).
- `DIRECTORY_FILTER_LABELS` — facet group key → singular display label (`Stack`, `Platform`, …).
- `FACET_DIMENSION_FOR_KEY` — reverse map (URL param key → facet group key).
- `isDirectoryFilterGroupKey(value)` — type guard.

## YAML string helpers (submit form, future CLI emit)

Pure, dependency-free helpers for the submit form's YAML preview. Used by `SubmissionClient.astro` (now in the registry scaffold at `components/grove/submission-client.astro`).

- `recordSlugify(value)` — coerce any input to a URL-safe hyphen slug.
- `parseGithubRepo(value)` — parse a GitHub URL into `{ owner, repo }` or return null.
- `yamlQuote(value)` — quote a scalar for safe inclusion in a YAML double-quoted string.
- `yamlLines(values, indent?)` — render a YAML block sequence with a given indent.

## Taxonomy inference

- `inferStackFromTopics({ language, topics })` — suggest a stack id (e.g. `flutter`, `ios`, `android`) from a repository's GitHub metadata. Used by the submit form to pre-fill the primary-stack field.

## See also

- [Configuration reference](/reference/config/) — every `grove.config.ts` field.
- [Record schema](/reference/record-schema/) — every record kind and field.
- [CLI reference](/reference/cli/) — the command-line surface that wraps this API.
- [Plugin author guide](/reference/plugin-author-guide/) — for `@grove-dev/starlight`-class extensions.
