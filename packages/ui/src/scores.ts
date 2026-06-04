import type { Score } from "@grove-dev/core";

export type CuratedScores = Score;

/** Tier 0-4 for a 0-100 score, used to render a 4-cell bar. */
export function scoreTier(value: number | undefined): 0 | 1 | 2 | 3 | 4 {
  if (typeof value !== "number") return 0;
  if (value < 20) return 0;
  if (value < 40) return 1;
  if (value < 60) return 2;
  if (value < 80) return 3;
  return 4;
}

/** Human-readable label for each score dimension. */
export const SCORE_LABELS: Record<keyof Score, string> = {
  activity: "Activity",
  maturity: "Maturity",
  learning: "Learning",
  contribution: "Contribution",
  docs: "Docs",
  overall: "Overall",
};

/** Reasoning copy for each score dimension. */
export const SCORE_REASONING: Record<keyof Score, string> = {
  activity: "Recent commits, releases, and maintenance rhythm.",
  maturity: "Adoption, stability, clear license, and project history.",
  learning: "Readable structure, useful patterns, and educational value.",
  contribution: "Contribution docs, issue signals, and maintainer openness.",
  docs: "README, docs, examples, and onboarding quality.",
  overall: "Composite usefulness for a developer scanning the directory.",
};
