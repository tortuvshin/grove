import generatedJson from "../../data/generated/apps.json";
import type { OpenSourceApp, AppLabel } from "./types";

// ──────────────────────────────────────────────────────────────────────
// Source of truth: data/generated/apps.json, produced at build time
// from data/apps/*.yml by scripts/build-apps-json.mjs. The yml files
// are the human-edited source; this file is just a typed re-export
// that fills in safe defaults so consumers don't have to guard every
// optional field.
//
// When adding a new app: write a yml in data/apps/, run
// `pnpm run build:data`, and it will appear here.
// ──────────────────────────────────────────────────────────────────────

const generated = generatedJson as { apps: unknown[] };

type GeneratedApp = Partial<OpenSourceApp> & {
  slug: string;
  name: string;
  repoUrl: string;
  description?: string;
  stack: string;
  platforms: string[];
  category: string;
  activity?: {
    stars?: number;
    forks?: number;
    lastCommitAt?: string | null;
    contributors?: number;
    updatedAt?: string;
  };
};

/**
 * Auto-compute labels for an app from its activity block. Used as a
 * fallback when a curator hasn't hand-set `labels:` in the yml. Drives
 * the homepage "new / hot / mature" sections.
 *
 *   mature — stars ≥ 500, OR very high stars (popular, established)
 *   hot    — last commit within the last 6 months (currently active)
 *   new    — emerging: not mature, not in the last commit window, or
 *            no commit signal at all
 *
 * Multiple labels can apply (a popular active project is both mature
 * and hot).
 */
function computeLabels(g: GeneratedApp): AppLabel[] {
  const labels: AppLabel[] = [];
  // After the schemaVersion 1 migration, stars + lastCommitAt live at
  // the top level of the generated record (the v1 normalizer in
  // `app-schema.mjs` flattens `github.repository.stargazers_count`
  // and `github.repository.pushed_at` to top-level). The old
  // `g.activity.stars` shape still works for legacy records, so we
  // fall back to it for mixed input.
  const stars =
    typeof g.stars === "number"
      ? g.stars
      : typeof g.activity?.stars === "number"
        ? g.activity.stars
        : 0;
  const lastCommit = g.lastCommitAt ?? g.activity?.lastCommitAt;

  if (stars >= 500) labels.push("mature");
  if (stars >= 100 && stars < 500) labels.push("hot");
  if (stars < 100) labels.push("new");

  // Hot: recent commit and not already tagged as such
  if (lastCommit) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (new Date(lastCommit) >= sixMonthsAgo && !labels.includes("hot")) {
      labels.push("hot");
    }
  }
  return labels;
}

/**
 * Map a generated yml-shaped record to the OpenSourceApp shape that
 * pages expect. Fills defaults, flattens `activity.stars` → `stars`,
 * and tolerates missing curation fields.
 */
function normalize(g: GeneratedApp): OpenSourceApp {
  const a = g.activity ?? {};
  return {
    slug: g.slug,
    name: g.name,
    description: g.description ?? "",
    repoUrl: g.repoUrl,
    homepageUrl: g.homepageUrl,
    stack: g.stack,
    stacks: g.stacks,
    platforms: g.platforms ?? [],
    distribution: g.distribution,
    category: g.category,
    tags: g.tags,
    logoUrl: g.logoUrl,
    stars: typeof a.stars === "number" ? a.stars : g.stars,
    license: g.license,
    status: g.status,
    addedAt: g.addedAt,
    lastCommitAt: a.lastCommitAt ?? g.lastCommitAt,
    labels: g.labels && g.labels.length > 0 ? g.labels : computeLabels(g),
    // Curation (optional)
    projectType: g.projectType,
    stateManagement: g.stateManagement,
    backend: g.backend,
    architecture: g.architecture,
    difficulty: g.difficulty,
    codebaseSize: g.codebaseSize,
    bestFor: g.bestFor,
    whyListed: g.whyListed,
    caveats: g.caveats,
    goodFirstIssues: g.goodFirstIssues,
    contributionGuide: g.contributionGuide,
    launchedBy: g.launchedBy,
    launchAsk: g.launchAsk,
    lenses: g.lenses,
    scores: g.scores,
    curation: g.curation,
    github: g.github,
    health: g.health,
    tier: g.tier,
  };
}

const generatedApps = generated.apps as GeneratedApp[];

export const apps: OpenSourceApp[] = generatedApps.map(normalize);

// ── Convenience filters ──────────────────────────────────────────────

export function newApps(): OpenSourceApp[] {
  return apps.filter((a) => a.labels?.includes("new"));
}
export function hotApps(): OpenSourceApp[] {
  return apps.filter((a) => a.labels?.includes("hot"));
}
export function matureApps(): OpenSourceApp[] {
  return apps.filter((a) => a.labels?.includes("mature"));
}

// ── Lookups ──────────────────────────────────────────────────────────

const bySlug = new Map(apps.map((a) => [a.slug, a]));

export function appBySlug(slug: string): OpenSourceApp | undefined {
  return bySlug.get(slug);
}
