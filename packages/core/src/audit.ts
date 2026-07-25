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

export const DEFAULT_BUDGET: BudgetConfig = {
  scores: { performance: 1, accessibility: 1, bestPractices: 1, seo: 1 },
  metrics: { lcp: 1800, cls: 0.05, tbt: 100 },
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
