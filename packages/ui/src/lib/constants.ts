/**
 * @grove-dev/ui — shared UI constants (V1).
 *
 * Order matters — render the SORT_OPTIONS list and the LENSES list
 * in the order defined here.
 *
 * `LENSES` is the framework-agnostic analog of `lenses.ts` from the
 * showcase (openapps). It carries the *abstract* lens definitions
 * (id + label + URL params) — no per-framework rendering concerns
 * leak in here.
 */

/**
 * The sort orders exposed by the directory's `<select>`.
 * Aligned with the V1 openapps `SORT_OPTIONS` and the astro
 * `@grove-dev/astro` `IndexSort` union (formerly `ItemsSort` before
 * the V0→V1 rename). The values are stable on the
 * wire (URL + persisted prefs) — adding a value is non-breaking,
 * removing a value is breaking.
 */
export const SORT_OPTIONS = [
  { value: "recently-updated", label: "Recently updated" },
  { value: "most-starred", label: "Most starred" },
  { value: "recently-added", label: "Recently added" },
  { value: "best-overall", label: "Best overall" },
  { value: "alphabetical", label: "Alphabetical" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];

/**
 * Lens ids exposed by the V1 directory. Mirrors openapps/astro
 * `lenses.ts` exactly so the framework adapters can re-export
 * `LENSES` from `@grove-dev/ui` without divergence.
 */
export type LensId =
  // Label-based (tabbed)
  | "all"
  | "new"
  | "hot"
  | "mature"
  // Curator-assigned (tabbed)
  | "good-to-learn"
  | "production-like"
  // Available in URL state, but not tabbed
  | "beginner-friendly"
  | "contribution-ready"
  | "launches"
  // Status-based (available in URL state, not tabbed)
  | "actively-developed"
  | "needs-maintainer";

export interface LensDef {
  id: LensId;
  label: string;
  /** Short blurb shown when the lens is active. */
  description?: string;
  /** What URL state this lens implies. Empty means no filter. */
  toParams: () => Record<string, string | string[]>;
}

export const LENSES: LensDef[] = [
  { id: "all", label: "All", description: "Every visible project", toParams: () => ({}) },
  {
    id: "new",
    label: "New",
    description: "Recently added or emerging projects",
    toParams: () => ({ label: "new" }),
  },
  {
    id: "hot",
    label: "Hot",
    description: "Projects with strong recent attention",
    toParams: () => ({ label: "hot" }),
  },
  {
    id: "mature",
    label: "Mature",
    description: "Established and useful projects",
    toParams: () => ({ label: "mature" }),
  },
  {
    id: "production-like",
    label: "Production-like",
    description: "Real apps, not toy projects",
    toParams: () => ({ lens: "production-like" }),
  },
  {
    id: "good-to-learn",
    label: "Good to learn",
    description: "Readable codebases with useful patterns",
    toParams: () => ({ lens: "good-to-learn" }),
  },
  // Secondary (URL-only, not rendered as tabs)
  {
    id: "beginner-friendly",
    label: "Beginner friendly",
    description: "Smaller, readable, easier to understand",
    toParams: () => ({ lens: "beginner-friendly" }),
  },
  {
    id: "contribution-ready",
    label: "Contribution ready",
    description: "Clear issues, active maintainers, license, contribution docs",
    toParams: () => ({ lens: "contribution-ready" }),
  },
  {
    id: "launches",
    label: "Launches",
    description: "Recently launched OSS apps seeking feedback",
    toParams: () => ({ lens: "launches" }),
  },
  {
    id: "actively-developed",
    label: "Active",
    description: "Apps with recent commits, releases, and issue activity",
    toParams: () => ({ status: "active" }),
  },
  {
    id: "needs-maintainer",
    label: "Needs maintainer",
    description: "Useful apps that need help",
    toParams: () => ({ status: "stale,quiet" }),
  },
];

/**
 * The 6 lenses shown as top-row tabs on the directory index.
 * Order matters — left to right. Keep in sync with what the
 * design calls for: All, signal lenses, and the two
 * curator-assigned lenses that have any matches.
 */
export const PRIMARY_LENSES: LensId[] = [
  "all",
  "new",
  "hot",
  "mature",
  "production-like",
  "good-to-learn",
];

/** Look up a lens by id. Returns undefined for unknown ids. */
export function lensById(id: string | null | undefined): LensDef | undefined {
  if (!id) return undefined;
  return LENSES.find((l) => l.id === id);
}

/** True if `id` is one of the 6 top-row tab lenses. */
export function isPrimaryLens(id: string | null | undefined): id is LensId {
  if (!id) return false;
  return PRIMARY_LENSES.includes(id as LensId);
}

/** How many items per page. Constant for now; future versions may vary. */
export const PAGE_SIZE = 12;
