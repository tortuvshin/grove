# `@grove-dev/core`

> Generic, framework-free engine for Grove.

Headless TypeScript. Owns the discriminated `Resource` union (`ProjectRecord` | `ResourceRecord` | `EntityRecord`), the config loader, importers, validators, taxonomy types, optional GitHub signal sync, sitemap generation, llms.txt generation, and the data build pipeline. Zero framework dependencies — no Astro, no React, no Svelte.

```bash
pnpm add @grove-dev/core
```

## What it does

- **Discriminated `Resource` schema** — Zod-validated `ProjectRecord` / `ResourceRecord` / `EntityRecord` union, plus the slim `IndexRecord` projection for list views. Each kind binds to a V1 blueprint (`project-directory` / `resource-hub` / `ecosystem-map`).
- **Config** — `defineConfig(config)` (V0's `defineGroveConfig` is gone) and `loadConfig` for `grove.config.ts` projects, via `jiti` so no build step is required.
- **Importers** — `parseAwesomeMarkdown` and `importAwesomeList` parse Markdown awesome lists into structured records.
- **Validators** — schema + reference checks (duplicate slugs, missing descriptions, broken categories, unknown decisions, kind-vs-blueprint mismatches).
- **Taxonomy** — typed registry for stacks, platforms, categories, distribution channels, lenses, labels.
- **Build pipeline** — `generate(config)` (the library form of `grove generate`) produces `data/generated/records.full.json`, `data/generated/records.index.json`, `data/generated/records.json` (alias), and `data/generated/site-config.json`.
- **Sitemap & llms.txt** — `buildSitemap` and `buildSitemapXml` (the library form of `grove sitemap`); `buildLlmsTxt` and `buildLlmsFullTxt` (the library form of `grove llms`).
- **Optional GitHub signal sync** — `fetchGithubMetadata`, `classifyHealth`, `enrichFromGithubHtml`, `parseGithubRepoUrl` for spaces that want maintenance signals. The CLI wraps these as `grove sync github`.
- **Cleanup** — `pickCleanupCandidates` (the library form of `grove cleanup stale`) flags records that need human review.

## Public surface (V1)

```ts
import {
  // Config
  defineConfig,
  loadConfig,
  type GroveConfig,

  // Schemas (Zod)
  blueprintSchema,
  resourceKindSchema,
  healthStatusSchema,
  healthTierSchema,
  healthBlockSchema,
  healthEntrySchema,
  healthFileSchema,
  decisionSchema,
  decisionsFileSchema,
  overrideSchema,
  overridesFileSchema,
  projectRecordSchema,
  resourceRecordSchema,
  entityRecordSchema,
  projectTypeSchema,
  resourceTypeSchema,
  entityTypeSchema,
  appLabelSchema,
  scoreSchema,
  linksSchema,
  githubRepositorySchema,
  githubMetadataSchema,
  githubLicenseSchema,
  type Blueprint,
  type ResourceKind,
  type DecisionVisibility,

  // Discriminated record types
  type Resource,
  type ProjectRecord,
  type ResourceRecord,
  type EntityRecord,
  type IndexRecord,
  type IndexProjectRecord,
  type IndexResourceRecord,
  type IndexEntityRecord,
  blueprintKind,

  // Build pipeline (library form)
  generate,
  type GenerateResult,
  type RecordsFullPayload,
  type RecordsIndexPayload,

  // Sitemap
  buildSitemap,
  buildSitemapXml,

  // llms.txt
  buildLlmsTxt,
  buildLlmsFullTxt,
  type LlmsInput,
  type LlmsRecordInput,
  type LlmsResult,

  // Cleanup
  pickCleanupCandidates,
  type CleanupCandidate,
  type CleanupReport,

  // GitHub
  parseGithubRepoUrl,
  type GithubRepoRef,
  fetchGithubMetadata,
  enrichFromGithubHtml,
  classifyHealth,
  healthFromSignals,
  type GithubMetadata,
  type HealthEntry,
  type EnrichedFields,
  type EnrichResult,
  rateLimitWaitMs,
  sleep,
  type GhFetchOptions,

  // Importers / parsers
  detectGithubRepo,
  parseAwesomeMarkdown,
  parseEntry,
  parseSections,
  type ImportedRecord,
  type ImportSummary,
  type ImportResult,
  type ParsedEntry,
  type ParsedSection,

  // IO helpers
  readYamlFile,
  writeYamlFile,
  writeTextFile,
} from "@grove-dev/core";
```

## V0→V1 renames in this package

The V0 published `@grove-dev/core` exposed several names that the V1 release replaces with `record` / `IndexRecord` / `Resource` semantics. The renames are:

| V0 name (removed) | V1 canonical name |
|---|---|
| `curatedConfigSchema` | `blueprintSchema` (in `schema.ts`) |
| `defineGroveConfig` | `defineConfig` (in `config.ts`) |
| `resourceSchema` | `projectRecordSchema` / `resourceRecordSchema` / `entityRecordSchema` |
| `itemsFileSchema` | removed (the records are individual `<slug>.yml` files, no aggregate file) |
| `buildData` | `generate` (library form) |
| `buildSitemap` / `buildSitemapXml` | kept (V1 names) |
| `buildLlmsFiles` | `buildLlmsTxt` + `buildLlmsFullTxt` (split into two functions) |
| `buildLlmsTxt` / `buildLlmsFullTxt` | kept (V1 names) |
| `fetchGithubMetadata` | kept (V1 name) |
| `enrichFromGithubHtml` | kept (V1 name) |
| `ghFetch` / `pLimit` | internal to `github-client.ts`; not part of the V1 public surface |
| `pickReviewCandidates` | `pickCleanupCandidates` |
| `buildReviewReport` | removed (the cleanup report is a side effect of `pickCleanupCandidates`) |
| `parseAppYaml` | removed (V0 `apps` model is gone; use `readYamlFile` + Zod parse) |
| `normalizeAppRecord` / `toIndexApp` | internal to `build-data.ts`; not part of the V1 public surface |
| `validateProject` / `validateAppRecord` | removed (replaced by `generate` which surfaces validation errors) |

## Development

```bash
pnpm --filter @grove-dev/core build
pnpm --filter @grove-dev/core check
```

## License

MIT
