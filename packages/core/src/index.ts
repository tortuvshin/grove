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

export type {
  AuditResult,
  BudgetConfig,
  BudgetViolation,
  LighthouseMetrics,
  LighthouseScores,
  PageManifestEntry,
  PageType,
  Profile,
} from './audit.js';
export {
  DEFAULT_BUDGET,
  evaluateBudget,
} from './audit.js';
export type {
  AwesomeReadmeCategory,
  AwesomeReadmeInput,
  AwesomeReadmeOptions,
  AwesomeReadmeRecord,
  AwesomeReadmeSections,
} from './awesome-readme.js';
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
} from './awesome-readme.js';
export type { GenerateResult, RecordsFullPayload, RecordsIndexPayload } from './build-data.js';
// ── Build pipeline ───────────────────────────────────────────────────
export { generate } from './build-data.js';
export type {
  CandidateEntry,
  CandidateLink,
  CandidateSource,
  ExtractCandidatesOptions,
} from './candidate.js';
// ── Candidate extraction (AST-based, source-preserving) ──────────────
export { extractCandidates } from './candidate.js';
export type {
  Collection,
  CollectionEditorial,
  CollectionEntry,
  CollectionKind,
  CollectionQuery,
  CollectionRanking,
  CollectionSeo,
  RankingPreset,
} from './collections.js';
// ── Collection engine (query, ranking, editorial) ────────────────────
export {
  filterEntries,
  rankEntries,
} from './collections.js';
// ── Collection IO (YAML loading from data/collections) ───────────────
export { loadCollections } from './collections-io.js';
export type { CollectionResult } from './collector.js';
// ── Collection runner + related resolver ─────────────────────────────
export { runCollection } from './collector.js';
export { defineConfig, loadConfig } from './config.js';
export type {
  ExtractTocOptions,
  ReadContentFileResult,
  ReadingMetrics,
  ReadingMetricsOptions,
  TocEntry,
} from './content-body.js';
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
} from './content-body.js';
export type {
  Contributor,
  ContributorSyncResult,
  SyncContributorsOptions,
} from './contributors.js';
// ── Contributor aggregation ───────────────────────────────────────────
export { syncContributors } from './contributors.js';
export type { CleanupCandidate, CleanupReport } from './decisions.js';
// ── Cleanup ──────────────────────────────────────────────────────────
export { cleanupStale, pickCleanupCandidates } from './decisions.js';
// ── Directory presentation model ────────────────────────────────────
// Framework-independent logic shared by Astro pages and any future
// renderer. These helpers intentionally know nothing about Astro, HTML,
// generated file locations, or component structure.
export * from './directory-display.js';
export * from './directory-facets.js';
export type {
  DirectoryFilterGroupKey,
  DirectoryFilterLabel,
  DirectoryFilterParamKey,
  DirectoryTaxonomyKind,
} from './directory-filter-keys.js';
// ── Directory filter keys (single source of truth, see §22) ──────────
// One canonical mapping between facet group keys, URL param keys,
// taxonomy kinds, and display labels. Replaces three duplicated
// inline copies that pre-v1 lived in DirectoryIndexClient,
// RefinePanel, and server/directory.
export {
  DIRECTORY_FILTER_KEYS,
  DIRECTORY_FILTER_LABELS,
  DIRECTORY_TAXONOMY_KINDS,
  FACET_DIMENSION_FOR_KEY,
  isDirectoryFilterGroupKey,
} from './directory-filter-keys.js';
export * from './directory-format.js';
export * from './directory-lenses.js';
export * from './directory-repo.js';
export * from './directory-scores.js';
export * from './directory-search.js';
export * from './directory-taxonomy.js';
export type { EnrichedFields, EnrichResult } from './enrich.js';
// ── GitHub: HTML enrichment (token-free fallback) ────────────────────
export { enrichFromGithubHtml } from './enrich.js';
export type { GithubRepoRef } from './github.js';
// ── GitHub: parsing + REST metadata ──────────────────────────────────
export {
  buildGithubSyncPatch,
  fetchGithubMetadata,
  parseGithubRepoUrl,
  pruneLegacyGithubFields,
} from './github.js';
export type { GhFetchOptions } from './github-client.js';
// ── GitHub: client helpers (V1 public subset) ────────────────────────
export { rateLimitWaitMs, sleep } from './github-client.js';
// ── Health: classification ────────────────────────────────────────────
export { classifyHealth } from './health.js';
// ── Host helper ──────────────────────────────────────────────────────
// Shared by `site-artifacts.ts` (static OG SVG) and `og-image.ts`
// (per-page PNG cards). One implementation so the two social-card
// surfaces never print different hosts for the same config.
export { hostOf } from './host.js';
export { importAwesomeList, writeImportedRecords } from './importer.js';
// ── IO helpers ────────────────────────────────────────────────────────
export { readYamlFile, writeTextFile, writeYamlFile } from './io.js';
export type { LlmsInput, LlmsRecordInput, LlmsResult } from './llms.js';
// ── llms.txt ─────────────────────────────────────────────────────────
export { buildLlmsFiles, buildLlmsFullTxt, buildLlmsTxt } from './llms.js';
export type {
  ImportedRecord,
  ImportResult,
  ImportSummary,
} from './markdown.js';
// ── Importers / parsers ──────────────────────────────────────────────
export {
  detectGithubRepo,
  parseAwesomeMarkdown,
} from './markdown.js';
export type { OgBuildInput, OgBuildResult, OgTemplate } from './og-image.js';
export { buildOgImages, renderOgPng } from './og-image.js';
export type {
  CollectionInput,
  ContentInput,
  Crumb,
  DocumentPageType,
  JsonLdNode,
  JsonLdValidationIssue,
  LinkedDocument,
  OpenGraphMetadata,
  PageDiscovery,
  PageDocument,
  PageIdentity,
  PageMetadata,
  RecordInput,
  SiteInput,
  TwitterMetadata,
} from './page-document.js';
// ── PageDocument: unified page-level contract + JSON-LD registry ────
// Every page in a Grove project declares a `PageDocument` and the
// framework emits all SEO metadata (title, description, canonical, OG,
// Twitter, JSON-LD) from this single source. `validateJsonLd` is the
// build-time well-formedness check that runs over the node graph.
export {
  breadcrumbSchema,
  buildJsonLd,
  collectionSchema,
  contentSchema,
  definePageDocument,
  recordSchema,
  siteSchema,
  validateJsonLd,
} from './page-document.js';
export type { ParsedEntry, ParsedSection } from './parseReadme.js';
export { parseEntry, parseSections } from './parseReadme.js';
export type { PrepareDirectoryResult } from './prepare.js';
export { prepareDirectory } from './prepare.js';
export { findRelated } from './related.js';
// ── Robots + filter URL policy ───────────────────────────────────────
export { buildRobotsTxt, isIndexableFilterPath } from './robots.js';
// ── Schema-derived types ─────────────────────────────────────────────
export type {
  AppLabel,
  Blueprint,
  Decision,
  DecisionsFile,
  DecisionVisibility,
  EntityRecord,
  EntityType,
  GithubIntegrationFlags,
  GithubMetadata,
  GithubRepository,
  GroveConfig,
  GroveConfigInput,
  HealthEntry,
  HealthFile,
  HealthStatus,
  HealthTier,
  IndexEntityRecord,
  IndexProjectRecord,
  IndexRecord,
  IndexResourceRecord,
  Links,
  Override,
  OverridesFile,
  ProjectRecord,
  ProjectType,
  ReadmeConfig,
  Resource,
  ResourceKind,
  ResourceRecord,
  ResourceType,
  Score,
} from './schema.js';
// ── Record YAML helpers (used by `grove import` and the generator) ──
export {
  appLabelSchema,
  auditSchema,
  blueprintKind,
  blueprintSchema,
  decisionSchema,
  decisionsFileSchema,
  entityRecordSchema,
  entityTypeSchema,
  githubLicenseSchema,
  githubMetadataSchema,
  githubRepositorySchema,
  healthBlockSchema,
  healthEntrySchema,
  healthFileSchema,
  healthStatusSchema,
  healthTierSchema,
  linksSchema,
  normalizeGithubIntegration,
  overrideSchema,
  overridesFileSchema,
  projectRecordSchema,
  projectTypeSchema,
  readmeConfigSchema,
  recordsFileSchema,
  resourceKindSchema,
  resourceRecordSchema,
  resourceSchema,
  resourceTypeSchema,
  scoreSchema,
  stringifyRecordYaml,
} from './schema.js';
export type {
  SiteArtifactStats,
  SiteArtifactsResult,
} from './site-artifacts.js';
// ── Config-driven public artifacts ──────────────────────────────────
export { buildOgImageSvg, buildSiteArtifacts } from './site-artifacts.js';
// ── Sitemap ──────────────────────────────────────────────────────────
export { buildSitemap, buildSitemapXml } from './sitemap.js';
// ── Schemas (Zod) ─────────────────────────────────────────────────────
// ── Slug helpers ───────────────────────────────────────────────────
// Public because the markdown renderer in @grove-dev/astro imports
// `uniqueSlug` to give heading anchors a collision-counter that
// matches the IDs `extractToc` produces from the same body.
export { slugify, uniqueSlug } from './slug.js';
export type { IconSyncOptions, IconSyncResult } from './sync-icons.js';
// ── Packaged icon assets ────────────────────────────────────────────
export { syncIconAssets } from './sync-icons.js';
export type { InferStackInput } from './taxonomy-inference.js';
// ── Taxonomy inference (stack suggestion from GitHub metadata) ───────
export { inferStackFromTopics } from './taxonomy-inference.js';
export type { ValidationIssue, ValidationResult, ValidationSeverity } from './validate.js';
// ── Validation ────────────────────────────────────────────────────────
// `validateProject` is kept public because the CLI's `check` command needs
// the structured issue output (codes + messages) that `generate`'s
// throw path does not produce. This is the only V0-era name that
// survives — every other removed name from V0 is gone.
export { validateProject } from './validate.js';
export type { ParsedRepo } from './yaml.js';
// ── YAML string helpers (submit form, future CLI emit) ───────────────
// Pure, dependency-free. Safe to use in browser (live preview) and
// in Node (server-side YAML generation).
export {
  parseGithubRepo,
  recordSlugify,
  yamlLines,
  yamlQuote,
} from './yaml.js';
