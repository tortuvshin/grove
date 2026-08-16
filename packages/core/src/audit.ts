export type PageType = "home" | "directory" | "collection" | "record" | "content" | "empty" | "404";
export type Profile = "mobile" | "desktop";

export interface PageManifestEntry {
  path: string;
  type: PageType;
  label: string;
  sample?: Record<string, string>;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface LighthouseMetrics {
  lcp: number;
  cls: number;
  tbt: number;
}

export interface AuditResult {
  url: string;
  type: PageType;
  profile: Profile;
  scores: LighthouseScores;
  metrics: LighthouseMetrics;
  runs: number;
  durationMs: number;
}

export interface BudgetConfig {
  scores: LighthouseScores;
  metrics: LighthouseMetrics;
}

export interface BudgetViolation {
  page: PageManifestEntry;
  profile: Profile;
  category: "score" | "metric";
  name: keyof LighthouseScores | keyof LighthouseMetrics;
  expected: number;
  actual: number;
}

// Default Lighthouse quality gate — Google's "good" thresholds on each
// metric and category. A previous 100×4 + {lcp:1800, cls:0.05, tbt:100}
// budget was tight enough that a single cold-cache run on the CI
// runner regularly tripped the budget even when nothing in the
// example regressed (typical single-run variance: ±0.05 on the score
// categories, ±50% on CLS, ±30% on TBT). Running with `--runs N` and
// taking the median is the run-time variance absorber; this default
// is the absolute floor.
//
// Override per project by exporting `audit.budget` from grove.config.ts
// (the audit CLI parses it the same way it parses `audit.pages`).
export const DEFAULT_BUDGET: BudgetConfig = {
  scores: { performance: 0.9, accessibility: 0.9, bestPractices: 0.9, seo: 0.9 },
  metrics: { lcp: 2500, cls: 0.1, tbt: 200 },
};

const SCORE_KEYS: (keyof LighthouseScores)[] = ["performance", "accessibility", "bestPractices", "seo"];
const METRIC_KEYS: (keyof LighthouseMetrics)[] = ["lcp", "cls", "tbt"];

export function evaluateBudget(
  result: AuditResult,
  page: PageManifestEntry,
  budget: BudgetConfig = DEFAULT_BUDGET,
): BudgetViolation[] {
  // Lighthouse cannot meaningfully measure 404 responses — all scores come
  // back as 0 and all metrics as Infinity. The audit still runs the page
  // for completeness, but the 100×4 budget does not apply.
  if (page.type === "404") return [];

  const violations: BudgetViolation[] = [];
  for (const key of SCORE_KEYS) {
    // Empty-state fixtures ship with `noindex` on purpose, and
    // Lighthouse's SEO category fails its is-crawlable audit on any
    // noindex page — so the SEO score can never reach 1 there. The
    // other three categories still apply in full.
    if (key === "seo" && page.type === "empty") continue;
    if (result.scores[key] < budget.scores[key]) {
      violations.push({ page, profile: result.profile, category: "score", name: key, expected: budget.scores[key], actual: result.scores[key] });
    }
  }
  for (const key of METRIC_KEYS) {
    if (result.metrics[key] > budget.metrics[key]) {
      violations.push({ page, profile: result.profile, category: "metric", name: key, expected: budget.metrics[key], actual: result.metrics[key] });
    }
  }
  return violations;
}
