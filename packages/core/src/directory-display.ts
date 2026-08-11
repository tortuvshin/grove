/**
 * Display-name helpers for curation labels, statuses, lenses, and sort
 * options. Internal ids (e.g. "hot", "stale", "production-like") stay
 * stable for URL state and data files; this module owns the mapping
 * from id → user-facing string.
 *
 * Every export here is dependency-free so it can be imported by both
 * server-rendered Astro components and any client-side script.
 */

// ── Label ids (the `labels` array on an item) ────────────────────────
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

// ── Status ids (the `status` field on an item) ───────────────────────
/**
 * Canonical status ids, including the curated "needs-maintainer"
 * composite that's emitted by the `needs-maintainer` lens (it expands
 * to "stale,quiet" in URL state but presents as one chip).
 */
export const STATUS_DISPLAY: Record<string, string> = {
  active: "Active",
  mature: "Mature",
  quiet: "Quiet",
  stale: "Not recently active",
  inactive: "Inactive",
  "needs-maintainer": "Needs maintainer",
  archived: "Archived",
  historical: "Historical",
  needs_review: "Needs review",
  unavailable: "Unavailable",
  unknown: "Unknown",
};

export function statusDisplay(s: string | null | undefined): string {
  if (!s) return STATUS_DISPLAY.unknown ?? "";
  return STATUS_DISPLAY[s] ?? STATUS_DISPLAY.unknown ?? "";
}

// ── Lens ids (the curated tabs on /items) ────────────────────────────
export const LENS_DISPLAY: Record<string, string> = {
  all: "All items",
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
  if (!id) return LENS_DISPLAY.all ?? "All";
  return LENS_DISPLAY[id] ?? id;
}

// ── Sort ids (the /items sort dropdown) ──────────────────────────────
export const SORT_DISPLAY: Record<string, string> = {
  "recently-updated": "Recently updated",
  "most-starred": "Most starred",
  "recently-added": "Recently added",
  "best-overall": "Best overall",
  alphabetical: "Alphabetical",
};

export function sortDisplay(id: string | null | undefined): string {
  if (!id) return SORT_DISPLAY["recently-updated"] ?? "";
  return SORT_DISPLAY[id] ?? id;
}

export function prettySlug(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ── Status option list (used by filter dropdowns) ───────────────────
// "needs-maintainer" is included even though it's a derived/composite
// status — filter dropdowns and chip rendering need to offer it
// alongside the raw AppStatus values.
export const STATUS_OPTIONS: string[] = [
  "active",
  "mature",
  "quiet",
  "stale",
  "inactive",
  "needs-maintainer",
  "archived",
  "historical",
  "needs_review",
  "unavailable",
  "unknown",
];

// ── GitHub linguist palette ─────────────────────────────────────────
// Color hex values mirror the GitHub Linguist language palette so a
// record's "code composition" bar matches what readers see on the
// project's GitHub page. Anything not in the map falls back to a
// neutral ink grey. Used by the record-detail sidebar.
export const LANG_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  PHP: "#4F5D95",
  Shell: "#89e051",
  Bash: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Sass: "#a53b88",
  Less: "#1d365d",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dart: "#00B4AB",
  Lua: "#000080",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Scala: "#c22d40",
  R: "#198CE7",
  MATLAB: "#e16737",
  "Jupyter Notebook": "#DA5B0B",
  MDX: "#fcb32c",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Perl: "#0298c3",
  Zig: "#ec915c",
  Nim: "#ffc200",
  Erlang: "#B83998",
  Elm: "#60B5CC",
  OCaml: "#3be133",
  "F#": "#b845fc",
};

/**
 * Resolve a GitHub Linguist color for a language name. Returns a
 * neutral ink grey for languages not in the palette so an unknown
 * language still renders a visible bar segment.
 */
export function langColor(name: string | null | undefined): string {
  if (!name) return "#9ca3af";
  return LANG_COLORS[name] ?? "#9ca3af";
}

// ── SPDX license id → human-readable label ──────────────────────────
// GitHub emits a literal `NOASSERTION` (and the related `OTHER`
// placeholder) on repositories where the license couldn't be
// auto-detected. Surfacing the API enum to readers looks like a
// bug; this helper swaps the placeholder for a plain-English string.
const LICENSE_PLACEHOLDER_IDS = new Set([
  "NOASSERTION",
  "OTHER",
  "NONE",
  "UNLICENSED",
  "",
]);

export const LICENSE_NOT_DETECTED = "License not detected";
export const LICENSE_OTHER = "Other";

/**
 * Resolve a SPDX id (or GitHub-flavored placeholder) to a
 * user-facing string. The placeholder ids are collapsed to a
 * short, neutral phrase; known SPDX ids pass through untouched so
 * downstream consumers can still match on them.
 */
export function licenseDisplay(spdxId: string | null | undefined): string {
  if (!spdxId) return LICENSE_NOT_DETECTED;
  if (LICENSE_PLACEHOLDER_IDS.has(spdxId.toUpperCase())) {
    return spdxId.toUpperCase() === "OTHER" ? LICENSE_OTHER : LICENSE_NOT_DETECTED;
  }
  return spdxId;
}
