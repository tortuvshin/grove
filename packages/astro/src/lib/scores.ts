import type { AppScores } from "../data/types";

/**
 * Format a single score (0-100) into a 0-5 "tier" used by the UI:
 *
 *   0-19  → 0  (very low)
 *   20-39 → 1  (low)
 *   40-59 → 2  (medium)
 *   60-79 → 3  (high)
 *   80-100 → 4 (very high)
 *
 * The list page renders each score as a 4-cell bar; this gives the
 * visual a stable shape regardless of the underlying number.
 */
export function scoreTier(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n < 20) return 0;
  if (n < 40) return 1;
  if (n < 60) return 2;
  if (n < 80) return 3;
  return 4;
}

/** Compact textual label for a score tier (used in tooltips). */
export function scoreTierLabel(n: number): string {
  switch (scoreTier(n)) {
    case 0:
      return "Very low";
    case 1:
      return "Low";
    case 2:
      return "Medium";
    case 3:
      return "High";
    case 4:
      return "Very high";
  }
}

/** Short numeric label used inline next to a score bar, e.g. "82". */
export function scoreLabel(n: number | undefined): string {
  if (typeof n !== "number") return "—";
  return Math.round(n).toString();
}

/** Order of score dimensions, used by both list and detail. */
export const SCORE_DIMENSIONS: (keyof AppScores)[] = [
  "activity",
  "maturity",
  "learning",
  "contribution",
  "docs",
  "overall",
];

/** Human-readable label for a score dimension. */
export const SCORE_LABELS: Record<keyof AppScores, string> = {
  activity: "Activity",
  maturity: "Maturity",
  learning: "Learning",
  contribution: "Contribution",
  docs: "Docs",
  overall: "Overall",
};

/**
 * Reasoning copy per dimension, surfaced in the detail page so the
 * numbers don't feel magical. These are intentionally short — the
 * curation.notes on each app carries the longer story.
 */
export const SCORE_REASONING: Record<keyof AppScores, string> = {
  activity:
    "Recent commits, open and merged PRs, issue response time, release cadence.",
  maturity:
    "Repo age, stable structure, real-world production usage, contributor stability.",
  learning:
    "Codebase readability, useful architecture patterns, comment quality, examples.",
  contribution:
    "Open issues, recent merged PRs from new contributors, maintainer responsiveness, contribution guide.",
  docs:
    "README quality, architecture docs, contributing guide, examples, code comments.",
  overall:
    "Composite judgment — how likely this app is to satisfy a curious developer.",
};
