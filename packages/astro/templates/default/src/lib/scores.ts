/**
 * Score display helpers used across list and detail pages.
 * Generic version lives in `@grove-dev/ui` — this proxies the
 * `AppScores` shape defined in template `data/types.ts`.
 */
import type { AppScores } from "../data/types";

export function scoreTier(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n < 20) return 0;
  if (n < 40) return 1;
  if (n < 60) return 2;
  if (n < 80) return 3;
  return 4;
}

export function scoreTierLabel(n: number): string {
  switch (scoreTier(n)) {
    case 0: return "Very low";
    case 1: return "Low";
    case 2: return "Medium";
    case 3: return "High";
    case 4: return "Very high";
  }
}

export function scoreLabel(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return Math.round(n).toString();
}

export const SCORE_DIMENSIONS: (keyof AppScores)[] = [
  "activity", "maturity", "learning", "contribution", "docs", "overall",
];

export const SCORE_LABELS: Record<keyof AppScores, string> = {
  activity: "Activity",
  maturity: "Maturity",
  learning: "Learning",
  contribution: "Contribution",
  docs: "Docs",
  overall: "Overall",
};

export const SCORE_REASONING: Record<keyof AppScores, string> = {
  activity: "Recent commits, open and merged PRs, issue response time, release cadence.",
  maturity: "Repo age, stable structure, real-world production usage, contributor stability.",
  learning: "Codebase readability, useful architecture patterns, comment quality, examples.",
  contribution: "Open issues, recent merged PRs from new contributors, maintainer responsiveness, contribution guide.",
  docs: "README quality, architecture docs, contributing guide, examples, code comments.",
  overall: "Composite judgment — how likely this app is to satisfy a curious developer.",
};
