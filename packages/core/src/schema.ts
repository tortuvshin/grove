import { z } from "zod";

export const healthStatusSchema = z.enum([
  "active",
  "mature",
  "stale",
  "inactive",
  "archived",
  "unknown",
  "historical",
  "needs_review",
]);

export const decisionVisibilitySchema = z.enum([
  "highlight",
  "keep",
  "needs_review",
  "hide",
  "remove",
  "historical",
]);

export const scoreSchema = z.object({
  activity: z.number().min(0).max(100).optional(),
  maturity: z.number().min(0).max(100).optional(),
  learning: z.number().min(0).max(100).optional(),
  contribution: z.number().min(0).max(100).optional(),
  docs: z.number().min(0).max(100).optional(),
  overall: z.number().min(0).max(100).optional(),
});

export const distributionChannelSchema = z.object({
  type: z.enum([
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
  ]),
  platform: z.string().optional(),
  label: z.string().optional(),
  url: z.string().url(),
  verified: z.boolean().optional(),
  notes: z.string().optional(),
});

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
      type: z.enum(["markdown", "manual", "github-topic"]).default("manual"),
      file: z.string().optional(),
      line: z.number().int().positive().optional(),
      url: z.string().optional(),
    })
    .default({ type: "manual" }),
  taxonomy: z
    .object({
      category: z.string().min(1).default("uncategorized"),
      tags: z.array(z.string()).default([]),
      language: z.string().optional(),
    })
    .default({ category: "uncategorized", tags: [] }),
  labels: z.array(z.string()).default([]),
  lenses: z.array(z.string()).default([]),
  distribution: z
    .object({
      channels: z.array(distributionChannelSchema).default([]),
    })
    .default({ channels: [] }),
  curation: z
    .object({
      projectType: z.enum(["production", "reference", "library", "tool", "demo", "template", "historical"]).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      codebaseSize: z.enum(["small", "medium", "large", "huge"]).optional(),
      bestFor: z.array(z.string()).default([]),
      whyListed: z.array(z.string()).default([]),
      caveats: z.array(z.string()).default([]),
      goodFirstIssues: z.union([z.boolean(), z.string().url()]).optional(),
      contributionGuide: z.union([z.boolean(), z.string().url()]).optional(),
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
      scores: {},
    }),
});

export const itemsFileSchema = z.union([
  z.array(itemSchema),
  z.object({
    items: z.array(itemSchema),
  }),
]);

export const githubMetadataSchema = z.object({
  fullName: z.string().optional(),
  stars: z.number().int().nonnegative().default(0),
  forks: z.number().int().nonnegative().default(0),
  openIssues: z.number().int().nonnegative().optional(),
  archived: z.boolean().default(false),
  disabled: z.boolean().optional(),
  pushedAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  latestReleaseAt: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  topics: z.array(z.string()).default([]),
  language: z.string().nullable().optional(),
  defaultBranch: z.string().optional(),
  languages: z.record(z.string(), z.number()).optional(),
  contributorsKnown: z.number().int().nonnegative().optional(),
  totalCommitsKnown: z.number().int().nonnegative().optional(),
  openPullRequests: z.number().int().nonnegative().optional(),
  files: z.record(z.string(), z.boolean()).optional(),
  monthlyCommits: z
    .array(
      z.object({
        month: z.string(),
        commits: z.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export const healthEntrySchema = z.object({
  id: z.string().min(1),
  github: githubMetadataSchema.optional(),
  health: z.object({
    status: healthStatusSchema,
    maturity: z.enum(["experimental", "useful", "mature", "unknown"]).default("unknown"),
    confidence: z.enum(["low", "medium", "high"]).default("medium"),
    reasons: z.array(z.string()).default([]),
  }),
});

export const healthFileSchema = z.union([
  z.array(healthEntrySchema),
  z.object({
    health: z.array(healthEntrySchema),
  }),
]);

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
  z.object({
    decisions: z.array(decisionSchema),
  }),
]);

export const curatedConfigSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().default("A living, health-aware developer directory."),
  siteUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  itemLabel: z.string().default("project"),
  paths: z
    .object({
      sourcesDir: z.string().default("sources"),
      dataDir: z.string().default("data"),
      contentDir: z.string().default("content"),
      items: z.string().default("data/items.yml"),
      health: z.string().default("data/health.yml"),
      decisions: z.string().default("data/decisions.yml"),
      overrides: z.string().default("data/overrides.yml"),
    })
    .default({
      sourcesDir: "sources",
      dataDir: "data",
      contentDir: "content",
      items: "data/items.yml",
      health: "data/health.yml",
      decisions: "data/decisions.yml",
      overrides: "data/overrides.yml",
    }),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type DecisionVisibility = z.infer<typeof decisionVisibilitySchema>;
export type CuratedScores = z.infer<typeof scoreSchema>;
export type DistributionChannel = z.infer<typeof distributionChannelSchema>;
export type CuratedItem = z.infer<typeof itemSchema>;
export type ItemsFile = z.infer<typeof itemsFileSchema>;
export type GithubMetadata = z.infer<typeof githubMetadataSchema>;
export type HealthEntry = z.infer<typeof healthEntrySchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type CuratedConfig = z.infer<typeof curatedConfigSchema>;

export function unwrapItems(value: ItemsFile): CuratedItem[] {
  return Array.isArray(value) ? value : value.items;
}

export function unwrapHealth(value: z.infer<typeof healthFileSchema>): HealthEntry[] {
  return Array.isArray(value) ? value : value.health;
}

export function unwrapDecisions(value: z.infer<typeof decisionsFileSchema>): Decision[] {
  return Array.isArray(value) ? value : value.decisions;
}
