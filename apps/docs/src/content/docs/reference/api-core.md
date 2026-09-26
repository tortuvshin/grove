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

## Records

```ts
import { loadNormalizedRecords, recordVisibility, applyDecisionVisibility } from "@grove-dev/core";

const { records, entries, issues, githubCache } = await loadNormalizedRecords(config, "/path/to/space");
for (const { slug, record, visibility, provenance } of records) {
  // record: the fully merged Resource; visibility: effective visibility
  // provenance: { github, health, decision, override } — where each layer came from
}
```

`loadNormalizedRecords(config, cwd = process.cwd())` is the one reader of the record layers, in both [record formats](/reference/record-schema/#record-formats) (YAML under `paths.recordsDir`, optionally with a `content:` pointer, and Markdown with frontmatter under `paths.bodiesDir`). `generate()`, `grove check`, `grove cleanup` and `grove readme generate` all take their records from it, so the site, the README and the checks cannot disagree about a record. Per record, lowest to highest precedence:

1. the record file: `paths.recordsDir/<slug>.yml`, or a Markdown record's frontmatter;
2. the GitHub sync cache for `github` / `health`, over a legacy inline copy (`resolveRecordGithub` with `githubSyncFreshnessOptions(config)`, so health from a stale sync resolves as `status: unknown`);
3. the `paths.overrides` patch (shallow, top-level fields);
4. schema parse with `recordsFileSchema`; the slug is always the file name;
5. the `paths.health` entry, for a project record nothing above gave a health block;
6. the `paths.decisions` visibility (`applyDecisionVisibility`: a project with no health block gets a fabricated `unknown` one to carry it).

Each `NormalizedRecord` carries `format` (`RecordFormat`: `yaml`, `yaml+content` or `markdown`), `body` (a Markdown record's body, or the file a pointer resolves to, frontmatter stripped), `record` (every layer applied; a Markdown record's `content` points at its own file), `base` (before `paths.health` and decisions), `visibility` (`recordVisibility(record)`: decision, then `health.visibility`, then the record's own `visibility`), `declaredSlug` (the `slug` written in the file) and `provenance`. `RecordHealthSource` is `cache | inline | override | file | decision | none`.

The loader never throws for a bad record. A file that fails to parse or fails the schema is reported in `issues` (`schema_error`, or one `zod_error` per Zod issue). So are a slug that exists in both formats (`duplicate_slug_format`, on both files) and a Markdown record with its own `content:` (`markdown_content_pointer`). A disagreeing inline copy is a `github_cache_mismatch` warning, and with `records.deprecateContentPointer` every YAML + pointer record gets a `record_format_deprecated` warning. `entries` lists every file in discovery order with its own issues and `syncStale` (its cached health came from a stale sync), and `record` is set only when the file normalized. Missing or invalid side files count as empty; `grove check` reports them.

`readRecordSources(config, cwd?)` is the discovery step on its own. It returns `{ sources }`: every record file in both formats, sorted by file name, with its parsed YAML or frontmatter (`data`), a Markdown record's `body`, and read issues, and no layer merged. `grove sync github` iterates over it.

Types: `NormalizedRecord`, `NormalizedRecords`, `RecordEntry`, `RecordIssue`, `RecordHealthSource`, `RecordFormat`, `RecordSource`, `RecordSources`.

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

The command `grove readme generate` is `loadNormalizedRecords` + `toAwesomeReadmeRecord` + `buildAwesomeReadme` + `injectAwesomeReadmeBlock`. `toAwesomeReadmeRecord(record)` projects a normalized record onto the README entry shape, including its effective visibility. `parseAwesomeReadmeSections` is exported for tools that want to inspect or validate the sentinel block without rendering.

With `readme.entryLinkTarget: 'detail'`, also pass `directoryRoute` so entries can link to record pages:

```ts
import { assertReadmeLinkConfig, directoryRoute, recordDetailUrl } from "@grove-dev/core";

// Route segment of record pages: routes.directory, or the blueprint default.
const route = directoryRoute(config); // "apps"

// Throws when 'detail' links cannot be built (no site.url or route).
assertReadmeLinkConfig({ readme: config.readme, site: config.site, directoryRoute: route });

recordDetailUrl("https://example.org", route, "immich"); // "https://example.org/apps/immich/"
```

`buildAwesomeReadme` calls `assertReadmeLinkConfig` itself; call it directly to fail early in your own tooling.

## JSON-LD

```ts
import { buildJsonLd, definePageDocument, faqSchema, validateJsonLd } from "@grove-dev/core";

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

`definePageDocument(input: PageDocument): PageDocument` (`packages/core/src/page-document.ts:90`) validates and returns the full page contract — `identity`, `metadata`, `structuredData`, `discovery`. `PageIdentity.type` is `home | directory | collection | record | content | empty | 404`. `buildJsonLd` is a separate, overloaded builder for the `structuredData` array itself — it takes a `SiteInput | CollectionInput | RecordInput | ContentInput`, not a `PageDocument` (`packages/core/src/page-document.ts:253-260`). `faqSchema({ url, items })` takes a `FaqInput` (`items: { question, answer }[]`) and returns one `FAQPage` node to append to a page graph; it is not part of the `buildJsonLd` overload. `validateJsonLd(nodes)` returns a `JsonLdValidationIssue[]` directly — an empty array means the graph is valid (`packages/core/src/page-document.ts:278`).

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
  subjectSchema,
  relationSchema,
  relationTypeSchema,
  relationEvidenceSchema,
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
| `siteSchema`, `collectionSchema`, `recordSchema`, `contentSchema`, `softwareApplicationSchema`, `SOFTWARE_APPLICATION_FIELDS` | `packages/core/src/page-document.ts` |

`defineConfig`, `loadConfig`, and validation helpers (`validateProject`, `loadRecords`, `loadRecordsOrThrow`) are in `packages/core/src/{config,validate}.ts`.

## GitHub sync

```ts
import {
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
  pruneLegacyGithubFields,
} from "@grove-dev/core";

const ref = parseGithubRepoUrl("https://github.com/ollama/ollama"); // { owner, repo } | undefined
const metadata = await fetchGithubMetadata(ref, process.env.GITHUB_TOKEN);
const enriched = await enrichFromGithubHtml("https://github.com/ollama/ollama");
const patch = buildGithubSyncPatch(metadata, existingRecord.github);
const cleanedGithub = pruneLegacyGithubFields(existingRecord.github);
```

The token-free HTML fallback (`enrichFromGithubHtml`) fetches the public GitHub page, parses it, and returns `homepage`, `license`, `language`, `topics` — only fields the REST API didn't reach.

`pruneLegacyGithubFields` drops fields an older `sync github` wrote but nothing reads today (`latestRelease`, `files`, `labels` — see [Sync GitHub metadata](/automation/sync-github/)); `sync github` calls it on the existing `github` block before merging `buildGithubSyncPatch`'s output on top, so a record self-heals on its next sync.

`rateLimitWaitMs` and `sleep` are exported for backoff scheduling in long-running sync loops.

### GitHub sync cache

`grove sync github` writes one JSON entry per record to `paths.githubCache`; the record normalizer (`loadNormalizedRecords`, see [Records](#records)) resolves a record's `github` and `health` through this helper (cache > inline > `paths.health`).

```ts
import {
  loadGithubCache,          // (config, cwd?) → { dir, entries: Map<slug, entry>, errors }
  resolveRecordGithub,      // (rawRecord, entry?, freshness?) → { record, github, health, conflicts, syncStale? }
  githubSyncFreshness,      // (entry, { maxAgeDays?, now? }?) → { stale: false } | { stale: true, cause, detail }
  githubSyncFreshnessOptions, // (config) → { maxAgeDays } from sync.github.maxAgeDays
  githubCacheConflicts,     // (rawRecord, entry?) → string[] of inline-vs-cache field differences
  githubCacheDir,           // (config, cwd?) → absolute cache directory
  nextGithubCacheEntry,     // (previous, attempt) → next entry (lastSuccessAt / partialFailures rules)
  seedGithubCacheEntry,     // (slug, rawRecord) → entry built from legacy inline blocks
  serializeGithubCacheEntry,// (entry) → deterministic JSON text with trailing newline
  writeGithubCacheEntry,    // (dir, entry) → false when the file already held these bytes
  migrateRecordGithub,      // (slug, yamlText, existing?) → { text, entry, moved, conflicts }
  removeTopLevelYamlKeys,   // (yamlText, keys) → text with only those top-level blocks removed
  githubCacheEntrySchema,   // Zod schema for one cache file
  GITHUB_CACHE_SCHEMA_VERSION,
  GITHUB_CACHE_MAX_FAILURES,
  GITHUB_SYNC_MAX_AGE_DAYS, // 14, the default for sync.github.maxAgeDays
  SYNC_STALE_REASON,        // "sync_stale"
} from "@grove-dev/core";

const cache = await loadGithubCache(config);
const { record, conflicts, syncStale } = resolveRecordGithub(
  raw,
  cache.entries.get(slug),
  githubSyncFreshnessOptions(config),
);
```

Pass the freshness options, as every Grove reader does: a stale entry's health then resolves as `status: unknown` with `staleReason: sync_stale`, and `syncStale` says why. Without them the cached block is returned as-is.

Types: `GithubCache`, `GithubCacheEntry`, `GithubCacheFailure`, `GithubCacheSource`, `GithubCacheMigration`, `GithubFieldSource`, `GithubSyncAttempt`, `GithubSyncFreshness`, `GithubSyncFreshnessOptions`, `ResolvedRecordGithub`.

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
  readingMetrics, resolveContentPath, shiftHeadings,
  splitFrontmatter, stripFrontmatter, stripLeadingH1,
} from "@grove-dev/core";

const toc = extractToc(markdownBody);
const content = readContentFile(contentPath, candidatePaths);
const embedded = shiftHeadings(stripLeadingH1(content.body), 3);
```

These read and shape the `content/records/<slug>.md` body that accompanies a record. Pure helpers; safe to import from server-only contexts.

`splitFrontmatter(text)` returns `{ frontmatter, body, hasFrontmatter }`. It is the one frontmatter rule: `readContentFile` uses it for bodies and the record normalizer uses it for Markdown records. The closing `---` is only looked for in the first 200 lines, so a horizontal rule further down is never mistaken for it.

`stripLeadingH1` drops a body's opening `# Title` line — the detail page already renders the record name as its `<h1>`, so a second one never reaches the page. `shiftHeadings` pushes every heading deeper (capped at `######`); `llms-full.txt` uses both so a record's body sits below its `### <name>` section instead of outranking it. Headings inside fenced code blocks are left alone.

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

```ts
import { PUSH_AGE_BANDS, pushAgeBand } from "@grove-dev/core";

pushAgeBand(400); // { id: "stale", maxDays: 548, staleReason: "no_push_6_months", reason: "No push in the last 6 months" }
```

`PUSH_AGE_BANDS` is the one push-age table behind `classifyHealth` and `classifyRepositoryHealth`: ≤ 183 days `active`, ≤ 548 `stale`, ≤ 730 `needs_review`, beyond that `inactive`. Types: `PushAgeBand`, `PushAgeBandId`.

## README health check

```ts
import { runReadmeHealthCheck } from "@grove-dev/core";

const report = await runReadmeHealthCheck(markdown, {
  file: "README.md",
  token: process.env.GITHUB_TOKEN, // optional; raises the rate limit
  concurrency: 4,
});
console.log(report.summary.healthyPercent, report.summary.archived);
```

`runReadmeHealthCheck` is what `grove health [readme]` runs. It checks every repository linked from a Markdown list — an awesome list, a README — and needs no Grove project, so it works on a list that has not been imported yet. `report.entries` keeps one result per list item; `report.summary` counts entries detected, repositories resolved, archived, unavailable, moved, duplicates, likely stale, and unresolved.

It is three steps, each exported for callers that need only part of the pipeline:

```ts
import {
  extractCandidates,
  inspectRepositories,
  inspectRepository,
  classifyRepositoryHealth,
  createMemoryCache,
  canonicalRepoKey,
} from "@grove-dev/core";

const candidates = extractCandidates(markdown, { file: "README.md" });
const evidence = await inspectRepository("https://github.com/immich-app/immich", { token });
const verdict = classifyRepositoryHealth(evidence); // { status, confidence, evidence, counterEvidence }
```

- `extractCandidates(markdown, options?)` turns every list item into a `CandidateEntry`. Unlike `parseAwesomeMarkdown` it drops nothing: an item with no link still becomes a candidate, with a low confidence and a warning.
- `inspectRepository(url, options?)` fetches the evidence for one GitHub repository — API first, HTML as a fallback when the API is unavailable (flagged `partial-evidence-html-fallback`). `inspectRepositories(urls, { concurrency, cache })` does the same for a batch, fetching each repository once however many times it is linked.
- `createMemoryCache()` is the default in-process `RepositoryEvidenceCache`; pass your own `{ get, set }` to persist evidence between runs. `canonicalRepoKey(owner, repo)` is the lowercase `owner/repo` key the cache and duplicate detection share.
- `classifyRepositoryHealth(evidence)` returns an explainable verdict — `active`, `maintained`, `stable`, `likely-stale`, `archived`, `broken`, or `unknown` — with a confidence and the evidence for and against it. It reads the same `PUSH_AGE_BANDS` table as `classifyHealth`, so the cutoffs are identical in a README check and in a synced record.

## Collections

```ts
import {
  filterEntries,
  rankEntries,
  runCollection,
  findRelated,
  loadCollections,
  parseCollectionFile,
  collectionDefinitionSchema,
  CollectionFileError,
  toCollectionEntries,
  LENSES,
  lensById,
  scoreTier,
} from "@grove-dev/core";

const filtered = filterEntries(records, { stacks: ["flutter"], excludeStatuses: ["archived"] });
const ranked = rankEntries(filtered, { preset: "quality" });
const result = runCollection(loadedCollection, records);
const related = findRelated(loadedCollection, allCollections, 3);
const collections = await loadCollections(cwd);
const entries = toCollectionEntries(fullRecords, { routeSlug: "apps" });
const lens = lensById("hot");
const tier = scoreTier(record.curationScore ?? 0);
```

`filterEntries`/`rankEntries` take a `CollectionQuery`/`CollectionRanking` (`packages/core/src/collections.ts`). `runCollection(collection, entries)` filters and ranks in one call (`packages/core/src/collector.ts:12`). `findRelated(target, all, limit)` finds other collections with overlapping query facets — it operates on collections, not records (`packages/core/src/related.ts:3`). `LENSES` is a plain array of lens definitions; `lensById(id)` looks one up by id (`packages/core/src/directory-lenses.ts:46,134-137`) — there is no `LENSES.<id>()` call form. `scoreTier(n)` buckets a 0-100 score into a 0-4 tier (`packages/core/src/directory-scores.ts:22`). These are the building blocks of every curated page — the collection runner pre-resolves entries and ranking so the page render is a pure read.

`loadCollections` parses every `data/collections/*.yml` with `collectionDefinitionSchema` — defaults applied (`kind: curated`, `query: {}`, `ranking.preset: curated`, `seo.index: true`), unknown top-level keys kept. A file that is not a YAML mapping or fails the schema throws a `CollectionFileError` carrying the `file` and a `problems[]` list, one `path: message` string per failing field. `parseCollectionFile(file, text)` is the single-file form; `grove check` uses it to report the same problems as `collection_invalid` issues instead of a thrown build.

`runCollection` resolves hand-picked `entries` as well as the `query`: membership is the union of both, an empty query only takes part when there are no picks, `pinned` picks lead in file order, and a pick's `note` lands on the returned entry (`CollectionEntry.note`, `CollectionEntry.pinned`). `CollectionPick` and `CollectionFaqItem` are the element types of `Collection['entries']` and `Collection['faq']`.

`filterEntries` also understands `query.relatedTo: { type?, subjects }`, matching `CollectionEntry.relations`; `findRelated` counts a shared subject (a collection's `subject` or its `relatedTo.subjects`) as overlap, so a hub relates to other collections covering the same subject.

`toCollectionEntries(records, { routeSlug, now? })` is the one record → `CollectionEntry` projection, shared by the collection page model and the OG-image pipeline so both count a collection the same way. It drops records hidden or removed by either `visibility` or `health.visibility`, reads `status` from `health.status` (the value `excludeStatuses` matches — the record's own `visibility` only ever says `keep`), and fills the ranking inputs: a curated `scores.activity` / `scores.curation` wins; otherwise activity is the mean of release freshness (180 days), push freshness (90 days) and the share of synced commits from the last three months, and curation is GitHub stars on a log scale (`log10(stars + 1) / 5`, capped at 1). `now` is injectable for tests.

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
