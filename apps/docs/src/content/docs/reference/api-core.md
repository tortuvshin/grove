---
title: Programmatic API
description: Programmatic access to @grove-dev/core — config loading, generation, sitemap, llms, JSON-LD, and Zod schemas.
---

`@grove-dev/core` exposes every public function for programmatic use. This page covers the API surface and common recipes.

## Imports

```ts
// Top-level
import {
  defineConfig,
  loadConfig,
  generate,
  prepareDirectory,
  buildSitemap,
  buildSitemapIndex,
  buildSitemapXml,
  buildLlmsTxt,
  buildLlmsFullTxt,
  buildLlmsFiles,
  buildOgImageSvg,
  buildSiteArtifacts,
  buildRobotsTxt,
  buildAwesomeReadme,
  injectAwesomeReadmeBlock,
  parseReadme,
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
  syncContributors,
  validateProject,
  loadRecords,
  loadRecordsOrThrow,
  buildJsonLd,
  definePageDocument,
  validateJsonLd,
  runCollection,
  filterEntries,
  rankEntries,
  findRelated,
  filterRecords,
  applySort,
  paginate,
  buildFacets,
  LENSES,
  scoreTier,
  evaluateBudget,
  DEFAULT_BUDGET
} from "@grove-dev/core";

// Browser-safe (display, lenses, search only)
import {
  filterEntries,
  rankEntries,
  LENSES,
  scoreTier
} from "@grove-dev/core/directory";
```

## Config

```ts
import { defineConfig, loadConfig } from "@grove-dev/core";

export default defineConfig({
  blueprint: { kind: "project-directory", slug: "projects", name: "Projects" },
  site: { title: "My Directory", url: "https://example.com" }
});
```

`loadConfig` reads `grove.config.ts` from disk using `jiti`:

```ts
import { loadConfig } from "@grove-dev/core";

const config = await loadConfig({ cwd: "/path/to/space" });
```

## Generation

```ts
import { generate } from "@grove-dev/core";

// Read records from data/records/*.yml, write data/generated/*.json
const result = await generate({ cwd: "/path/to/space" });
console.log(result.stats); // { total, visible, hidden, byKind, byStack, ... }
```

## Pipeline

```ts
import { prepareDirectory } from "@grove-dev/core";

// Full pipeline: loadConfig → generate → buildSitemap → buildLlmsFiles → buildSiteArtifacts
await prepareDirectory({ cwd: "/path/to/space" });
```

## Outputs

```ts
import { buildSitemap, buildLlmsTxt, buildRobotsTxt, buildOgImageSvg } from "@grove-dev/core";

const sitemap = await buildSitemap(records, siteConfig);
const llmsTxt = buildLlmsTxt(records, siteConfig);
const robots = buildRobotsTxt(siteConfig);
const ogImage = buildOgImageSvg(siteConfig);
```

## JSON-LD

```ts
import { definePageDocument, buildJsonLd, validateJsonLd } from "@grove-dev/core";

const doc = definePageDocument({
  type: "record",
  record: myRecord,
  siteConfig,
  url: "https://example.com/projects/ollama/"
});

const jsonLd = buildJsonLd(doc);
const { valid, errors } = validateJsonLd(jsonLd);
```

## Schemas

```ts
import { siteSchema, collectionSchema, recordSchema, contentSchema } from "@grove-dev/core";

const parseSite = siteSchema.parse(input);
```

Schemas are built with Zod 4 and are the source of truth for the YAML format.

## GitHub sync

```ts
import {
  parseGithubRepoUrl,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  buildGithubSyncPatch,
  syncContributors
} from "@grove-dev/core";

const { owner, repo } = parseGithubRepoUrl("https://github.com/ollama/ollama");
const metadata = await fetchGithubMetadata(owner, repo, { auth: process.env.GITHUB_TOKEN });
const html = await fetch(`https://github.com/${owner}/${repo}`).then(r => r.text());
const enriched = enrichFromGithubHtml(html);
const patch = buildGithubSyncPatch(metadata, enriched);
await syncContributors(records, { auth: process.env.GITHUB_TOKEN });
```

## Browser-safe display

```ts
import { filterEntries, rankEntries, LENSES, scoreTier } from "@grove-dev/core/directory";

const filtered = filterEntries(records, { tags: ["agent"] });
const ranked = rankEntries(filtered, "stars");
const lens = LENSES.featured(records, 6);
const tier = scoreTier(70); // { tier: "top", color: "#16a34a" }
```

## Related

- [Configuration reference](/reference/config/)
- [Record schema](/reference/record-schema/)
- [CLI reference](/reference/cli/)
- [Plugin author guide](/reference/plugin-author-guide/)