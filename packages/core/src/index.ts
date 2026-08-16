/**
 * @grove-dev/core — headless engine for Grove.
 *
 * V1 public surface (locked). The list below is the complete set of
 * symbols exported by this package — every other symbol is internal
 * and may change without notice.
 *
 * To audit: `grep -E '^export ' src/index.ts | sort`
 */
// ── Config ────────────────────────────────────────────────────────────
export { defineConfig, loadConfig } from "./config.js";
export type { GroveConfig, GroveConfigInput } from "./schema.js";

// ── Schemas (Zod) ─────────────────────────────────────────────────────
// ── Slug helpers ───────────────────────────────────────────────────
// Public because the markdown renderer in @grove-dev/astro imports
// `uniqueSlug` to give heading anchors a collision-counter that
// matches the IDs `extractToc` produces from the same body.
export { slugify, uniqueSlug } from "./slug.js";

export {
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
  resourceSchema,
  recordsFileSchema,
  projectTypeSchema,
  resourceTypeSchema,
  entityTypeSchema,
  appLabelSchema,
  scoreSchema,
  linksSchema,
  githubRepositorySchema,
  githubMetadataSchema,
  githubLicenseSchema,
  blueprintKind,
  auditSchema,
  readmeConfigSchema,
  normalizeGithubIntegration,
} from "./schema.js";
export type { GithubIntegrationFlags } from "./schema.js";

// ── Schema-derived types ─────────────────────────────────────────────
export type {
  Blueprint,
  ResourceKind,
  DecisionVisibility,
  Resource,
  ProjectRecord,
  ResourceRecord,
  EntityRecord,
  IndexRecord,
  IndexProjectRecord,
  IndexResourceRecord,
  IndexEntityRecord,
  HealthStatus,
  HealthTier,
  HealthEntry,
  HealthFile,
  Decision,
  DecisionsFile,
  Override,
  OverridesFile,
  ProjectType,
  ResourceType,
  EntityType,
  AppLabel,
  Score,
  Links,
  GithubMetadata,
  GithubRepository,
  ReadmeConfig,
} from "./schema.js";

// ── Build pipeline ───────────────────────────────────────────────────
export { generate } from "./build-data.js";
export type { GenerateResult, RecordsFullPayload, RecordsIndexPayload } from "./build-data.js";
export { prepareDirectory } from "./prepare.js";
export type { PrepareDirectoryResult } from "./prepare.js";

// ── Record YAML helpers (used by `grove import` and the generator) ──
export { stringifyRecordYaml } from "./schema.js";

// ── Sitemap ──────────────────────────────────────────────────────────
export { buildSitemap, buildSitemapXml } from "./sitemap.js";

// ── llms.txt ─────────────────────────────────────────────────────────
export { buildLlmsTxt, buildLlmsFullTxt, buildLlmsFiles } from "./llms.js";
export type { LlmsInput, LlmsRecordInput, LlmsResult } from "./llms.js";

// ── Awesome-list README ──────────────────────────────────────────────
// Generates a canonical sindresorhus/awesome-format README from the
// same record stream used by llms.txt. The output is wrapped between
// `<!-- grove-readme:start -->` / `<!-- grove-readme:end -->` sentinels
// so hand-written intro/contributing sections survive regenerations.
export {
  AWESOME_README_END,
  AWESOME_README_START,
  buildAwesomeReadme,
  injectAwesomeReadmeBlock,
  parseAwesomeReadmeSections,
} from "./awesome-readme.js";
export type {
  AwesomeReadmeCategory,
  AwesomeReadmeInput,
  AwesomeReadmeOptions,
  AwesomeReadmeRecord,
  AwesomeReadmeSections,
} from "./awesome-readme.js";

// ── Config-driven public artifacts ──────────────────────────────────
export { buildOgImageSvg, buildSiteArtifacts } from "./site-artifacts.js";
export type {
  SiteArtifactStats,
  SiteArtifactsResult,
} from "./site-artifacts.js";

// ── Packaged icon assets ────────────────────────────────────────────
export { syncIconAssets } from "./sync-icons.js";
export type { IconSyncOptions, IconSyncResult } from "./sync-icons.js";

// ── Cleanup ──────────────────────────────────────────────────────────
export { pickCleanupCandidates, cleanupStale } from "./decisions.js";
export type { CleanupCandidate, CleanupReport } from "./decisions.js";

// ── GitHub: parsing + REST metadata ──────────────────────────────────
export { parseGithubRepoUrl, fetchGithubMetadata, buildGithubSyncPatch } from "./github.js";
export type { GithubRepoRef } from "./github.js";

// ── GitHub: HTML enrichment (token-free fallback) ────────────────────
export { enrichFromGithubHtml } from "./enrich.js";
export type { EnrichedFields, EnrichResult } from "./enrich.js";

// ── GitHub: client helpers (V1 public subset) ────────────────────────
export { rateLimitWaitMs, sleep } from "./github-client.js";

// ── Contributor aggregation ───────────────────────────────────────────
export { syncContributors } from "./contributors.js";
export type {
  Contributor,
  ContributorSyncResult,
  SyncContributorsOptions,
} from "./contributors.js";
export type { GhFetchOptions } from "./github-client.js";

// ── Health: classification ────────────────────────────────────────────
export { classifyHealth } from "./health.js";

// ── Importers / parsers ──────────────────────────────────────────────
export {
  detectGithubRepo,
  parseAwesomeMarkdown,
} from "./markdown.js";
export type {
  ImportedRecord,
  ImportSummary,
  ImportResult,
} from "./markdown.js";
export { importAwesomeList, writeImportedRecords } from "./importer.js";
export { parseEntry, parseSections } from "./parseReadme.js";
export type { ParsedEntry, ParsedSection } from "./parseReadme.js";

// ── IO helpers ────────────────────────────────────────────────────────
export { readYamlFile, writeYamlFile, writeTextFile } from "./io.js";

// ── Validation ────────────────────────────────────────────────────────
// `validateProject` is kept public because the CLI's `check` command needs
// the structured issue output (codes + messages) that `generate`'s
// throw path does not produce. This is the only V0-era name that
// survives — every other removed name from V0 is gone.
export { validateProject } from "./validate.js";
export type { ValidationResult, ValidationIssue, ValidationSeverity } from "./validate.js";

// ── Directory presentation model ────────────────────────────────────
// Framework-independent logic shared by Astro pages and any future
// renderer. These helpers intentionally know nothing about Astro, HTML,
// generated file locations, or component structure.
export * from "./directory-display.js";
export * from "./directory-facets.js";
export * from "./directory-format.js";
export * from "./directory-lenses.js";
export * from "./directory-repo.js";
export * from "./directory-scores.js";
export * from "./directory-search.js";
export * from "./directory-taxonomy.js";

// ── Content body ───────────────────────────────────────────────────
// Pure helpers for reading and shaping the Markdown sidecar that
// accompanies each record. No I/O of their own beyond `node:fs` for
// the optional `readContentFile`; safe to import from server-only
// contexts (Astro `getStaticPaths`, build scripts).
export {
  extractToc,
  headingSlug,
  readContentFile,
  readingMetrics,
  resolveContentPath,
  stripFrontmatter,
} from "./content-body.js";
export type {
  ExtractTocOptions,
  ReadContentFileResult,
  ReadingMetrics,
  ReadingMetricsOptions,
  TocEntry,
} from "./content-body.js";

export {
  DEFAULT_BUDGET,
  evaluateBudget,
} from "./audit.js";
export type {
  PageType,
  Profile,
  PageManifestEntry,
  LighthouseScores,
  LighthouseMetrics,
  AuditResult,
  BudgetConfig,
  BudgetViolation,
} from "./audit.js";

// ── PageDocument: unified page-level contract + JSON-LD registry ────
// Every page in a Grove project declares a `PageDocument` and the
// framework emits all SEO metadata (title, description, canonical, OG,
// Twitter, JSON-LD) from this single source. `validateJsonLd` is the
// build-time well-formedness check that runs over the node graph.
export {
  definePageDocument,
  siteSchema,
  breadcrumbSchema,
  collectionSchema,
  recordSchema,
  contentSchema,
  buildJsonLd,
  validateJsonLd,
} from "./page-document.js";
export type {
  DocumentPageType,
  OpenGraphMetadata,
  TwitterMetadata,
  PageMetadata,
  LinkedDocument,
  JsonLdNode,
  PageDiscovery,
  PageIdentity,
  PageDocument,
  Crumb,
  SiteInput,
  CollectionInput,
  RecordInput,
  ContentInput,
  JsonLdValidationIssue,
} from "./page-document.js";

// ── Robots + filter URL policy ───────────────────────────────────────
export { buildRobotsTxt, isIndexableFilterPath } from "./robots.js";

// ── Collection engine (query, ranking, editorial) ────────────────────
export {
  filterEntries,
  rankEntries,
} from "./collections.js";
export type {
  CollectionKind,
  RankingPreset,
  CollectionQuery,
  CollectionRanking,
  CollectionEditorial,
  CollectionSeo,
  Collection,
  CollectionEntry,
} from "./collections.js";

// ── Collection runner + related resolver ─────────────────────────────
export { runCollection } from "./collector.js";
export type { CollectionResult } from "./collector.js";
export { findRelated } from "./related.js";

// ── Collection IO (YAML loading from data/collections) ───────────────
export { loadCollections } from "./collections-io.js";
