export type AppStatus = "active" | "quiet" | "stale" | "archived" | "unknown";
export type AppLabel = "new" | "hot" | "mature" | "featured";

// ── Curation: what kind of app is this? ──────────────────────────────
/**
 * `projectType` answers "is this a real, production-grade codebase
 * or a demo?" — the most-asked filter for anyone scanning a list.
 */
export type ProjectType =
  | "real-app"        // Actually used by real people in production
  | "production"      // Commercial product with open codebase
  | "reference"       // Showcase of patterns/architecture, not a real product
  | "demo"            // Demo / proof-of-concept
  | "template";       // Starter template others fork

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type CodebaseSize = "small" | "medium" | "large" | "huge";

// ── Scoring: 6-dimension, 0-100 each ─────────────────────────────────
/**
 * Six orthogonal scores that drive the "decision row" UI.
 * - activity:        how alive is the repo (commits, PRs, issues responded)
 * - maturity:        how established (age, stability, real usage)
 * - learning:        how good for learning (readable code, useful patterns)
 * - contribution:    how welcoming to new contributors
 * - docs:            how good the documentation is
 * - overall:         composite judgment
 *
 * Scores are curator-assigned integers. They are NOT computed from
 * any algorithm — see `curation.notes` for the reasoning chain.
 */
export type AppScores = {
  activity: number;
  maturity: number;
  learning: number;
  contribution: number;
  docs: number;
  overall: number;
};

export type GithubRepositoryMetadata = {
  full_name?: string;
  html_url?: string;
  homepage?: string | null;
  description?: string | null;
  fork?: boolean;
  archived?: boolean;
  disabled?: boolean;
  private?: boolean;
  visibility?: string;
  default_branch?: string;
  language?: string | null;
  topics?: string[];
  license?: {
    key?: string | null;
    name?: string | null;
    spdx_id?: string | null;
    url?: string | null;
  } | null;
  stargazers_count?: number;
  watchers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  size?: number;
  created_at?: string | null;
  updated_at?: string | null;
  pushed_at?: string | null;
};

export type AppHealth = {
  status?: string;
  tier?: string;
  visibility?: string;
  activityScore?: number;
  maintenanceScore?: number;
  metadataCompleteness?: number;
  cleanupCandidate?: boolean;
  staleReason?: string | null;
};

export type DistributionChannel = {
  type:
    | "app-store"
    | "play-store"
    | "fdroid"
    | "github-releases"
    | "apk"
    | "testflight"
    | "website"
    | "snapcraft"
    | "flathub"
    | "microsoft-store"
    | "other";
  platform?: string;
  label?: string;
  url: string;
  verified?: boolean;
  notes?: string;
};

export type AppDistribution = {
  channels?: DistributionChannel[];
};

// ── Curation provenance: was this human-reviewed? ────────────────────
/**
 * Every curated field needs a chain of trust. `reviewed: true` means
 * a human looked at it and signed off. `reviewed: false` means it's
 * auto-generated (e.g. by AI from public repo metadata) and pending
 * curator review. The UI surfaces this distinction.
 */
export type CurationInfo = {
  reviewed: boolean;
  /** Curator handle, e.g. "@username" or "Open Source Apps editors". */
  by?: string;
  /** ISO date the curation was authored or last reviewed. */
  date?: string;
  /** Free-text: where did the data come from? what's uncertain? */
  notes?: string;
};

// ── The app record ──────────────────────────────────────────────────
/**
 * One open-source app entry.
 *
 * Fields split into two layers:
 *
 * 1. **Required discovery data** — name, description, repo, stack,
 *    platforms, category. Without these, the app can't be listed.
 *
 * 2. **Optional curation data** — everything under the `// ── Curation`
 *    block. New apps start sparse. The 5 anchor apps are fully curated.
 *    The list/detail UI gracefully degrades when fields are missing.
 */
export type OpenSourceApp = {
  // ── Identity ──
  slug: string;
  name: string;
  description: string;
  repoUrl: string;
  homepageUrl?: string;

  // ── Basic taxonomy ──
  /** Primary stack, e.g. "Flutter" */
  stack: string;
  /** Additional stacks used in the codebase. */
  stacks?: string[];
  platforms: string[];
  distribution?: AppDistribution;
  category: string;
  tags?: string[];

  // ── Public signals ──
  /** Direct URL to a square logo. Falls back to GitHub owner avatar. */
  logoUrl?: string;
  stars?: number;
  license?: string;
  status?: AppStatus;
  addedAt?: string;
  lastCommitAt?: string;
  labels?: AppLabel[];

  // ── Curation: project shape ──
  /** What kind of app is this? (real-app / production / reference / …) */
  projectType?: ProjectType;
  /** What state-management pattern does it use? "Riverpod", "BLoC", etc. */
  stateManagement?: string;
  /** What backend / data layer? "REST", "Firebase", "PostgreSQL", … */
  backend?: string;
  /** Architecture style. "Feature-based", "Clean", "MVC", "Layered", … */
  architecture?: string;
  /** How hard is it to read / contribute? */
  difficulty?: Difficulty;
  /** Approximate size, by curator judgment. */
  codebaseSize?: CodebaseSize;

  // ── Curation: text signals ──
  /**
   * 2-5 short phrases: "Studying offline-first architecture",
   * "REST API integration patterns", etc. Hand-written.
   */
  bestFor?: string[];
  /**
   * Why is this app listed? Curator's one-liner per angle.
   * E.g. ["Most starred Flutter app", "Real production deployment"].
   */
  whyListed?: string[];
  /**
   * Caveats / risks. Honest downsides, not marketing.
   * E.g. ["Large codebase", "Sparse documentation", "Archived"].
   */
  caveats?: string[];

  // ── Curation: contribution links ──
  /**
   * `true` if the repo has a "good first issue" label,
   * or a direct URL to a filtered list of them.
   */
  goodFirstIssues?: boolean | string;
  /** `true` if the repo has a CONTRIBUTING.md, or a direct URL. */
  contributionGuide?: boolean | string;

  // ── Curation: launch (Product-Hunt-style, optional) ──
  /**
   * For recently-launched apps, the username of the person who
   * submitted the launch entry. Long-running apps leave this empty.
   */
  launchedBy?: string;
  /**
   * What the maintainer wants from this launch:
   * "Feedback", "Contributors", "Users", "Stars", etc.
   */
  launchAsk?: string[];

  /**
   * Curated lenses — the curated "tabs" on the list page. These are
   * hand-assigned per app by a curator; not derived from scores.
   * Valid values: "good-to-learn" | "production-like" |
   * "beginner-friendly" | "contribution-ready" | "launches".
   * The label-based lenses (new / hot / mature) live in `labels`.
   */
  lenses?: string[];

  // ── Curation: scores ──
  scores?: AppScores;

  // ── Curation: provenance ──
  curation?: CurationInfo;

  // ── Final schema raw blocks ────────────────────────────────────────
  github?: {
    repository?: GithubRepositoryMetadata;
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
  health?: AppHealth;
  tier?: string;
};
