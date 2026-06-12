/**
 * Display-name helpers for curation labels, statuses, lenses, and sort
 * options. Internal ids (e.g. "hot", "stale", "production-like") stay
 * stable for URL state and data files; this module owns the mapping
 * from id → user-facing string.
 *
 * Every export here is dependency-free so it can be imported by both
 * server-rendered Astro components and any client-side script.
 */

import type { AppStatus } from "../data/types";

// ── Label ids (the `labels` array on an app) ────────────────────────
export type LabelId = "new" | "hot" | "mature" | "featured";

export const LABEL_DISPLAY: Record<LabelId, string> = {
  new: "Recently added",
  hot: "Trending",
  mature: "Established",
  featured: "Featured",
};

/** Returns a human-readable name for a label id, or null if unknown. */
export function labelDisplay(id: string | null | undefined): string | null {
  if (!id) return null;
  return LABEL_DISPLAY[id as LabelId] ?? null;
}

// ── Status ids (the `status` field on an app) ───────────────────────
/**
 * Canonical status ids, including the curated "needs-maintainer"
 * composite that's emitted by the `needs-maintainer` lens (it expands
 * to "stale,quiet" in URL state but presents as one chip).
 */
export const STATUS_DISPLAY: Record<string, string> = {
  active: "Active",
  quiet: "Quiet",
  stale: "Not recently active",
  "needs-maintainer": "Needs maintainer",
  archived: "Archived",
  unknown: "Unknown",
};

export function statusDisplay(s: AppStatus | string | null | undefined): string {
  if (!s) return STATUS_DISPLAY.unknown;
  return STATUS_DISPLAY[s] ?? STATUS_DISPLAY.unknown;
}

// ── Lens ids (the curated tabs on /apps) ────────────────────────────
export const LENS_DISPLAY: Record<string, string> = {
  all: "All apps",
  new: "Recently added",
  hot: "Trending",
  mature: "Established",
  "good-to-learn": "Good to learn",
  "production-like": "Production-like",
  "beginner-friendly": "Beginner friendly",
  "contribution-ready": "Contribution ready",
  launches: "Launches",
  "actively-developed": "Active",
  "needs-maintainer": "Needs maintainer",
};

export function lensDisplay(id: string | null | undefined): string {
  if (!id) return LENS_DISPLAY.all;
  return LENS_DISPLAY[id] ?? id;
}

// ── Sort ids (the /apps sort dropdown) ──────────────────────────────
export const SORT_DISPLAY: Record<string, string> = {
  "recently-updated": "Recently updated",
  "most-starred": "Most starred",
  "recently-added": "Recently added",
  "best-overall": "Best overall",
  alphabetical: "Alphabetical",
};

export function sortDisplay(id: string | null | undefined): string {
  if (!id) return SORT_DISPLAY["recently-updated"];
  return SORT_DISPLAY[id] ?? id;
}

// ── Status option list (used by filter dropdowns) ───────────────────
// "needs-maintainer" is included even though it's a derived/composite
// status — filter dropdowns and chip rendering need to offer it
// alongside the raw AppStatus values.
export const STATUS_OPTIONS: string[] = [
  "active",
  "quiet",
  "stale",
  "needs-maintainer",
  "archived",
  "unknown",
];
