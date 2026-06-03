import { z } from "zod";
import { parse, stringify } from "yaml";

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
// Curation: project shape
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

export const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export const codebaseSizeSchema = z.enum(["small", "medium", "large", "huge"]);
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
// Distribution channels
// ──────────────────────────────────────────────────────────────────────

export const distributionChannelTypeSchema = z.enum([
  "app-store",
  "play-store",
  "fdroid",
  "github-releases",
  "apk",
  "testflight",
  "website",
  "snapcraft",
  "flathub",
  "microsoft-store",
  "package-registry",
  "docs",
  "demo",
  "other",
]);

export const distributionChannelSchema = z.object({
  type: distributionChannelTypeSchema,
  platform: z.string().optional(),
  label: z.string().optional(),
  url: z.string().url(),
  verified: z.boolean().optional(),
  notes: z.string().optional(),
});

// ──────────────────────────────────────────────────────────────────────
// GitHub-shaped metadata
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

// ──────────────────────────────────────────────────────────────────────
// Stack (registry-backed taxonomy)
// ──────────────────────────────────────────────────────────────────────

export const stackTechnologySchema = z
  .object({
    id: z.string().min(1),
    role: z.string().optional(),
  })
  .passthrough();

export const stackSchema = z
  .object({
    primary: z.string().min(1),
    families: z.array(z.string()).optional(),
    technologies: z.array(stackTechnologySchema).optional(),
  })
  .passthrough();

export const stackRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  family: z.string().optional(),
  languages: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  icon: z.string().optional(),
  status: z.enum(["live", "expanding", "planned"]).optional(),
  blurb: z.string().optional(),
});

export const platformRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional(),
});

export const categoryRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  blurb: z.string().optional(),
});

export const distributionChannelRefSchema = z.object({
  id: distributionChannelTypeSchema,
  name: z.string().min(1),
  platforms: z.array(z.string()).optional(),
});

// ──────────────────────────────────────────────────────────────────────
// Item — generic open-source project record
// ──────────────────────────────────────────────────────────────────────

export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  links: z
    .object({
      github: z.string().url().optional(),
      website: z.string().url().optional(),
      docs: z.string().url().optional(),
      source: z.string().url().optional(),
    })
    .catchall(z.string().url())
    .default({}),
  source: z
    .object({
      type: z.enum(["markdown", "manual", "github-topic", "awesome-list", "submit"]).default("manual"),
      file: z.string().optional(),
      line: z.number().int().positive().optional(),
      url: z.string().optional(),
      provider: z.string().optional(),
      owner: z.string().optional(),
      repo: z.string().optional(),
    })
    .default({ type: "manual" }),
  taxonomy: z
    .object({
      category: z.string().min(1).default("uncategorized"),
      tags: z.array(z.string()).default([]),
      language: z.string().optional(),
      stack: z.string().optional(),
      stacks: z.array(z.string()).default([]),
      platforms: z.array(z.string()).default([]),
    })
    .default({
      category: "uncategorized",
      tags: [],
      stacks: [],
      platforms: [],
    }),
  labels: z.array(appLabelSchema).default([]),
  lenses: z.array(z.string()).default([]),
  distribution: z
    .object({
      channels: z.array(distributionChannelSchema).default([]),
    })
    .default({ channels: [] }),
  curation: z
    .object({
      projectType: projectTypeSchema.optional(),
      difficulty: difficultySchema.optional(),
      codebaseSize: codebaseSizeSchema.optional(),
      stateManagement: z.string().optional(),
      backend: z.string().optional(),
      architecture: z.string().optional(),
      bestFor: z.array(z.string()).default([]),
      whyListed: z.array(z.string()).default([]),
      caveats: z.array(z.string()).default([]),
      goodFirstIssues: z.union([z.boolean(), z.string().url()]).optional(),
      contributionGuide: z.union([z.boolean(), z.string().url()]).optional(),
      launchedBy: z.string().optional(),
      launchAsk: z.array(z.string()).default([]),
      reviewed: z.boolean().optional(),
      reviewedBy: z.string().optional(),
      reviewedAt: z.string().optional(),
      notes: z.string().optional(),
      scores: scoreSchema.default({}),
    })
    .default({
      bestFor: [],
      whyListed: [],
      caveats: [],
      launchAsk: [],
      scores: {},
    }),
});

export const itemsFileSchema = z.union([
  z.array(itemSchema),
  z.object({ items: z.array(itemSchema) }),
]);

// ──────────────────────────────────────────────────────────────────────
// GitHub-shaped app record (schema v1)
// ──────────────────────────────────────────────────────────────────────

const isoLike = z.string().min(4).nullable().optional();

const finalAppSchema = z
  .object({
    schemaVersion: z.number().optional(),
    id: z.string().optional(),
    slug: z.string().min(1),
    source: z
      .object({
        provider: z.literal("github"),
        owner: z.string().min(1),
        repo: z.string().min(1),
        url: z.string().url().optional(),
      })
      .passthrough(),
    app: z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        category: z.string().min(1),
        projectType: z.string().optional(),
        platforms: z.array(z.string()).min(1),
        tags: z.array(z.string()).optional(),
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
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    stack: stackSchema,
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
    health: z.record(z.string(), z.unknown()).optional(),
    curation: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const legacyAppSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    repoUrl: z.string().url(),
    description: z.string().min(1),
    stack: z.union([z.string(), z.record(z.string(), z.unknown())]),
    stacks: z.array(z.string()).optional(),
    platforms: z.array(z.string()).default([]),
    category: z.string().min(1),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────────
// Health metadata
// ──────────────────────────────────────────────────────────────────────

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

export const healthEntrySchema = z.object({
  id: z.string().min(1),
  github: githubMetadataSchema.optional(),
  health: z.object({
    status: healthStatusSchema,
    maturity: z.enum(["experimental", "useful", "mature", "unknown"]).default("unknown"),
    tier: healthTierSchema.default("experimental"),
    visibility: decisionVisibilitySchema.default("keep"),
    cleanupCandidate: z.boolean().default(false),
    staleReason: z.string().nullable().optional(),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
    reasons: z.array(z.string()).default([]),
  }),
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
// Overrides (manual corrections to imported items)
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
// Curated config
// ──────────────────────────────────────────────────────────────────────

export const curatedConfigSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().default("A living, health-aware developer directory."),
  description: z.string().optional(),
  siteUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  itemLabel: z.string().default("project"),
  paths: z
    .object({
      sourcesDir: z.string().default("sources"),
      dataDir: z.string().default("data"),
      contentDir: z.string().default("content"),
      appsDir: z.string().default("data/apps"),
      taxonomyDir: z.string().default("data/taxonomy"),
      generatedDir: z.string().default("data/generated"),
      items: z.string().default("data/items.yml"),
      health: z.string().default("data/health.yml"),
      decisions: z.string().default("data/decisions.yml"),
      overrides: z.string().default("data/overrides.yml"),
    })
    .default({
      sourcesDir: "sources",
      dataDir: "data",
      contentDir: "content",
      appsDir: "data/apps",
      taxonomyDir: "data/taxonomy",
      generatedDir: "data/generated",
      items: "data/items.yml",
      health: "data/health.yml",
      decisions: "data/decisions.yml",
      overrides: "data/overrides.yml",
    }),
});

// ──────────────────────────────────────────────────────────────────────
// Type exports
// ──────────────────────────────────────────────────────────────────────

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type DecisionVisibility = z.infer<typeof decisionVisibilitySchema>;
export type HealthTier = z.infer<typeof healthTierSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type CodebaseSize = z.infer<typeof codebaseSizeSchema>;
export type AppLabel = z.infer<typeof appLabelSchema>;
export type Score = z.infer<typeof scoreSchema>;
export type DistributionChannelType = z.infer<typeof distributionChannelTypeSchema>;
export type DistributionChannel = z.infer<typeof distributionChannelSchema>;
export type GithubMetadata = z.infer<typeof githubMetadataSchema>;
export type HealthEntry = z.infer<typeof healthEntrySchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Override = z.infer<typeof overrideSchema>;
export type CuratedItem = z.infer<typeof itemSchema>;
export type ItemsFile = z.infer<typeof itemsFileSchema>;
export type HealthFile = z.infer<typeof healthFileSchema>;
export type DecisionsFile = z.infer<typeof decisionsFileSchema>;
export type OverridesFile = z.infer<typeof overridesFileSchema>;
export type CuratedConfig = z.infer<typeof curatedConfigSchema>;
export type StackRef = z.infer<typeof stackRefSchema>;
export type PlatformRef = z.infer<typeof platformRefSchema>;
export type CategoryRef = z.infer<typeof categoryRefSchema>;
export type DistributionChannelRef = z.infer<typeof distributionChannelRefSchema>;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

export function unwrapItems(value: ItemsFile): CuratedItem[] {
  return Array.isArray(value) ? value : value.items;
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

// ──────────────────────────────────────────────────────────────────────
// App record (Open Apps schema v1)
// ──────────────────────────────────────────────────────────────────────

export interface AppRecord {
  slug: string;
  schemaVersion: number;
  name: string;
  description: string;
  repoUrl: string;
  homepageUrl?: string;
  stack: string;
  stacks: string[];
  platforms: string[];
  category: string;
  tags: string[];
  distribution: { channels: DistributionChannel[] };
  license?: string;
  status: HealthStatus;
  tier: HealthTier;
  visibility: DecisionVisibility;
  cleanupCandidate: boolean;
  staleReason: string | null;
  stars?: number;
  forks?: number;
  openIssues?: number;
  lastCommitAt?: string | null;
  addedAt?: string;
  labels: AppLabel[];
  lenses: string[];
  projectType?: ProjectType;
  difficulty?: Difficulty;
  codebaseSize?: CodebaseSize;
  bestFor: string[];
  whyListed: string[];
  caveats: string[];
  scores: Score;
  curation: {
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: string;
    notes?: string;
  };
  github?: {
    repository?: z.infer<typeof githubRepositorySchema>;
    languages?: Record<string, number>;
    latestRelease?: Record<string, unknown> | null;
    activity?: {
      monthlyCommits?: Array<number | { month: string; commits: number }>;
      totalCommitsKnown?: number;
      contributorsKnown?: number;
      openPullRequests?: number;
    };
    files?: Record<string, boolean>;
    labels?: Array<Record<string, unknown>>;
    sync?: Record<string, unknown>;
  };
  health: {
    status: HealthStatus;
    tier: HealthTier;
    visibility: DecisionVisibility;
    cleanupCandidate: boolean;
    staleReason: string | null;
  };
}

function compactArray<T>(values: T[] | undefined | null): T[] {
  return [...new Set((values ?? []).filter(Boolean))];
}

function formatDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return String(value);
  return d.toISOString().slice(0, 10);
}

function daysSince(value: string | null | undefined): number {
  if (!value) return Infinity;
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return Infinity;
  return (Date.now() - d.valueOf()) / 86_400_000;
}

export function healthFromSignals(params: {
  repo?: z.infer<typeof githubRepositorySchema>;
  monthlyCommits?: Array<number | { month: string; commits: number }>;
  legacyStatus?: HealthStatus;
}): {
  status: HealthStatus;
  tier: HealthTier;
  visibility: DecisionVisibility;
  cleanupCandidate: boolean;
  staleReason: string | null;
} {
  const { repo, monthlyCommits, legacyStatus } = params;
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

  const status: HealthStatus = archived
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

  const tier: HealthTier =
    status === "archived" || status === "unavailable"
      ? "hidden"
      : stars >= 500 || activeMonths >= 4
        ? "curated"
        : stars >= 50
          ? "listed"
          : "experimental";

  return {
    status: legacyStatus ?? status,
    tier,
    visibility: tier === "hidden" ? "hide" : "keep",
    cleanupCandidate: status === "stale" || status === "archived" || status === "inactive" || status === "unavailable",
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

export function parseAppYaml(text: string, fileSlug: string): Record<string, unknown> {
  const raw = parse(text) ?? {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${fileSlug}: app file must contain a YAML mapping`);
  }
  return raw;
}

export function stringifyAppYaml(app: Record<string, unknown>): string {
  return stringify(app, {
    lineWidth: 100,
    singleQuote: false,
    defaultStringType: "PLAIN",
  });
}

export function getOwnerRepoFromUrl(repoUrl: string | undefined | null): { owner: string; repo: string } | null {
  if (!repoUrl) return null;
  const m = String(repoUrl).match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

export function normalizeAppRecord(raw: Record<string, unknown>, fileSlug: string): AppRecord {
  const hasFinalShape =
    typeof raw.app === "object" &&
    raw.app !== null &&
    typeof raw.source === "object" &&
    raw.source !== null &&
    raw.github !== undefined;
  if (hasFinalShape) {
    return normalizeFinal(raw, fileSlug);
  }
  return normalizeLegacy(raw, fileSlug);
}

function normalizeFinal(raw: Record<string, unknown>, fileSlug: string): AppRecord {
  const parsed = finalAppSchema.parse(raw);
  const repo = parsed.github?.repository;
  const repoUrl =
    parsed.source.url ?? repo?.html_url ?? `https://github.com/${parsed.source.owner}/${parsed.source.repo}`;
  const activity = parsed.github?.activity ?? {};
  const monthlyCommits = activity.monthlyCommits as
    | Array<number | { month: string; commits: number }>
    | undefined;
  const health = {
    ...healthFromSignals({ repo, monthlyCommits }),
    ...(parsed.health as object),
  } as {
    status: HealthStatus;
    tier: HealthTier;
    visibility: DecisionVisibility;
    cleanupCandidate: boolean;
    staleReason: string | null;
  };
  const technologies = compactArray((parsed.stack.technologies ?? []).map((t) => t.id));
  const secondaryStacks = technologies.filter((id) => id !== parsed.stack.primary);
  const curation = (parsed.curation as Record<string, unknown>) ?? {};

  return {
    ...(parsed as unknown as AppRecord),
    schemaVersion: 1,
    slug: parsed.slug || fileSlug,
    name: parsed.app.name,
    description: parsed.app.description,
    repoUrl,
    homepageUrl: repo?.homepage || (raw.homepageUrl as string | undefined) || undefined,
    stack: parsed.stack.primary,
    stacks: secondaryStacks,
    platforms: parsed.app.platforms,
    distribution: (parsed.app.distribution as { channels: DistributionChannel[] } | undefined) ?? { channels: [] },
    category: parsed.app.category,
    tags: compactArray([...(parsed.app.tags ?? []), ...(repo?.topics ?? [])]),
    license: repo?.license?.spdx_id || undefined,
    status: health.status,
    stars: repo?.stargazers_count,
    forks: repo?.forks_count,
    openIssues: repo?.open_issues_count,
    lastCommitAt: formatDateOnly(repo?.pushed_at) ?? null,
    labels: (curation.labels as AppLabel[] | undefined) ?? [],
    lenses: (curation.lenses as string[] | undefined) ?? [],
    projectType: parsed.app.projectType as ProjectType | undefined,
    difficulty: curation.difficulty as Difficulty | undefined,
    codebaseSize: curation.codebaseSize as CodebaseSize | undefined,
    bestFor: (curation.bestFor as string[] | undefined) ?? [],
    whyListed: (curation.whyListed as string[] | undefined) ?? [],
    caveats: (curation.caveats as string[] | undefined) ?? [],
    scores: (curation.scores as Score) ?? {},
    curation: {
      reviewed: Boolean(curation.reviewed),
      reviewedBy: curation.reviewedBy as string | undefined,
      reviewedAt: curation.reviewedAt as string | undefined,
      notes: curation.notes as string | undefined,
    },
    github: parsed.github as AppRecord["github"],
    health,
    tier: health.tier,
  };
}

function normalizeLegacy(raw: Record<string, unknown>, fileSlug: string): AppRecord {
  const parsed = legacyAppSchema.parse({ ...raw, slug: raw.slug ?? fileSlug });
  const ownerRepo = getOwnerRepoFromUrl(parsed.repoUrl);
  const activity = (parsed as Record<string, unknown>).activity as Record<string, unknown> ?? {};
  const repo = {
    full_name: ownerRepo ? `${ownerRepo.owner}/${ownerRepo.repo}` : undefined,
    name: ownerRepo?.repo,
    html_url: parsed.repoUrl,
    homepage: parsed.homepageUrl,
    description: parsed.description,
    fork: false,
    archived: parsed.status === "archived",
    disabled: false,
    private: false,
    visibility: "public",
    language: typeof parsed.stack === "string" ? parsed.stack : undefined,
    license: parsed.license ? { spdx_id: parsed.license as string } : undefined,
    stargazers_count: (activity.stars as number | undefined) ?? parsed.stars,
    watchers_count: activity.watchers as number | undefined,
    forks_count: (activity.forks as number | undefined) ?? parsed.forks,
    open_issues_count: activity.openIssues as number | undefined,
    subscribers_count: activity.contributors as number | undefined,
    pushed_at: activity.lastCommitAt as string | undefined,
    updated_at: activity.updatedAt as string | undefined,
  } as z.infer<typeof githubRepositorySchema>;
  const monthlyCommits = (activity.monthlyCommits as Array<number | { month: string; commits: number }>) ?? [];
  const primaryStack = typeof parsed.stack === "string" ? parsed.stack : (parsed.stack as Record<string, unknown>).primary as string;
  const health = healthFromSignals({ repo, monthlyCommits, legacyStatus: parsed.status as HealthStatus });

  return {
    schemaVersion: 0,
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    repoUrl: parsed.repoUrl,
    visibility: health.visibility,
    cleanupCandidate: health.cleanupCandidate,
    staleReason: health.staleReason,
    homepageUrl: parsed.homepageUrl as string | undefined,
    stack: primaryStack as string,
    stacks: compactArray([...(parsed.stacks ?? [])]),
    platforms: parsed.platforms,
    distribution: (parsed.distribution as { channels: DistributionChannel[] } | undefined) ?? { channels: [] },
    category: parsed.category,
    tags: compactArray((parsed.tags ?? []) as string[]),
    license: parsed.license as string | undefined,
    status: health.status,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    lastCommitAt: formatDateOnly(repo.pushed_at) ?? null,
    labels: ((parsed as Record<string, unknown>).labels as AppLabel[] | undefined) ?? [],
    lenses: ((parsed as Record<string, unknown>).lenses as string[] | undefined) ?? [],
    projectType: parsed.projectType as ProjectType | undefined,
    difficulty: (parsed as Record<string, unknown>).difficulty as Difficulty | undefined,
    codebaseSize: (parsed as Record<string, unknown>).codebaseSize as CodebaseSize | undefined,
    bestFor: ((parsed as Record<string, unknown>).bestFor as string[] | undefined) ?? [],
    whyListed: ((parsed as Record<string, unknown>).whyListed as string[] | undefined) ?? [],
    caveats: ((parsed as Record<string, unknown>).caveats as string[] | undefined) ?? [],
    scores: ((parsed as Record<string, unknown>).scores as Score) ?? {},
    curation: {
      reviewed: false,
    },
    github: {
      repository: repo,
      activity: {
        monthlyCommits,
        totalCommitsKnown: activity.totalCommitsKnown as number | undefined,
        contributorsKnown: activity.contributors as number | undefined,
        openPullRequests: activity.openPullRequests as number | undefined,
      },
      sync: {
        syncedAt: activity.updatedAt as string | undefined,
        source: "legacy-activity-block",
      },
    },
    health: {
      status: health.status,
      tier: health.tier,
      visibility: health.visibility,
      cleanupCandidate: health.cleanupCandidate,
      staleReason: health.staleReason,
    },
    tier: health.tier,
  };
}

export function validateAppRecord(raw: Record<string, unknown>, fileSlug: string): string[] {
  try {
    normalizeAppRecord(raw, fileSlug);
    return [];
  } catch (err) {
    if (err instanceof z.ZodError) {
      return err.issues.map((issue) => `${fileSlug}: ${issue.path.join(".") || "(root)"} ${issue.message}`);
    }
    return [`${fileSlug}: ${(err as Error).message}`];
  }
}

export function toIndexApp(app: AppRecord): Record<string, unknown> {
  return {
    slug: app.slug,
    name: app.name,
    description: app.description,
    repoUrl: app.repoUrl,
    homepageUrl: app.homepageUrl,
    category: app.category,
    platforms: app.platforms ?? [],
    distribution: app.distribution,
    primaryStack: app.stack,
    stack: app.stack,
    stacks: app.stacks ?? [],
    technologies: compactArray([app.stack, ...(app.stacks ?? [])]),
    tier: app.health?.tier ?? app.tier,
    status: app.health?.status ?? app.status,
    visibility: app.health?.visibility ?? "keep",
    stars: app.github?.repository?.stargazers_count ?? app.stars,
    forks: app.github?.repository?.forks_count,
    openIssues: app.github?.repository?.open_issues_count,
    license: app.github?.repository?.license?.spdx_id ?? app.license,
    lastCommitAt: formatDateOnly(app.github?.repository?.pushed_at ?? app.lastCommitAt),
    tags: app.tags ?? [],
  };
}
