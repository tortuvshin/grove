/**
 * Display-name helpers for curation labels, statuses, lenses, and
 * sort options. Internal ids (e.g. "hot", "stale", "production-like")
 * stay stable for URL state and data files; this module owns the
 * mapping from id → user-facing string.
 *
 * Every export is dependency-free so it can be imported by both
 * server-rendered Astro components and any client-side script.
 *
 * Status ids accept the `HealthStatus` union from `@grove-dev/core`
 * plus a couple of curated composites (e.g. "needs-maintainer")
 * that appear in URL state.
 */

import type {
  AppLabel,
  HealthStatus,
} from "@grove-dev/core";

// ── Label ids (the `curation.labels` array on a record) ──────────
export type LabelId = AppLabel;

export const LABEL_DISPLAY: Record<LabelId, string> = {
  new: "Recently added",
  hot: "Trending",
  mature: "Established",
  featured: "Featured",
};

/** Pretty-print a slug to Title Case. Used for arbitrary slugs. */
export function prettySlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

/** Returns a human-readable name for a label id, or null if unknown. */
export function labelDisplay(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id in LABEL_DISPLAY) {
    return LABEL_DISPLAY[id as LabelId];
  }
  return prettySlug(id);
}

// ── Status ids (the `health.status` field on a record) ───────────
/**
 * Canonical status display map. Includes the curated
 * "needs-maintainer" composite that's emitted by the
 * `needs-maintainer` lens.
 */
export const STATUS_DISPLAY: Record<string, string> = {
  active: "Active",
  mature: "Mature",
  stale: "Not recently active",
  inactive: "Inactive",
  archived: "Archived",
  unknown: "Unknown",
  historical: "Historical",
  needs_review: "Needs review",
  quiet: "Quiet",
  unavailable: "Unavailable",
  "needs-maintainer": "Needs maintainer",
};

export function statusDisplay(
  s: HealthStatus | string | null | undefined,
): string {
  if (!s) return STATUS_DISPLAY.unknown;
  return STATUS_DISPLAY[s] ?? prettySlug(s);
}

// ── Lens ids (the curated tabs on /projects) ─────────────────────
export const LENS_DISPLAY: Record<string, string> = {
  all: "All",
  hot: "Trending",
  new: "Recently added",
  mature: "Established",
  featured: "Featured",
  "needs-review": "Needs review",
};

export function lensDisplay(id: string | null | undefined): string {
  if (!id) return LENS_DISPLAY.all;
  return LENS_DISPLAY[id] ?? prettySlug(id);
}

// ── Sort ids (the /projects sort dropdown) ───────────────────────
export const SORT_DISPLAY: Record<string, string> = {
  "recently-updated": "Recently updated",
  "most-starred": "Most starred",
  "recently-added": "Recently added",
  "best-overall": "Best overall",
  alphabetical: "Alphabetical",
};

export function sortDisplay(id: string | null | undefined): string {
  if (!id) return SORT_DISPLAY["recently-updated"];
  return SORT_DISPLAY[id] ?? prettySlug(id);
}

// ── Status option list (used by filter dropdowns) ───────────────
// "needs-maintainer" is included even though it's a derived/composite
// status — filter dropdowns and chip rendering need to offer it
// alongside the raw HealthStatus values.
export const STATUS_OPTIONS: string[] = [
  "active",
  "quiet",
  "stale",
  "needs-maintainer",
  "archived",
  "unknown",
];
