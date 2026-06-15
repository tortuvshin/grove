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
export type { GroveConfig } from "./schema.js";

// ── Schemas (Zod) ─────────────────────────────────────────────────────
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
} from "./schema.js";

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
} from "./schema.js";

// ── Build pipeline (library form of `grove generate`) ────────────────
export { generate } from "./build-data.js";
export type { GenerateResult, RecordsFullPayload, RecordsIndexPayload } from "./build-data.js";

// ── Sitemap (library form of `grove sitemap`) ────────────────────────
export { buildSitemap, buildSitemapXml } from "./sitemap.js";

// ── llms.txt (library form of `grove llms`) ───────────────────────────
export { buildLlmsTxt, buildLlmsFullTxt } from "./llms.js";
export type { LlmsInput, LlmsRecordInput, LlmsResult } from "./llms.js";

// ── Cleanup (library form of `grove cleanup stale`) ──────────────────
export { pickCleanupCandidates } from "./decisions.js";
export type { CleanupCandidate, CleanupReport } from "./decisions.js";

// ── GitHub: parsing + REST metadata ──────────────────────────────────
export { parseGithubRepoUrl, fetchGithubMetadata } from "./github.js";
export type { GithubRepoRef } from "./github.js";

// ── GitHub: HTML enrichment (token-free fallback) ────────────────────
export { enrichFromGithubHtml } from "./enrich.js";
export type { EnrichedFields, EnrichResult } from "./enrich.js";

// ── GitHub: client helpers (V1 public subset) ────────────────────────
export { rateLimitWaitMs, sleep } from "./github-client.js";
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
// `validateProject` is the library form of `grove validate`. It is
// kept in the V1 surface because the CLI's `validate` command needs
// the structured issue output (codes + messages) that `generate`'s
// throw path does not produce. This is the only V0-era name that
// survives — every other removed name from V0 is gone.
export { validateProject } from "./validate.js";
export type { ValidationResult, ValidationIssue, ValidationSeverity } from "./validate.js";
