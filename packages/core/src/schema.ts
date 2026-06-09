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
// Records file (one or many resources per file is also supported)
// ──────────────────────────────────────────────────────────────────────

export const recordsFileSchema = z.union([
  z.array(resourceSchema),
  z.object({ records: z.array(resourceSchema) }),
]);

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

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export function unwrapRecords(value: RecordsFile): Resource[] {
  return Array.isArray(value) ? value : value.records;
}

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
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/**
 * Normalize a raw record mapping into a typed Resource. The `kind`
 * field must match the blueprint of the site that owns the record;
 * mismatch produces a clear ZodError.
 */
export function normalizeRecord(
  raw: Record<string, unknown>,
  fileSlug: string,
  blueprint: Blueprint = "project-directory",
): Resource {
  const expectedKind = blueprintKind[blueprint];
  if (!raw.kind) {
    raw = { ...raw, kind: expectedKind };
  } else if (raw.kind !== expectedKind) {
    throw new Error(
      `${fileSlug}: kind "${raw.kind}" does not match blueprint "${blueprint}" (expected "${expectedKind}")`,
    );
  }
  return resourceSchema.parse(raw) as Resource;
}

export function validateRecord(
  raw: Record<string, unknown>,
  fileSlug: string,
  blueprint?: Blueprint,
): string[] {
  try {
    normalizeRecord(raw, fileSlug, blueprint);
    return [];
  } catch (err) {
    if (err instanceof z.ZodError) {
      return err.issues.map(
        (issue) => `${fileSlug}: ${issue.path.join(".") || "(root)"} ${issue.message}`,
      );
    }
    return [`${fileSlug}: ${(err as Error).message}`];
  }
}

/**
 * Project a Resource to a stable, search-index-friendly summary
 * object. Strips out blueprint-specific heavy fields and leaves
 * only what the public list/detail UIs need.
 */
export function toIndexRecord(record: Resource): Record<string, unknown> {
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
    return {
      ...base,
      name: record.name,
      stack: record.stack,
      stacks: record.stacks ?? [],
      platforms: record.platforms ?? [],
      projectType: record.projectType,
      bestFor: record.bestFor,
      whyListed: record.whyListed,
      caveats: record.caveats,
      github: record.github?.repository
        ? {
            fullName: record.github.repository.full_name,
            stars: record.github.repository.stargazers_count ?? 0,
            forks: record.github.repository.forks_count ?? 0,
            openIssues: record.github.repository.open_issues_count ?? 0,
            language: record.github.repository.language ?? null,
            pushedAt: record.github.repository.pushed_at ?? null,
            archived: Boolean(record.github.repository.archived),
          }
        : undefined,
    };
  }

  if (record.kind === "resource") {
    return {
      ...base,
      title: record.title,
      type: record.type,
      topic: record.topic,
      related: record.related,
      publishedAt: record.publishedAt,
      author: record.author,
    };
  }

  // entity
  return {
    ...base,
    name: record.name,
    type: record.type,
    founded: record.founded,
    location: record.location,
    members: record.members,
    parent: record.parent,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Health signal derivation
// ──────────────────────────────────────────────────────────────────────

function daysSince(value: string | null | undefined): number {
  if (!value) return Infinity;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return Infinity;
  return (Date.now() - d.valueOf()) / 86_400_000;
}

export function healthFromSignals(params: {
  repo?: z.infer<typeof githubRepositorySchema>;
  monthlyCommits?: Array<number | { month: string; commits: number }>;
}): {
  status: z.infer<typeof healthStatusSchema>;
  tier: z.infer<typeof healthTierSchema>;
  visibility: z.infer<typeof decisionVisibilitySchema>;
  cleanupCandidate: boolean;
  staleReason: string | null;
} {
  const { repo, monthlyCommits } = params;
  const stars = repo?.stargazers_count ?? 0;
  const lastCommitAt = repo?.pushed_at;
  const archived = Boolean(repo?.archived);
  const disabled = Boolean(repo?.disabled);
  const staleDays = daysSince(lastCommitAt);
  const activeMonths = Array.isArray(monthlyCommits)
    ? monthlyCommits.filter((m) => {
        const commits = typeof m === "number" ? m : m?.commits;
        return Number(commits) > 0;
      }).length
    : 0;

  const status: z.infer<typeof healthStatusSchema> = archived
    ? "archived"
    : disabled
      ? "unavailable"
      : staleDays <= 180
        ? "active"
        : staleDays <= 365
          ? "quiet"
          : staleDays <= 730
            ? "stale"
            : "inactive";

  const tier: z.infer<typeof healthTierSchema> =
    status === "archived" || status === "unavailable"
      ? "hidden"
      : stars >= 500 || activeMonths >= 4
        ? "curated"
        : stars >= 50
          ? "listed"
          : "experimental";

  return {
    status,
    tier,
    visibility: tier === "hidden" ? "hide" : "keep",
    cleanupCandidate:
      status === "stale" ||
      status === "archived" ||
      status === "inactive" ||
      status === "unavailable",
    staleReason:
      status === "inactive"
        ? "no_commits_24_months"
        : status === "stale"
          ? "no_commits_365_days"
          : status === "archived"
            ? "github_archived"
            : status === "unavailable"
              ? "github_unavailable"
              : null,
  };
}
