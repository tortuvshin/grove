# `@grove-dev/core`

> Generic, framework-free engine for Grove.

Headless TypeScript. Owns the resource schema, config loader, importers, validators, taxonomy types, optional GitHub signal sync, sitemap generation, llms.txt generation, and the data build pipeline. Zero framework dependencies — no Astro, no React, no Svelte.

```bash
pnpm add @grove-dev/core
```

## What it does

- **Resource schema** — Zod-validated generic `Resource` model (name, description, type, url, repository, topics, tags, status, maintainers, organizations, metadata).
- **Config** — `defineGroveConfig()` and `loadConfig()` for `curated.config.ts` projects.
- **Importers** — parse Markdown awesome lists into structured records.
- **Validators** — schema + reference checks (duplicate ids, missing descriptions, broken categories, unknown decisions).
- **Taxonomy** — typed registry for stacks, platforms, categories, distribution channels.
- **Build pipeline** — `buildData()` produces `data/generated/apps.{full,index}.json` and a typed `src/data/config.ts`.
- **Sitemap & llms.txt** — `buildSitemap()` and `buildLlmsFiles()` for SEO and LLM-friendly output.
- **Optional GitHub signal sync** — `fetchGithubMetadata()`, `classifyHealth()`, `enrichFromGithubHtml()` for spaces that want maintenance signals.
- **Rate-limit aware** — `ghFetch()` and `pLimit()` for safe concurrent HTTP.

## Public surface

```ts
import {
  // Config
  defineConfig,
  loadConfig,

  // Schemas
  curatedConfigSchema,
  resourceSchema,
  healthEntrySchema,
  decisionSchema,
  itemsFileSchema,

  // Build pipeline
  buildData,
  buildSiteConfigTs,

  // Sitemap / llms
  buildSitemap,
  buildSitemapXml,
  buildLlmsFiles,
  buildLlmsTxt,
  buildLlmsFullTxt,

  // Decision / review
  buildReviewReport,
  pickReviewCandidates,

  // Importers / parsers
  importAwesomeList,
  parseAppYaml,
  normalizeAppRecord,
  toIndexApp,
  parseGithubRepoUrl,

  // GitHub
  fetchGithubMetadata,
  classifyHealth,
  healthFromSignals,
  enrichFromGithubHtml,
  ghFetch,
  pLimit,

  // IO
  readYamlFile,
  writeYamlFile,
  writeTextFile,
  stringifyAppYaml,

  // Validate
  validateProject,
  validateAppRecord,
} from "@grove-dev/core";
```

## Development

```bash
pnpm --filter @grove-dev/core build
pnpm --filter @grove-dev/core check
```

## License

MIT
