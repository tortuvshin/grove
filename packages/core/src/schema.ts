import { z } from "zod";
import { parse, stringify } from "yaml";

// ──────────────────────────────────────────────────────────────────────
// Blueprints and kinds
// ──────────────────────────────────────────────────────────────────────

/**
 * A blueprint defines the shape and behavior of a Grove site.
 *
 * V1 ships three fixed blueprints. They are not extensible — no custom
 * blueprint API in V1.
 */
export const blueprintSchema = z.enum([
  "project-directory",
  "resource-hub",
  "ecosystem-map",
]);

export type Blueprint = z.infer<typeof blueprintSchema>;

/**
 * Each blueprint is bound to a single resource kind. Records are
 * discriminated by `kind`, which must match the blueprint of the site
 * that owns them.
 */
export const resourceKindSchema = z.enum(["project", "resource", "entity"]);

export type ResourceKind = z.infer<typeof resourceKindSchema>;

export const blueprintKind: Record<Blueprint, ResourceKind> = {
  "project-directory": "project",
  "resource-hub": "resource",
  "ecosystem-map": "entity",
};

// ──────────────────────────────────────────────────────────────────────
// Health & decision labels
// ──────────────────────────────────────────────────────────────────────

export const healthStatusSchema = z.enum([
  "active",
  "mature",
  "stale",
  "inactive",
  "archived",
  "unknown",
  "historical",
  "needs_review",
  "quiet",
  "unavailable",
]);

export const decisionVisibilitySchema = z.enum([
  "highlight",
  "keep",
  "needs_review",
  "hide",
  "remove",
  "historical",
]);

export type DecisionVisibility = z.infer<typeof decisionVisibilitySchema>;

export const healthTierSchema = z.enum([
  "curated",
  "listed",
  "experimental",
  "hidden",
]);

// ──────────────────────────────────────────────────────────────────────
// Curation enums (shared)
// ──────────────────────────────────────────────────────────────────────

export const projectTypeSchema = z.enum([
  "real-app",
  "production",
  "reference",
  "library",
  "tool",
  "demo",
  "template",
  "historical",
]);

export const resourceTypeSchema = z.enum([
  "guide",
  "comparison",
  "link",
  "explainer",
  "tool",
  "video",
  "article",
  "course",
  "book",
  "podcast",
  "other",
]);

export const entityTypeSchema = z.enum([
  "company",
  "organization",
  "community",
  "school",
  "university",
  "research-lab",
  "agency",
  "service",
  "product",
  "person",
  "other",
]);

export const appLabelSchema = z.enum(["new", "hot", "mature", "featured"]);

export const scoreSchema = z.object({
  activity: z.number().min(0).max(100).optional(),
  maturity: z.number().min(0).max(100).optional(),
  learning: z.number().min(0).max(100).optional(),
  contribution: z.number().min(0).max(100).optional(),
  docs: z.number().min(0).max(100).optional(),
  overall: z.number().min(0).max(100).optional(),
});

// ──────────────────────────────────────────────────────────────────────
// Links
// ──────────────────────────────────────────────────────────────────────

export const linksSchema = z
  .object({
    github: z.string().url().optional(),
    website: z.string().url().optional(),
    docs: z.string().url().optional(),
    source: z.string().url().optional(),
  })
  .catchall(z.string().url())
  .default({});

// ──────────────────────────────────────────────────────────────────────
// Health metadata
// ──────────────────────────────────────────────────────────────────────

export const githubLicenseSchema = z
  .object({
    key: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    spdx_id: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  })
  .passthrough()
  .nullable()
  .optional();

export const githubRepositorySchema = z
  .object({
    id: z.number().optional(),
    node_id: z.string().optional(),
    name: z.string().optional(),
    full_name: z.string().optional(),
    html_url: z.string().url().optional(),
    clone_url: z.string().optional(),
    ssh_url: z.string().optional(),
    homepage: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    fork: z.boolean().optional(),
    archived: z.boolean().optional(),
    disabled: z.boolean().optional(),
    private: z.boolean().optional(),
    is_template: z.boolean().optional(),
    visibility: z.string().optional(),
    default_branch: z.string().optional(),
    language: z.string().nullable().optional(),
    topics: z.array(z.string()).optional(),
    license: githubLicenseSchema,
    stargazers_count: z.number().optional(),
    watchers_count: z.number().optional(),
    forks_count: z.number().optional(),
    open_issues_count: z.number().optional(),
    subscribers_count: z.number().optional(),
    size: z.number().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
    pushed_at: z.string().nullable().optional(),
  })
  .passthrough();

export const githubMetadataSchema = z.object({
  fullName: z.string().optional(),
  stars: z.number().int().nonnegative().default(0),
  forks: z.number().int().nonnegative().default(0),
  openIssues: z.number().int().nonnegative().optional(),
  watchers: z.number().int().nonnegative().optional(),
  archived: z.boolean().default(false),
  disabled: z.boolean().optional(),
  private: z.boolean().optional(),
  visibility: z.string().optional(),
  pushedAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  latestReleaseAt: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  topics: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  defaultBranch: z.string().optional(),
  languages: z.record(z.string(), z.number()).optional(),
  contributorsKnown: z.number().int().nonnegative().optional(),
  totalCommitsKnown: z.number().int().nonnegative().optional(),
  openPullRequests: z.number().int().nonnegative().optional(),
  description: z.string().nullable().optional(),
  homepage: z.string().nullable().optional(),
  files: z.record(z.string(), z.boolean()).optional(),
  monthlyCommits: z
    .array(
      z.union([
        z.number(),
        z.object({ month: z.string(), commits: z.number() }),
      ]),
    )
    .optional(),
});

export const healthBlockSchema = z.object({
  status: healthStatusSchema.default("unknown"),
  maturity: z.enum(["experimental", "useful", "mature", "unknown"]).default("unknown"),
  tier: healthTierSchema.default("experimental"),
  visibility: decisionVisibilitySchema.default("keep"),
  cleanupCandidate: z.boolean().default(false),
  staleReason: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  reasons: z.array(z.string()).default([]),
});

export const healthEntrySchema = z.object({
  id: z.string().min(1),
  github: githubMetadataSchema.optional(),
  health: healthBlockSchema,
});

export const healthFileSchema = z.union([
  z.array(healthEntrySchema),
  z.object({ health: z.array(healthEntrySchema) }),
]);

// ──────────────────────────────────────────────────────────────────────
// Decisions (human curation layer)
// ──────────────────────────────────────────────────────────────────────

export const decisionSchema = z.object({
  id: z.string().min(1),
  decision: z.object({
    visibility: decisionVisibilitySchema,
    reason: z.string().min(1),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
  }),
});

export const decisionsFileSchema = z.union([
  z.array(decisionSchema),
  z.object({ decisions: z.array(decisionSchema) }),
]);

// ──────────────────────────────────────────────────────────────────────
// Overrides (manual corrections to imported records)
// ──────────────────────────────────────────────────────────────────────

export const overrideSchema = z.object({
  id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
});

export const overridesFileSchema = z.union([
  z.array(overrideSchema),
  z.object({ overrides: z.array(overrideSchema) }),
]);

// ──────────────────────────────────────────────────────────────────────
// Curation: shared block
// ──────────────────────────────────────────────────────────────────────

const curationBlockSchema = z
  .object({
    reviewed: z.boolean().default(false),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    notes: z.string().optional(),
    labels: z.array(appLabelSchema).default([]),
    lenses: z.array(z.string()).default([]),
  })
  .default({ reviewed: false, labels: [], lenses: [] });

// ──────────────────────────────────────────────────────────────────────
// Resource base (shared by all blueprints)
// ──────────────────────────────────────────────────────────────────────

const resourceBaseSchema = z.object({
  slug: z.string().min(1),
  description: z.string().default(""),
  category: z.string().min(1).default("uncategorized"),
  tags: z.array(z.string()).default([]),
  links: linksSchema,
  content: z.string().optional(), // path to markdown body under content/records/
  source: z
    .object({
      type: z.enum(["manual", "github-topic", "awesome-list", "submit", "import"])
        .default("manual"),
      file: z.string().optional(),
      url: z.string().optional(),
      provider: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
    })
    .default({ type: "manual" }),
  curation: curationBlockSchema,
  scores: scoreSchema.default({}),
  /**
   * Effective visibility after any decisions.yml override. For project
   * records the canonical signal lives in `health.visibility`; for
   * resource-hub / ecosystem-map records (which have no `health`
   * block) the top-level `visibility` is the source of truth.
   * Defaults to "keep" so existing YAML files without the field
   * continue to validate.
   */
  visibility: decisionVisibilitySchema.default("keep"),
});

// ──────────────────────────────────────────────────────────────────────
// Blueprint: project-directory — kind: project
// ──────────────────────────────────────────────────────────────────────

export const projectRecordSchema = resourceBaseSchema.extend({
  kind: z.literal("project"),
  name: z.string().min(1),
  projectType: projectTypeSchema.optional(),
  stack: z.string().optional(),
  stacks: z.array(z.string()).default([]),
  platforms: z.array(z.string()).default([]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  codebaseSize: z.enum(["small", "medium", "large", "huge"]).optional(),
  // Canonical repo URL. Distinct from `links.github`, which is the
  // human-facing link on the page; `repoUrl` is the single source
  // for owner/repo extraction, avatar fallback, and "view repo" CTAs.
  repoUrl: z.string().url().optional(),
  // Optional project logo/avatar URL. Falls back to the GitHub
  // owner avatar (when `repoUrl` is a github.com URL) or to the
  // first-2-letters initials placeholder.
  logoUrl: z.string().url().optional(),
  bestFor: z.array(z.string()).default([]),
  whyListed: z.array(z.string()).default([]),
  caveats: z.array(z.string()).default([]),
  distribution: z
    .object({
      channels: z
        .array(
          z
            .object({
              type: z.string().min(1),
              platform: z.string().optional(),
              label: z.string().optional(),
              url: z.string().url(),
              verified: z.boolean().optional(),
              notes: z.string().optional(),
            })
            .passthrough(),
        )
        .default([]),
    })
    .default({ channels: [] }),
  github: z
    .object({
      repository: githubRepositorySchema.optional(),
      languages: z.record(z.string(), z.number()).optional(),
      latestRelease: z.record(z.string(), z.unknown()).nullable().optional(),
      activity: z.record(z.string(), z.unknown()).optional(),
      files: z.record(z.string(), z.boolean()).optional(),
      labels: z.array(z.record(z.string(), z.unknown())).optional(),
      sync: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough()
    .optional(),
  health: healthBlockSchema.optional(),
});

export type ProjectRecord = z.infer<typeof projectRecordSchema>;

// ──────────────────────────────────────────────────────────────────────
// Blueprint: resource-hub — kind: resource
// ──────────────────────────────────────────────────────────────────────

export const resourceRecordSchema = resourceBaseSchema.extend({
  kind: z.literal("resource"),
  title: z.string().min(1),
  type: resourceTypeSchema,
  topic: z.string().min(1),
  related: z.array(z.string()).default([]), // slugs of related resources
  publishedAt: z.string().optional(),
  author: z.string().optional(),
});

export type ResourceRecord = z.infer<typeof resourceRecordSchema>;

// ──────────────────────────────────────────────────────────────────────
// Blueprint: ecosystem-map — kind: entity
// ──────────────────────────────────────────────────────────────────────

export const entityRecordSchema = resourceBaseSchema.extend({
  kind: z.literal("entity"),
  name: z.string().min(1),
  type: entityTypeSchema,
  founded: z.string().optional(),
  location: z.string().optional(),
  members: z.number().int().nonnegative().optional(),
  parent: z.string().optional(), // slug of parent entity
});

export type EntityRecord = z.infer<typeof entityRecordSchema>;

// ──────────────────────────────────────────────────────────────────────
// Discriminated union: Resource
// ──────────────────────────────────────────────────────────────────────

export const resourceSchema = z.discriminatedUnion("kind", [
  projectRecordSchema,
  resourceRecordSchema,
  entityRecordSchema,
]);

export type Resource = z.infer<typeof resourceSchema>;

// ──────────────────────────────────────────────────────────────────────
// Records file (V1: one resource per file)
// ──────────────────────────────────────────────────────────────────────
//
// V1 is intentionally narrow: one YAML file = one resource. The
// filename (minus `.yml`) is the canonical slug. This keeps PR
// review clean, removes an entire class of "which slug wins" bugs,
// and matches what every contributor actually wants to read.
//
// The previous "array or { records: [...] }" shape leaked into the
// parser and forced every consumer to call `unwrapRecords`. The
// `resourceSchema.parse(raw)` call below is now a direct mapping
// parse; multi-record files are a V2 feature and will live behind
// a separate `recordsBundleSchema`.

export const recordsFileSchema = resourceSchema;

export type RecordsFile = z.infer<typeof recordsFileSchema>;

// ──────────────────────────────────────────────────────────────────────
// Grove config
// ──────────────────────────────────────────────────────────────────────

export const navItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const githubIntegrationSchema = z.union([
  z.boolean(),
  z.object({
    metadata: z.boolean().default(false),
    contributors: z.boolean().default(false),
    health: z.boolean().default(false),
  }),
]);

export const themeSchema = z.object({
  primaryColor: z.string().default("#16a34a"),
  radius: z.enum(["none", "soft", "round"]).default("soft"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
  containerWidth: z.string().default("72rem"),
});

export const componentOverrideSchema = z.object({
  Header: z.string().optional(),
  Footer: z.string().optional(),
  Hero: z.string().optional(),
  ItemCard: z.string().optional(),
  DetailHeader: z.string().optional(),
});

export const groveConfigSchema = z.object({
  blueprint: blueprintSchema.default("project-directory"),

  site: z.object({
    name: z.string().min(1),
    tagline: z.string().default("A growing community knowledge site."),
    description: z.string().optional(),
    url: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
  }),

  nav: z.array(navItemSchema).default([]),

  /**
   * Optional URL slug overrides. By default the blueprint id maps
   * to a route — `project-directory` → `/projects/`,
   * `resource-hub` → `/resources/`, `ecosystem-map` → `/entities/`.
   * Override either field if you want a different path or singular
   * noun without forking the template (e.g. set `directory: "books"`
   * for a custom project-directory that presents as a book list).
   */
  routes: z
    .object({
      directory: z.string().optional(),
      item: z.string().optional(),
    })
    .default({}),

  /**
   * Optional display-name overrides. Default labels are derived
   * from the blueprint id (e.g. "project" / "projects" for
   * `project-directory`). Override either field for a friendlier
   * default — useful when the project is using a different noun
   * (e.g. set `singular: "guide"` to render "Submit a guide").
   */
  labels: z
    .object({
      singular: z.string().optional(),
      plural: z.string().optional(),
    })
    .default({}),

  facets: z.array(z.string()).default(["category", "tags"]),

  integrations: z
    .object({
      github: githubIntegrationSchema.default(false),
    })
    .default({ github: false }),

  theme: themeSchema.default({
    primaryColor: "#16a34a",
    radius: "soft",
    density: "comfortable",
    containerWidth: "72rem",
  }),

  components: componentOverrideSchema.default({}),

  paths: z
    .object({
      dataDir: z.string().default("data"),
      contentDir: z.string().default("content"),
      recordsDir: z.string().default("data/records"),
      pagesDir: z.string().default("content/pages"),
      bodiesDir: z.string().default("content/records"),
      publicDir: z.string().default("public"),
      taxonomyDir: z.string().default("data/taxonomy"),
      generatedDir: z.string().default("data/generated"),
      health: z.string().default("data/health.yml"),
      decisions: z.string().default("data/decisions.yml"),
      overrides: z.string().default("data/overrides.yml"),
    })
    .default({
      dataDir: "data",
      contentDir: "content",
      recordsDir: "data/records",
      pagesDir: "content/pages",
      bodiesDir: "content/records",
      publicDir: "public",
      taxonomyDir: "data/taxonomy",
      generatedDir: "data/generated",
      health: "data/health.yml",
      decisions: "data/decisions.yml",
      overrides: "data/overrides.yml",
    }),
});

export type GroveConfig = z.infer<typeof groveConfigSchema>;
export type NavItem = z.infer<typeof navItemSchema>;
export type GithubIntegration = z.infer<typeof githubIntegrationSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type ComponentOverride = z.infer<typeof componentOverrideSchema>;
export type GithubMetadata = z.infer<typeof githubMetadataSchema>;
export type GithubRepository = z.infer<typeof githubRepositorySchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthTier = z.infer<typeof healthTierSchema>;
export type HealthFile = z.infer<typeof healthFileSchema>;
export type HealthEntry = z.infer<typeof healthEntrySchema>;
export type DecisionsFile = z.infer<typeof decisionsFileSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type OverridesFile = z.infer<typeof overridesFileSchema>;
export type Override = z.infer<typeof overrideSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;
export type ResourceType = z.infer<typeof resourceTypeSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type AppLabel = z.infer<typeof appLabelSchema>;
export type Score = z.infer<typeof scoreSchema>;
export type Links = z.infer<typeof linksSchema>;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export function unwrapHealth(value: HealthFile): HealthEntry[] {
  return Array.isArray(value) ? value : value.health;
}

export function unwrapDecisions(value: DecisionsFile): Decision[] {
  return Array.isArray(value) ? value : value.decisions;
}

export function unwrapOverrides(value: OverridesFile): Override[] {
  return Array.isArray(value) ? value : value.overrides;
}

/**
 * Parse a single record YAML mapping into a typed Resource. The
 * `kind` field on the YAML selects which blueprint schema to apply.
 */
export function parseRecordYaml(
  text: string,
  fileSlug: string,
): Record<string, unknown> {
  const raw = parse(text) ?? {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${fileSlug}: record file must contain a YAML mapping`);
  }
  return raw;
}

export function stringifyRecordYaml(record: Record<string, unknown>): string {
  return stringify(record, {
    lineWidth: 100,
    singleQuote: false,
    defaultStringType: "PLAIN",
  });
}

export function getOwnerRepoFromUrl(
  repoUrl: string | undefined | null,
): { owner: string; repo: string } | null {
  if (!repoUrl) return null;
  const m = String(repoUrl).match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  const owner = m[1];
  const repo = m[2];
  if (!owner || !repo) return null;
  return { owner, repo: repo.replace(/\.git$/, "") };
}

// ──────────────────────────────────────────────────────────────────────
// Index payload types (records.index.json / records.full.json)
// ──────────────────────────────────────────────────────────────────────
//
// The slim projection `toIndexRecord` is the single source of truth
// for what ends up in `data/generated/records.index.json`. Adapters
// consume it as a discriminated union keyed by `kind`, so the type
// helpers below let a page write
//
//   if (r.kind === "project") { r.github.stars }
//
// without a `as ProjectRecord` cast. Projections are deliberately
// readonly; pages must not mutate the index payload.

export interface IndexBase {
  slug: string;
  kind: ResourceKind;
  category: string;
  tags: string[];
  links: Links;
  description: string;
  content?: string | undefined;
  curation: ProjectRecord["curation"];
}

export interface IndexGithubSummary {
  fullName: string | undefined;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  pushedAt: string | null;
  archived: boolean;
  license: string | null;
  topics: string[];
}

export interface IndexProjectRecord extends IndexBase {
  kind: "project";
  name: string;
  stack: ProjectRecord["stack"];
  stacks: string[];
  platforms: string[];
  projectType: ProjectRecord["projectType"];
  repoUrl: ProjectRecord["repoUrl"];
  logoUrl: ProjectRecord["logoUrl"];
  difficulty: ProjectRecord["difficulty"];
  codebaseSize: ProjectRecord["codebaseSize"];
  bestFor: string[];
  whyListed: string[];
  caveats: string[];
  health: ProjectRecord["health"];
  /** Effective visibility — decisions.yml overrides win over health. */
  visibility: DecisionVisibility;
  github: IndexGithubSummary | undefined;
}

export interface IndexResourceRecord extends IndexBase {
  kind: "resource";
  title: string;
  type: ResourceRecord["type"];
  topic: string;
  related: string[];
  publishedAt: ResourceRecord["publishedAt"];
  author: ResourceRecord["author"];
  /** Effective visibility — decisions.yml overrides win over the record default. */
  visibility: DecisionVisibility;
}

export interface IndexEntityRecord extends IndexBase {
  kind: "entity";
  name: string;
  type: EntityRecord["type"];
  founded: EntityRecord["founded"];
  location: EntityRecord["location"];
  members: EntityRecord["members"];
  parent: EntityRecord["parent"];
  /** Effective visibility — decisions.yml overrides win over the record default. */
  visibility: DecisionVisibility;
}

export type IndexRecord =
  | IndexProjectRecord
  | IndexResourceRecord
  | IndexEntityRecord;

export function isIndexProject(r: IndexRecord): r is IndexProjectRecord {
  return r.kind === "project";
}
export function isIndexResource(r: IndexRecord): r is IndexResourceRecord {
  return r.kind === "resource";
}
export function isIndexEntity(r: IndexRecord): r is IndexEntityRecord {
  return r.kind === "entity";
}

/**
 * Project a Resource to a stable, search-index-friendly summary
 * object. Strips out blueprint-specific heavy fields and leaves
 * only what the public list/detail UIs need.
 *
 * The return type is the discriminated `IndexRecord` union. The
 * function body uses a single `kind` literal cast per branch
 * because the `record.kind` is a `ResourceKind` (the union of
 * all three) and TypeScript cannot narrow the literal from a
 * runtime check alone. The casts are safe because each branch
 * is gated on the literal string compare.
 */
export function toIndexRecord(record: Resource): IndexRecord {
  const base = {
    slug: record.slug,
    kind: record.kind,
    category: record.category,
    tags: record.tags ?? [],
    links: record.links,
    description: record.description,
    content: record.content,
    curation: record.curation,
  };

  if (record.kind === "project") {
    const r = record;
    return {
      ...base,
      kind: "project" as const,
      name: r.name,
      stack: r.stack,
      stacks: r.stacks ?? [],
      platforms: r.platforms ?? [],
      projectType: r.projectType,
      repoUrl: r.repoUrl,
      logoUrl: r.logoUrl,
      difficulty: r.difficulty,
      codebaseSize: r.codebaseSize,
      bestFor: r.bestFor,
      whyListed: r.whyListed,
      caveats: r.caveats,
      // Health surfaced alongside the record so list/detail UIs can
      // show staleness/curation tier without a second lookup.
      health: r.health,
      // Visibility comes from either the health block (auto-derived
      // from signals) or the curation override (`decisions.yml`).
      // The generate step folds the latter in before serialising,
      // so this is a best-effort projection of the current state.
      visibility: r.health?.visibility ?? "keep",
      github: r.github?.repository
        ? {
            fullName: r.github.repository.full_name,
            stars: r.github.repository.stargazers_count ?? 0,
            forks: r.github.repository.forks_count ?? 0,
            openIssues: r.github.repository.open_issues_count ?? 0,
            language: r.github.repository.language ?? null,
            pushedAt: r.github.repository.pushed_at ?? null,
            archived: Boolean(r.github.repository.archived),
            license: r.github.repository.license?.spdx_id ?? null,
            topics: r.github.repository.topics ?? [],
          }
        : undefined,
    };
  }

  if (record.kind === "resource") {
    const r = record;
    return {
      ...base,
      kind: "resource" as const,
      title: r.title,
      type: r.type,
      topic: r.topic,
      related: r.related,
      publishedAt: r.publishedAt,
      author: r.author,
      // Non-project records store effective visibility at the top
      // level (no `health` block); applyDecision has already merged
      // any decisions.yml override into `r.visibility` by the time
      // we get here.
      visibility: r.visibility,
    };
  }

  // entity
  const e = record;
  return {
    ...base,
    kind: "entity" as const,
    name: e.name,
    type: e.type,
    founded: e.founded,
    location: e.location,
    members: e.members,
    parent: e.parent,
    visibility: e.visibility,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Health classification
// ──────────────────────────────────────────────────────────────────────
//
// The single source of truth for health derivation is `classifyHealth`
// in `./health.js`. It takes a normalized `GithubMetadata` and returns
// a full `HealthEntry` (id + github + health block). The earlier
// `healthFromSignals` helper (raw `githubRepositorySchema` + monthly
// commits input) was deleted: it had different thresholds from
// `classifyHealth` and no remaining callers. New code that needs
// health should import `classifyHealth` from `@grove-dev/core`.
